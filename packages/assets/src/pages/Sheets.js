import React, {useState, useEffect, useCallback, useRef} from 'react';
import {useLocation, useSearchParams} from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  Button,
  Banner,
  SkeletonBodyText,
  EmptyState,
  Text,
  InlineStack,
  BlockStack,
  Modal,
  Tooltip,
  Pagination,
  useIndexResourceState
} from '@shopify/polaris';
import {DeleteIcon, PlusIcon, ExternalIcon} from '@shopify/polaris-icons';
import {useGoogleAuth} from '../hooks/useGoogleAuth';
import {useGooglePicker} from '../hooks/useGooglePicker';
import {api} from '../helpers/api';

const truncateStyle = {
  maxWidth: 200,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const PAGE_LIMIT = 10;
const TAB_KEYS = ['accounts', 'sheets'];

/**
 * Accounts table content (IndexTable only, no IndexFilters)
 */
function AccountsContent({
  accounts,
  pagination,
  onAddSheet,
  onDisconnect,
  onBulkDisconnect,
  onPageChange,
  loading,
  searchValue
}) {
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection
  } = useIndexResourceState(accounts, {resourceIDResolver: account => account.email});

  const {page, total, totalPages} = pagination;
  const start = (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  const resourceName = {singular: 'account', plural: 'accounts'};

  const promotedBulkActions = [
    {
      content: `Disconnect ${selectedResources.length} account(s)`,
      onAction: () => {
        onBulkDisconnect(selectedResources);
        clearSelection();
      },
      destructive: true
    }
  ];

  if (accounts.length === 0) {
    return (
      <EmptyState
        heading={searchValue ? 'No accounts found' : 'No accounts connected'}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>
          {searchValue
            ? 'Try a different search term.'
            : 'Connect a Google account to get started.'}
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <IndexTable
        resourceName={resourceName}
        itemCount={accounts.length}
        headings={[{title: 'Email'}, {title: 'Sheets'}, {title: 'Actions', alignment: 'center'}]}
        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
        onSelectionChange={handleSelectionChange}
        promotedBulkActions={promotedBulkActions}
      >
        {accounts.map((account, index) => (
          <IndexTable.Row
            id={account.email}
            key={account.email}
            position={index}
            selected={selectedResources.includes(account.email)}
          >
            <IndexTable.Cell>
              <Text as="span" fontWeight="semibold">
                {account.email}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" tone="subdued">
                {account.sheetCount} {account.sheetCount === 1 ? 'sheet' : 'sheets'}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="200" align="center">
                <Tooltip content="Add sheet">
                  <Button
                    icon={PlusIcon}
                    variant="plain"
                    onClick={e => {
                      e.stopPropagation();
                      onAddSheet(account.email);
                    }}
                    loading={loading}
                    accessibilityLabel="Add sheet"
                  />
                </Tooltip>
                <Tooltip content="Disconnect account">
                  <Button
                    icon={DeleteIcon}
                    variant="plain"
                    tone="critical"
                    onClick={e => {
                      e.stopPropagation();
                      onDisconnect(account.email);
                    }}
                    accessibilityLabel="Disconnect account"
                  />
                </Tooltip>
              </InlineStack>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
      {totalPages > 1 && (
        <div style={{padding: '16px', borderTop: '1px solid #e1e3e5'}}>
          <InlineStack align="center" blockAlign="center" gap="400">
            <Text as="span" tone="subdued">
              {start}-{end} of {total}
            </Text>
            <Pagination
              hasPrevious={page > 1}
              hasNext={page < totalPages}
              onPrevious={() => onPageChange(page - 1)}
              onNext={() => onPageChange(page + 1)}
            />
          </InlineStack>
        </div>
      )}
    </>
  );
}

/**
 * Sheets table content (IndexTable only, no IndexFilters)
 */
function SheetsContent({
  sheets,
  pagination,
  loading,
  onDelete,
  onBulkDelete,
  onPageChange,
  authenticated,
  onAuth,
  searchValue
}) {
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection
  } = useIndexResourceState(sheets);

  const {page, total, totalPages} = pagination;
  const start = (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  const resourceName = {singular: 'sheet', plural: 'sheets'};

  const promotedBulkActions = [
    {
      content: `Delete ${selectedResources.length} sheet(s)`,
      onAction: () => {
        onBulkDelete(selectedResources);
        clearSelection();
      },
      destructive: true
    }
  ];

  if (loading) {
    return (
      <div style={{padding: '16px'}}>
        <SkeletonBodyText lines={5} />
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <EmptyState
        heading={searchValue ? 'No sheets found' : 'No sheets connected'}
        action={
          !authenticated && !searchValue
            ? {content: 'Connect Google Account', onAction: onAuth}
            : undefined
        }
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>
          {searchValue
            ? 'Try a different search term.'
            : authenticated
            ? 'Switch to the Accounts tab and use the add icon to connect a Google Sheet.'
            : 'Connect your Google account first, then add sheets from Google Drive.'}
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <IndexTable
        resourceName={resourceName}
        itemCount={sheets.length}
        headings={[
          {title: 'Spreadsheet'},
          {title: 'Google Account'},
          {title: 'Actions', alignment: 'center'}
        ]}
        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
        onSelectionChange={handleSelectionChange}
        promotedBulkActions={promotedBulkActions}
      >
        {sheets.map((sheet, index) => (
          <IndexTable.Row
            id={sheet.id}
            key={sheet.id}
            position={index}
            selected={selectedResources.includes(sheet.id)}
          >
            <IndexTable.Cell>
              <Tooltip content={sheet.name}>
                <div style={truncateStyle}>
                  <Text variant="bodyMd" fontWeight="bold">
                    {sheet.name}
                  </Text>
                </div>
              </Tooltip>
            </IndexTable.Cell>
            <IndexTable.Cell>{sheet.googleEmail || '\u2014'}</IndexTable.Cell>
            <IndexTable.Cell>
              <InlineStack gap="200" align="center">
                {sheet.spreadsheetId && (
                  <Tooltip content="Open in Google Sheets">
                    <Button
                      icon={ExternalIcon}
                      variant="plain"
                      onClick={e => {
                        e.stopPropagation();
                        window.open(
                          `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`,
                          '_blank'
                        );
                      }}
                      accessibilityLabel="Open sheet"
                    />
                  </Tooltip>
                )}
                <Tooltip content="Disconnect sheet">
                  <Button
                    icon={DeleteIcon}
                    variant="plain"
                    tone="critical"
                    onClick={e => {
                      e.stopPropagation();
                      onDelete(sheet);
                    }}
                    accessibilityLabel="Disconnect"
                  />
                </Tooltip>
              </InlineStack>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
      {totalPages > 1 && (
        <div style={{padding: '16px', borderTop: '1px solid #e1e3e5'}}>
          <InlineStack align="center" blockAlign="center" gap="400">
            <Text as="span" tone="subdued">
              {start}-{end} of {total}
            </Text>
            <Pagination
              hasPrevious={page > 1}
              hasNext={page < totalPages}
              onPrevious={() => onPageChange(page - 1)}
              onNext={() => onPageChange(page + 1)}
            />
          </InlineStack>
        </div>
      )}
    </>
  );
}

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

  const handleAddSheetFromAccount = useCallback(
    async email => {
      try {
        setAddingSheet(true);
        setError(null);

        const res = await api(
          `/api/google/account-token?googleEmail=${encodeURIComponent(email)}`
        );
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

  const deleteModalMessage = pendingDeleteTarget
    ? `Are you sure you want to disconnect "${pendingDeleteTarget.name}"? This will remove the sheet connection but won't delete any data.`
    : `Are you sure you want to disconnect ${pendingDeleteIds.length} sheet(s)? This will remove the sheet connections but won't delete any data.`;

  const disconnectModalMessage =
    pendingDisconnectEmails.length > 0
      ? `Are you sure you want to disconnect ${pendingDisconnectEmails.length} account(s)? This will remove the accounts and all sheets connected through them.`
      : `Are you sure you want to disconnect ${pendingDisconnectEmail}? This will remove the account and all sheets connected through it.`;

  if (authLoading) {
    return (
      <Page title="Google Sheets">
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
      title="Google Sheets"
      subtitle="Manage your connected Google Sheets"
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
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Connect your Google Account
                </Text>
                <Text as="p" tone="subdued">
                  Connect your Google account to browse and select spreadsheets directly from your
                  Google Drive. This is a one-time setup.
                </Text>
                <InlineStack>
                  <Button variant="primary" onClick={handleConnectAccount}>
                    Connect Google Account
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
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

      {/* Delete sheet confirmation modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setPendingDeleteTarget(null);
          setPendingDeleteIds([]);
        }}
        title="Disconnect sheet(s)"
        primaryAction={{
          content: 'Disconnect',
          destructive: true,
          loading: deleting,
          onAction: handleDeleteConfirm
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setDeleteModalOpen(false);
              setPendingDeleteTarget(null);
              setPendingDeleteIds([]);
            }
          }
        ]}
      >
        <Modal.Section>
          <Text as="p">{deleteModalMessage}</Text>
        </Modal.Section>
      </Modal>

      {/* Disconnect account confirmation modal */}
      <Modal
        open={disconnectModalOpen}
        onClose={() => {
          setDisconnectModalOpen(false);
          setPendingDisconnectEmail(null);
          setPendingDisconnectEmails([]);
        }}
        title="Disconnect account(s)"
        primaryAction={{
          content: 'Disconnect',
          destructive: true,
          loading: disconnecting,
          onAction: handleDisconnectAccountConfirm
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setDisconnectModalOpen(false);
              setPendingDisconnectEmail(null);
              setPendingDisconnectEmails([]);
            }
          }
        ]}
      >
        <Modal.Section>
          <Text as="p">{disconnectModalMessage}</Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
