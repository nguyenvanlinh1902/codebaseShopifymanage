import React, {useState, useEffect, useCallback, useMemo} from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Banner,
  EmptyState,
  Modal,
  SkeletonBodyText,
  ChoiceList,
  Tag,
  TextField,
  Pagination
} from '@shopify/polaris';
import {api} from '../../helpers/api';
import {usePermittedStores} from '../../hooks/usePermittedStores';

const PAGE_SIZE = 10;

/**
 * Account management — scoped to a single provider ('outlook' | 'gmail').
 */
export default function AccountManagement({provider = 'outlook', onAccountChange}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Search & pagination
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);

  // Store assignment
  const {stores} = usePermittedStores();
  const [storeModalAccount, setStoreModalAccount] = useState(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [savingStores, setSavingStores] = useState(false);

  const providerLabel = provider === 'gmail' ? 'Gmail' : 'Outlook / Hotmail';
  const base = provider === 'gmail' ? '/api/gmail' : '/api/outlook';
  const callbackType =
    provider === 'gmail' ? 'gmail-auth-callback' : 'outlook-auth-callback';

  const storeMap = useMemo(() => (stores || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {}), [stores]);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api(`${base}/accounts`);
      const result = await res.json();
      if (result.success) setAccounts(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [base]);

  // Auto ensure watch for all Gmail accounts on load (fire-and-forget).
  useEffect(() => {
    if (provider !== 'gmail') return;
    api('/api/gmail/watch/start-all', {method: 'POST', body: JSON.stringify({})})
      .then(r => r.json())
      .then(r => {
        if (r?.success && r.data?.total > 0) {
          console.log(
            `[Gmail] Ensured watch: ${r.data.succeeded}/${r.data.total} (failed: ${r.data.failed})`
          );
        }
      })
      .catch(() => {});
  }, [provider]);

  const handleStartAll = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await api(`${base}/watch/start-all`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      const {succeeded, failed, total} = result.data;
      setSuccess(`Watch ensured: ${succeeded}/${total} (failed: ${failed})`);
      fetchAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const connectAccount = useCallback(
    async loginHint => {
      try {
        setError(null);
        const url = loginHint
          ? `${base}/auth-url?login_hint=${encodeURIComponent(loginHint)}`
          : `${base}/auth-url`;
        const res = await api(url);
        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        const w = 500;
        const h = 600;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(
          result.data.authUrl,
          `${provider}-auth`,
          `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`
        );

        const handleMessage = event => {
          if (event.data?.type === callbackType) {
            window.removeEventListener('message', handleMessage);
            if (event.data.success) {
              setSuccess(
                `Connected ${event.data.googleEmail || event.data.email || 'account'}`
              );
              fetchAccounts();
              onAccountChange?.();
            } else {
              setError(event.data.error || `Failed to connect ${providerLabel}`);
            }
          }
        };
        window.addEventListener('message', handleMessage);
      } catch (err) {
        setError(err.message);
      }
    },
    [base, callbackType, provider, providerLabel, fetchAccounts, onAccountChange]
  );

  const handleStartWatch = async email => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await api(`${base}/watch`, {
        method: 'POST',
        body: JSON.stringify({email})
      });
      const result = await res.json();
      if (!result.success) {
        if (result.code === 'TOKEN_EXPIRED') {
          setError(`Token expired for ${email}. Please reconnect the account.`);
          fetchAccounts();
          return;
        }
        throw new Error(result.error);
      }
      setSuccess(`Watch started for ${email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async account => {
    try {
      setActionLoading(true);
      const res = await api(`${base}/disconnect`, {
        method: 'POST',
        body: JSON.stringify({email: account.email})
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setSuccess(`Deleted ${account.email}`);
      setDeleteConfirm(null);
      fetchAccounts();
      onAccountChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openStoreModal = account => {
    setStoreModalAccount(account);
    setSelectedStoreIds(account.linkedStoreIds || []);
  };

  const handleSaveStores = async () => {
    if (!storeModalAccount) return;
    try {
      setSavingStores(true);
      const res = await api(`${base}/linked-stores`, {
        method: 'PUT',
        body: JSON.stringify({email: storeModalAccount.email, linkedStoreIds: selectedStoreIds})
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setSuccess(`Stores updated for ${storeModalAccount.email}`);
      setStoreModalAccount(null);
      fetchAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingStores(false);
    }
  };

  // Filter + paginate
  const filteredAccounts = useMemo(() => {
    if (!searchValue.trim()) return accounts;
    const q = searchValue.toLowerCase();
    return accounts.filter(a => {
      if (a.email?.toLowerCase().includes(q)) return true;
      // Search by linked store name
      const linkedNames = (a.linkedStoreIds || [])
        .map(id => storeMap[id]?.name || storeMap[id]?.shopDomain || '')
        .join(' ')
        .toLowerCase();
      return linkedNames.includes(q);
    });
  }, [accounts, searchValue, storeMap]);

  const totalPages = Math.ceil(filteredAccounts.length / PAGE_SIZE);
  const paginatedAccounts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAccounts.slice(start, start + PAGE_SIZE);
  }, [filteredAccounts, page]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [searchValue]);

  if (loading) {
    return (
      <Card>
        <BlockStack gap="400">
          <SkeletonBodyText lines={5} />
        </BlockStack>
      </Card>
    );
  }

  const storeChoices = (stores || []).map(s => ({
    label: s.name || s.shopDomain,
    value: s.id
  }));

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text as="h2" variant="headingMd">
              Connected {providerLabel} Accounts
            </Text>
            <InlineStack gap="200">
              {provider === 'gmail' && accounts.length > 0 && (
                <Button onClick={handleStartAll} loading={actionLoading}>
                  Start Watch for All
                </Button>
              )}
              <Button onClick={() => connectAccount()} variant="primary">
                Connect {providerLabel}
              </Button>
            </InlineStack>
          </InlineStack>

          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}
          {success && (
            <Banner tone="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Banner>
          )}

          {/* Search */}
          {accounts.length > 0 && (
            <TextField
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search by email or store name..."
              clearButton
              onClearButtonClick={() => setSearchValue('')}
              autoComplete="off"
            />
          )}

          {filteredAccounts.length === 0 ? (
            accounts.length === 0 ? (
              <EmptyState heading={`No ${providerLabel} accounts connected`} image="">
                <p>
                  Connect a {providerLabel} account to browse emails and set up Discord
                  forwarding.
                </p>
              </EmptyState>
            ) : (
              <EmptyState heading="No results found" image="">
                <p>Try a different search term.</p>
              </EmptyState>
            )
          ) : (
            <>
              <IndexTable
                resourceName={{singular: 'account', plural: 'accounts'}}
                itemCount={paginatedAccounts.length}
                headings={[
                  {title: 'Email'},
                  {title: 'Stores'},
                  {title: 'Status'},
                  {title: 'Connected'},
                  {title: 'Last Refreshed'},
                  {title: 'Actions'}
                ]}
                selectable={false}
              >
                {paginatedAccounts.map((account, index) => (
                  <IndexTable.Row id={account.email} key={account.email} position={index}>
                    <IndexTable.Cell>
                      <Text fontWeight="bold">{account.email}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="100" wrap>
                        {(account.linkedStoreIds || []).length > 0 ? (
                          (account.linkedStoreIds || []).map(sid => {
                            const store = storeMap[sid];
                            const storeName = store?.name || store?.shopDomain || sid;
                            const isDead = store?.status === 'dead';
                            return (
                              <Tag key={sid}>
                                <InlineStack gap="100" blockAlign="center">
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      backgroundColor: isDead ? '#d72c0d' : '#008060',
                                      flexShrink: 0
                                    }}
                                  />
                                  {storeName}
                                </InlineStack>
                              </Tag>
                            );
                          })
                        ) : (
                          <Text tone="subdued" variant="bodySm">—</Text>
                        )}
                        <Button
                          onClick={() => openStoreModal(account)}
                          size="micro"
                          variant="plain"
                        >
                          Edit
                        </Button>
                      </InlineStack>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={account.authStatus === 'expired' ? 'critical' : 'success'}>
                        {account.authStatus === 'expired' ? 'Expired' : 'Active'}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {account.connectedAt
                          ? new Date(account.connectedAt).toLocaleDateString()
                          : '-'}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {account.lastRefreshed
                          ? new Date(account.lastRefreshed).toLocaleString()
                          : '-'}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="200">
                        {account.authStatus === 'expired' ? (
                          <Button
                            onClick={() => connectAccount(account.email)}
                            size="slim"
                            variant="primary"
                            tone="critical"
                          >
                            Reconnect
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleStartWatch(account.email)}
                            size="slim"
                            loading={actionLoading}
                          >
                            Start Watch
                          </Button>
                        )}
                        <Button
                          onClick={() => setDeleteConfirm(account)}
                          size="slim"
                          tone="critical"
                        >
                          Delete
                        </Button>
                      </InlineStack>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{padding: '12px 0', borderTop: '1px solid #e1e3e5'}}>
                  <InlineStack align="center" blockAlign="center" gap="400">
                    <Text as="span" tone="subdued">
                      {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredAccounts.length)} of {filteredAccounts.length}
                    </Text>
                    <Pagination
                      hasPrevious={page > 1}
                      hasNext={page < totalPages}
                      onPrevious={() => setPage(p => p - 1)}
                      onNext={() => setPage(p => p + 1)}
                    />
                  </InlineStack>
                </div>
              )}
            </>
          )}
        </BlockStack>
      </Card>

      {deleteConfirm && (
        <Modal
          open
          onClose={() => setDeleteConfirm(null)}
          title={`Delete ${providerLabel} account?`}
          primaryAction={{
            content: 'Delete',
            destructive: true,
            loading: actionLoading,
            onAction: () => handleDelete(deleteConfirm)
          }}
          secondaryActions={[{content: 'Cancel', onAction: () => setDeleteConfirm(null)}]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete <strong>{deleteConfirm.email}</strong>? This
              will remove the account, stop any active email watches and Discord forwarding.
            </Text>
          </Modal.Section>
        </Modal>
      )}

      {storeModalAccount && (
        <Modal
          open
          onClose={() => setStoreModalAccount(null)}
          title={`Assign stores — ${storeModalAccount.email}`}
          primaryAction={{
            content: 'Save',
            onAction: handleSaveStores,
            loading: savingStores
          }}
          secondaryActions={[{content: 'Cancel', onAction: () => setStoreModalAccount(null)}]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text variant="bodySm" tone="subdued">
                Select one or more stores to link with this email account.
              </Text>
              {storeChoices.length > 0 ? (
                <ChoiceList
                  title="Stores"
                  titleHidden
                  allowMultiple
                  choices={storeChoices}
                  selected={selectedStoreIds}
                  onChange={setSelectedStoreIds}
                />
              ) : (
                <Text tone="subdued">No stores available.</Text>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
}

AccountManagement.propTypes = {
  provider: PropTypes.oneOf(['outlook', 'gmail']),
  onAccountChange: PropTypes.func
};
