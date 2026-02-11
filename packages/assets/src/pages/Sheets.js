import React, {useState, useEffect, useCallback, useRef} from 'react';
import {useLocation, useSearchParams} from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  IndexFilters,
  useSetIndexFiltersMode,
  Banner,
  SkeletonBodyText
} from '@shopify/polaris';
import {useGoogleAuth} from '../hooks/useGoogleAuth';
import {useGooglePicker} from '../hooks/useGooglePicker';
import {api} from '../helpers/api';
import AccountsContent from './sheets/AccountsContent';
import SheetsContent from './sheets/SheetsContent';
import ConnectAccountCard from './sheets/ConnectAccountCard';
import DeleteConfirmationModal from './sheets/DeleteConfirmationModal';
import DisconnectConfirmationModal from './sheets/DisconnectConfirmationModal';
import {PAGE_LIMIT, TAB_KEYS} from './sheets/constants';

/**
 * Google Sheets Management Page
 */
export default function Sheets() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    authenticated,
    loading: authLoading,
    error: authError,
    setError: setAuthError,
    startAuth,
    checkAuth
  } = useGoogleAuth();
  const {openPicker, loading: pickerLoading, error: pickerError} = useGooglePicker();

  // Tab state from URL
  const selectedTab = Math.max(0, TAB_KEYS.indexOf(searchParams.get('tab') || 'accounts'));

  const handleTabChange = useCallback(
    index => {
      setSearchParams(prev => {
        prev.set('tab', TAB_KEYS[index]);
        return prev;
      });
    },
    [setSearchParams]
  );

  // IndexFilters tabs (rendered inside the toolbar)
  const indexFiltersTabs = [
    {id: 'accounts', content: 'Accounts'},
    {id: 'sheets', content: 'Sheets'}
  ];

  const {mode, setMode} = useSetIndexFiltersMode();

  const [sheets, setSheets] = useState([]);
  const [sheetsPagination, setSheetsPagination] = useState({page: 1, total: 0, totalPages: 0});
  const [loading, setLoading] = useState(true);
  const [addingSheet, setAddingSheet] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Connected accounts state
  const [accounts, setAccounts] = useState([]);
  const [accountsPagination, setAccountsPagination] = useState({page: 1, total: 0, totalPages: 0});

  // Search state (per tab)
  const [sheetSearchValue, setSheetSearchValue] = useState('');
  const [activeSheetSearch, setActiveSheetSearch] = useState('');
  const sheetSearchTimerRef = useRef(null);

  const [accountSearchValue, setAccountSearchValue] = useState('');
  const [activeAccountSearch, setActiveAccountSearch] = useState('');
  const accountSearchTimerRef = useRef(null);

  // Delete sheet confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  // Disconnect account confirmation modal state
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [pendingDisconnectEmail, setPendingDisconnectEmail] = useState(null);
  const [pendingDisconnectEmails, setPendingDisconnectEmails] = useState([]);
  const [disconnecting, setDisconnecting] = useState(false);

  // Ref dedup for StrictMode
  const lastSheetsFetchKeyRef = useRef(null);
  const lastAccountsFetchKeyRef = useRef(null);

  // Track authenticated state to refetch data when user connects
  const wasAuthenticated = useRef(authenticated);
  useEffect(() => {
    if (authenticated && !wasAuthenticated.current) {
      setSuccessMessage('Google account connected successfully!');
      fetchSheets(1, activeSheetSearch);
      fetchAccounts(1, activeAccountSearch);
    }
    wasAuthenticated.current = authenticated;
  }, [authenticated]);

  // Handle redirect from OAuth callback
  useEffect(() => {
    if (location.state?.authSuccess) {
      setSuccessMessage('Google account connected successfully!');
      checkAuth();
      fetchAccounts(1, activeAccountSearch);
      fetchSheets(1, activeSheetSearch);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Fetch sheets when search changes (also handles initial load)
  useEffect(() => {
    const key = `sheets:${activeSheetSearch}`;
    if (lastSheetsFetchKeyRef.current === key) return;
    lastSheetsFetchKeyRef.current = key;
    fetchSheets(1, activeSheetSearch);
  }, [activeSheetSearch]);

  // Fetch accounts when search changes (also handles initial load)
  useEffect(() => {
    const key = `accounts:${activeAccountSearch}`;
    if (lastAccountsFetchKeyRef.current === key) return;
    lastAccountsFetchKeyRef.current = key;
    fetchAccounts(1, activeAccountSearch);
  }, [activeAccountSearch]);

  // Search handlers
  const handleSheetSearchChange = useCallback(value => {
    setSheetSearchValue(value);
    if (sheetSearchTimerRef.current) clearTimeout(sheetSearchTimerRef.current);
    sheetSearchTimerRef.current = setTimeout(() => setActiveSheetSearch(value), 400);
  }, []);

  const handleSheetSearchClear = useCallback(() => {
    setSheetSearchValue('');
    setActiveSheetSearch('');
  }, []);

  const handleAccountSearchChange = useCallback(value => {
    setAccountSearchValue(value);
    if (accountSearchTimerRef.current) clearTimeout(accountSearchTimerRef.current);
    accountSearchTimerRef.current = setTimeout(() => setActiveAccountSearch(value), 400);
  }, []);

  const handleAccountSearchClear = useCallback(() => {
    setAccountSearchValue('');
    setActiveAccountSearch('');
  }, []);

  // Active search value/handlers based on current tab
  const currentSearchValue = selectedTab === 0 ? accountSearchValue : sheetSearchValue;
  const currentSearchPlaceholder =
    selectedTab === 0 ? 'Search by email...' : 'Search by sheet name...';
  const currentSearchChange =
    selectedTab === 0 ? handleAccountSearchChange : handleSheetSearchChange;
  const currentSearchClear = selectedTab === 0 ? handleAccountSearchClear : handleSheetSearchClear;

  const fetchSheets = async (page = 1, search = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT)
      });
      if (search) params.set('search', search);

      const response = await api(`/api/sheets?${params}`);
      const result = await response.json();
      if (result.success) {
        setSheets(result.data);
        setSheetsPagination(result.pagination);
      }
    } catch (err) {
      console.error('Error fetching sheets:', err);
      setError('Failed to fetch sheets');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async (page = 1, search = '') => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT)
      });
      if (search) params.set('search', search);

      const response = await api(`/api/google/connected-accounts?${params}`);
      const result = await response.json();
      if (result.success) {
        setAccounts(result.data);
        setAccountsPagination(result.pagination);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const refreshData = useCallback(
    async ({resetPage = false} = {}) => {
      const sheetsPage = resetPage ? 1 : sheetsPagination.page;
      const accountsPage = resetPage ? 1 : accountsPagination.page;
      await Promise.all([
        fetchSheets(sheetsPage, activeSheetSearch),
        fetchAccounts(accountsPage, activeAccountSearch)
      ]);
    },
    [sheetsPagination.page, accountsPagination.page, activeSheetSearch, activeAccountSearch]
  );

  const saveSheet = useCallback(
    async (spreadsheet, refreshToken, googleEmail) => {
      try {
        setAddingSheet(true);
        const body = {
          spreadsheetId: spreadsheet.spreadsheetId,
          name: spreadsheet.name
        };
        if (refreshToken) body.refreshToken = refreshToken;
        if (googleEmail) body.googleEmail = googleEmail;

        const response = await api('/api/sheets/add', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body)
        });

        const result = await response.json();

        if (result.success) {
          setSuccessMessage(`Sheet "${spreadsheet.name}" added successfully!`);
          await refreshData();
        } else {
          setError(result.error || 'Failed to add sheet');
        }
      } catch (err) {
        console.error('Error adding sheet:', err);
        setError('Failed to add sheet');
      } finally {
        setAddingSheet(false);
      }
    },
    [refreshData]
  );

  const handleConnectAccount = useCallback(async () => {
    try {
      await startAuth();
    } catch (err) {
      // user cancelled or auth failed — already handled by useGoogleAuth
    }
    await checkAuth();
    fetchSheets(1, activeSheetSearch);
    fetchAccounts(1, activeAccountSearch);
  }, [startAuth, checkAuth, activeSheetSearch, activeAccountSearch]);

  const handleConnectNewAccount = useCallback(async () => {
    try {
      setError(null);
      await startAuth();
      setSuccessMessage('Google account connected successfully!');
    } catch (err) {
      // user cancelled or auth failed — already handled by useGoogleAuth
    }
    await checkAuth();
    fetchAccounts(1, activeAccountSearch);
  }, [startAuth, checkAuth, activeAccountSearch]);

  // --- Delete sheet handlers ---
  const handleDeleteClick = useCallback(sheet => {
    setPendingDeleteTarget(sheet);
    setPendingDeleteIds([]);
    setDeleteModalOpen(true);
  }, []);

  const handleBulkDeleteClick = useCallback(ids => {
    setPendingDeleteTarget(null);
    setPendingDeleteIds(ids);
    setDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      const idsToDelete = pendingDeleteTarget ? [pendingDeleteTarget.id] : pendingDeleteIds;

      const response = await api('/api/sheets/bulk-delete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sheetIds: idsToDelete})
      });

      const result = await response.json();

      if (result.success) {
        await refreshData();
      } else {
        setError(result.error || 'Failed to delete sheet(s)');
      }
    } catch (err) {
      console.error('Error deleting sheet(s):', err);
      setError('Failed to delete sheet(s)');
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setPendingDeleteTarget(null);
      setPendingDeleteIds([]);
    }
  };

  const handleDeleteModalClose = useCallback(() => {
    setDeleteModalOpen(false);
    setPendingDeleteTarget(null);
    setPendingDeleteIds([]);
  }, []);

  // --- Disconnect account handlers ---
  const handleDisconnectAccountClick = useCallback(email => {
    setPendingDisconnectEmail(email);
    setPendingDisconnectEmails([]);
    setDisconnectModalOpen(true);
  }, []);

  const handleBulkDisconnectClick = useCallback(emails => {
    setPendingDisconnectEmail(null);
    setPendingDisconnectEmails(emails);
    setDisconnectModalOpen(true);
  }, []);

  const handleDisconnectAccountConfirm = async () => {
    const isBulk = pendingDisconnectEmails.length > 0;
    try {
      setDisconnecting(true);

      if (isBulk) {
        const response = await api('/api/google/bulk-disconnect-accounts', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({emails: pendingDisconnectEmails})
        });
        const result = await response.json();
        if (result.success) {
          setSuccessMessage(
            `Disconnected ${result.disconnected} account(s). ${result.totalDeletedSheets} sheet(s) removed.`
          );
          checkAuth();
          await refreshData({resetPage: true});
        } else {
          setError(result.error || 'Failed to disconnect accounts');
        }
      } else {
        const response = await api('/api/google/disconnect-account', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({googleEmail: pendingDisconnectEmail})
        });
        const result = await response.json();
        if (result.success) {
          setSuccessMessage(
            `Disconnected ${pendingDisconnectEmail}. ${result.data.deletedSheets} sheet(s) removed.`
          );
          checkAuth();
          await refreshData({resetPage: true});
        } else {
          setError(result.error || 'Failed to disconnect account');
        }
      }
    } catch (err) {
      console.error('Error disconnecting account(s):', err);
      setError('Failed to disconnect account(s)');
    } finally {
      setDisconnecting(false);
      setDisconnectModalOpen(false);
      setPendingDisconnectEmail(null);
      setPendingDisconnectEmails([]);
    }
  };

  const handleDisconnectModalClose = useCallback(() => {
    setDisconnectModalOpen(false);
    setPendingDisconnectEmail(null);
    setPendingDisconnectEmails([]);
  }, []);

  const handleAddSheetFromAccount = useCallback(
    async email => {
      try {
        setAddingSheet(true);
        setError(null);

        const res = await api(`/api/google/account-token?googleEmail=${encodeURIComponent(email)}`);
        const result = await res.json();

        if (!result.success) {
          setError(result.error || 'Failed to get token for this account');
          setAddingSheet(false);
          return;
        }

        openPicker({
          accessToken: result.data.accessToken,
          appId: result.data.appId,
          onCancel: () => setAddingSheet(false),
          onSelect: async selected => {
            await saveSheet(selected, undefined, email);
          }
        });
      } catch (err) {
        setError(err.message || 'Failed to add sheet from account');
        setAddingSheet(false);
      }
    },
    [openPicker, saveSheet]
  );

  const displayError = error || authError || pickerError;

  if (authLoading) {
    return (
      <Page title="Google Sheets (Beta)">
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText lines={5} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Google Sheets (Beta)"
      subtitle="Manage your connected Google Sheets. This feature is currently in beta."
      primaryAction={
        authenticated
          ? {
              content: 'Connect new account',
              onAction: handleConnectNewAccount,
              loading: addingSheet || pickerLoading
            }
          : undefined
      }
    >
      <Layout>
        {successMessage && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Banner>
          </Layout.Section>
        )}

        {displayError && (
          <Layout.Section>
            <Banner
              tone="critical"
              onDismiss={() => {
                setError(null);
                setAuthError(null);
              }}
            >
              {displayError}
            </Banner>
          </Layout.Section>
        )}

        {!authenticated && (
          <Layout.Section>
            <ConnectAccountCard onConnect={handleConnectAccount} />
          </Layout.Section>
        )}

        {authenticated && (
          <Layout.Section>
            <Card padding="0">
              <IndexFilters
                tabs={indexFiltersTabs}
                selected={selectedTab}
                onSelect={handleTabChange}
                queryValue={currentSearchValue}
                queryPlaceholder={currentSearchPlaceholder}
                onQueryChange={currentSearchChange}
                onQueryClear={currentSearchClear}
                filters={[]}
                appliedFilters={[]}
                onClearAll={currentSearchClear}
                mode={mode}
                setMode={setMode}
                cancelAction={{
                  onAction: () => {
                    currentSearchClear();
                    setMode('DEFAULT');
                  }
                }}
                canCreateNewView={false}
              />
              {selectedTab === 0 ? (
                <AccountsContent
                  accounts={accounts}
                  pagination={accountsPagination}
                  onAddSheet={handleAddSheetFromAccount}
                  onDisconnect={handleDisconnectAccountClick}
                  onBulkDisconnect={handleBulkDisconnectClick}
                  onPageChange={page => fetchAccounts(page, activeAccountSearch)}
                  loading={addingSheet || pickerLoading}
                  searchValue={accountSearchValue}
                />
              ) : (
                <SheetsContent
                  sheets={sheets}
                  pagination={sheetsPagination}
                  loading={loading}
                  onDelete={handleDeleteClick}
                  onBulkDelete={handleBulkDeleteClick}
                  onPageChange={page => fetchSheets(page, activeSheetSearch)}
                  authenticated={authenticated}
                  onAuth={handleConnectAccount}
                  searchValue={sheetSearchValue}
                />
              )}
            </Card>
          </Layout.Section>
        )}
      </Layout>

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        pendingDeleteTarget={pendingDeleteTarget}
        pendingDeleteIds={pendingDeleteIds}
      />

      <DisconnectConfirmationModal
        open={disconnectModalOpen}
        onClose={handleDisconnectModalClose}
        onConfirm={handleDisconnectAccountConfirm}
        loading={disconnecting}
        pendingDisconnectEmail={pendingDisconnectEmail}
        pendingDisconnectEmails={pendingDisconnectEmails}
      />
    </Page>
  );
}
