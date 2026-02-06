import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {useLocation} from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Banner,
  SkeletonBodyText,
  EmptyState,
  Text,
  InlineStack,
  BlockStack,
  Modal,
  Tooltip,
  Divider,
  Pagination
} from '@shopify/polaris';
import {DeleteIcon, PlusIcon} from '@shopify/polaris-icons';
import {useGoogleAuth} from '../hooks/useGoogleAuth';
import {useGooglePicker} from '../hooks/useGooglePicker';

const truncateStyle = {
  maxWidth: 200,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

import {USER_ID} from '../config/user';
const PAGE_LIMIT = 10;

/**
 * Connected Accounts section
 */
function ConnectedAccounts({
  accounts,
  pagination,
  onAddSheet,
  onDisconnect,
  onPageChange,
  loading
}) {
  if (accounts.length === 0) return null;

  const {page, total, totalPages} = pagination;
  const start = (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Connected Accounts
        </Text>
        <BlockStack gap="300">
          {accounts.map(account => (
            <InlineStack key={account.email} align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <Text as="span" fontWeight="semibold">
                  {account.email}
                </Text>
                <Text as="span" tone="subdued">
                  ({account.sheetCount} {account.sheetCount === 1 ? 'sheet' : 'sheets'})
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                <Button
                  size="slim"
                  icon={PlusIcon}
                  onClick={() => onAddSheet(account.email)}
                  loading={loading}
                >
                  Add Sheet
                </Button>
                <Tooltip content="Disconnect account">
                  <Button
                    size="slim"
                    icon={DeleteIcon}
                    variant="plain"
                    tone="critical"
                    onClick={() => onDisconnect(account.email)}
                    accessibilityLabel="Disconnect account"
                  />
                </Tooltip>
              </InlineStack>
            </InlineStack>
          ))}
        </BlockStack>
        {totalPages > 1 && (
          <InlineStack align="center">
            <Pagination
              hasPrevious={page > 1}
              hasNext={page < totalPages}
              onPrevious={() => onPageChange(page - 1)}
              onNext={() => onPageChange(page + 1)}
              label={`${start}–${end} of ${total}`}
            />
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

ConnectedAccounts.propTypes = {
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  pagination: PropTypes.shape({
    page: PropTypes.number,
    total: PropTypes.number,
    totalPages: PropTypes.number
  }).isRequired,
  onAddSheet: PropTypes.func.isRequired,
  onDisconnect: PropTypes.func.isRequired,
  onPageChange: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

/**
 * Connected Sheets table
 */
function ConnectedSheets({
  sheets,
  pagination,
  loading,
  onDelete,
  onPageChange,
  authenticated,
  onAuth
}) {
  const {page, total, totalPages} = pagination;
  const start = (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  const rows = sheets.map(sheet => [
    <Tooltip content={sheet.name} key="name">
      <div style={truncateStyle}>{sheet.name}</div>
    </Tooltip>,
    sheet.googleEmail || '—',
    <Tooltip content="Disconnect sheet" key="action">
      <Button
        icon={DeleteIcon}
        variant="plain"
        tone="critical"
        onClick={() => onDelete(sheet)}
        accessibilityLabel="Disconnect"
      />
    </Tooltip>
  ]);

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Connected Sheets
        </Text>
        {loading ? (
          <SkeletonBodyText lines={5} />
        ) : sheets.length === 0 ? (
          <EmptyState
            heading="No sheets connected"
            action={
              !authenticated ? {content: 'Connect Google Account', onAction: onAuth} : undefined
            }
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              {authenticated
                ? 'Use the "Add Sheet" buttons above to connect your first Google Sheet.'
                : 'Connect your Google account first, then add sheets from Google Drive.'}
            </p>
          </EmptyState>
        ) : (
          <>
            <DataTable
              columnContentTypes={['text', 'text', 'text']}
              headings={['Spreadsheet', 'Google Account', '']}
              rows={rows}
            />
            {totalPages > 1 && (
              <InlineStack align="center">
                <Pagination
                  hasPrevious={page > 1}
                  hasNext={page < totalPages}
                  onPrevious={() => onPageChange(page - 1)}
                  onNext={() => onPageChange(page + 1)}
                  label={`${start}–${end} of ${total}`}
                />
              </InlineStack>
            )}
          </>
        )}
      </BlockStack>
    </Card>
  );
}

ConnectedSheets.propTypes = {
  sheets: PropTypes.arrayOf(PropTypes.object).isRequired,
  pagination: PropTypes.shape({
    page: PropTypes.number,
    total: PropTypes.number,
    totalPages: PropTypes.number
  }).isRequired,
  loading: PropTypes.bool,
  onDelete: PropTypes.func.isRequired,
  onPageChange: PropTypes.func.isRequired,
  authenticated: PropTypes.bool,
  onAuth: PropTypes.func
};

/**
 * Google Sheets Management Page
 */
export default function Sheets() {
  const location = useLocation();
  const {
    authenticated,
    loading: authLoading,
    error: authError,
    setError: setAuthError,
    startAuth,
    startAuthForNewAccount,
    checkAuth
  } = useGoogleAuth();
  const {openPicker, loading: pickerLoading, error: pickerError} = useGooglePicker();

  const [sheets, setSheets] = useState([]);
  const [sheetsPagination, setSheetsPagination] = useState({page: 1, total: 0, totalPages: 0});
  const [loading, setLoading] = useState(true);
  const [addingSheet, setAddingSheet] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Connected accounts state
  const [accounts, setAccounts] = useState([]);
  const [accountsPagination, setAccountsPagination] = useState({page: 1, total: 0, totalPages: 0});

  // Delete sheet confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteSheet, setPendingDeleteSheet] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Disconnect account confirmation modal state
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [pendingDisconnectEmail, setPendingDisconnectEmail] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Handle redirect from OAuth callback
  useEffect(() => {
    if (location.state?.authSuccess) {
      setSuccessMessage('Google account connected successfully!');
      checkAuth();
      fetchAccounts();
      fetchSheets();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    fetchSheets();
    fetchAccounts();
  }, []);

  const fetchSheets = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/sheets?userId=${USER_ID}&page=${page}&limit=${PAGE_LIMIT}`
      );
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

  const fetchAccounts = async (page = 1) => {
    try {
      const response = await fetch(
        `/api/google/connected-accounts?userId=${USER_ID}&page=${page}&limit=${PAGE_LIMIT}`
      );
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
      await Promise.all([fetchSheets(sheetsPage), fetchAccounts(accountsPage)]);
    },
    [sheetsPagination.page, accountsPagination.page]
  );

  const saveSheet = useCallback(
    async (spreadsheet, refreshToken, googleEmail) => {
      try {
        setAddingSheet(true);
        const body = {
          userId: USER_ID,
          spreadsheetId: spreadsheet.spreadsheetId,
          name: spreadsheet.name
        };
        if (refreshToken) body.refreshToken = refreshToken;
        if (googleEmail) body.googleEmail = googleEmail;

        const response = await fetch('/api/sheets/add', {
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
      await refreshData({resetPage: true});
    } catch (err) {
      // user cancelled or auth failed — already handled by useGoogleAuth
    }
  }, [startAuth, refreshData]);

  const handleAddFromAnotherAccount = useCallback(async () => {
    try {
      setAddingSheet(true);
      setError(null);

      const tempTokens = await startAuthForNewAccount();

      openPicker({
        accessToken: tempTokens.accessToken,
        onCancel: () => setAddingSheet(false),
        onSelect: async selected => {
          await saveSheet(selected, tempTokens.refreshToken, tempTokens.googleEmail);
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to add from another account');
      setAddingSheet(false);
    }
  }, [startAuthForNewAccount, openPicker, saveSheet]);

  const handleDeleteClick = sheet => {
    setPendingDeleteSheet(sheet);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteSheet) return;
    try {
      setDeleting(true);
      const response = await fetch(`/api/sheets/${pendingDeleteSheet.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await refreshData();
      } else {
        setError(result.error || 'Failed to delete sheet');
      }
    } catch (err) {
      console.error('Error deleting sheet:', err);
      setError('Failed to delete sheet');
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setPendingDeleteSheet(null);
    }
  };

  const handleDisconnectAccountClick = email => {
    setPendingDisconnectEmail(email);
    setDisconnectModalOpen(true);
  };

  const handleDisconnectAccountConfirm = async () => {
    if (!pendingDisconnectEmail) return;
    try {
      setDisconnecting(true);
      const response = await fetch('/api/google/disconnect-account', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId: USER_ID, googleEmail: pendingDisconnectEmail})
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
    } catch (err) {
      console.error('Error disconnecting account:', err);
      setError('Failed to disconnect account');
    } finally {
      setDisconnecting(false);
      setDisconnectModalOpen(false);
      setPendingDisconnectEmail(null);
    }
  };

  const handleAddSheetFromAccount = useCallback(
    async email => {
      try {
        setAddingSheet(true);
        setError(null);

        const res = await fetch(
          `/api/google/account-token?userId=${USER_ID}&googleEmail=${encodeURIComponent(email)}`
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
              onAction: handleAddFromAnotherAccount,
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

        {authenticated && accounts.length > 0 && (
          <Layout.Section>
            <ConnectedAccounts
              accounts={accounts}
              pagination={accountsPagination}
              onAddSheet={handleAddSheetFromAccount}
              onDisconnect={handleDisconnectAccountClick}
              onPageChange={page => fetchAccounts(page)}
              loading={addingSheet || pickerLoading}
            />
          </Layout.Section>
        )}

        {authenticated && accounts.length > 0 && (
          <Layout.Section>
            <Divider />
          </Layout.Section>
        )}

        <Layout.Section>
          <ConnectedSheets
            sheets={sheets}
            pagination={sheetsPagination}
            loading={loading}
            onDelete={handleDeleteClick}
            onPageChange={page => fetchSheets(page)}
            authenticated={authenticated}
            onAuth={handleConnectAccount}
          />
        </Layout.Section>
      </Layout>

      {/* Delete sheet confirmation modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setPendingDeleteSheet(null);
        }}
        title="Disconnect sheet"
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
              setPendingDeleteSheet(null);
            }
          }
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to disconnect{' '}
            <Text as="span" fontWeight="semibold">
              {pendingDeleteSheet?.name}
            </Text>
            ? This will remove the sheet connection but won&apos;t delete any data.
          </Text>
        </Modal.Section>
      </Modal>

      {/* Disconnect account confirmation modal */}
      <Modal
        open={disconnectModalOpen}
        onClose={() => {
          setDisconnectModalOpen(false);
          setPendingDisconnectEmail(null);
        }}
        title="Disconnect account"
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
            }
          }
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to disconnect{' '}
            <Text as="span" fontWeight="semibold">
              {pendingDisconnectEmail}
            </Text>
            ? This will remove the account and all sheets connected through it.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
