import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  Page,
  Layout,
  Card,
  Banner,
  Modal,
  TextField,
  Text,
  Badge,
  InlineStack,
  BlockStack
} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import StoresFilterBar from './stores/StoresFilterBar';
import StoresTable from './stores/StoresTable';
import StoresPagination from './stores/StoresPagination';
import StoreGroupManager from './stores/store-group-manager';

const PAGE_LIMIT = 10;
const TAB_STATUS = ['active', 'dead'];

/**
 * Stores Management Page
 * Stores are created automatically when merchants install the app via Shopify OAuth.
 */
export default function Stores() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);

  // Tab state: 0 = Active, 1 = Dead
  const [selectedTab, setSelectedTab] = useState(0);

  const [pagination, setPagination] = useState({page: 1, total: 0, totalPages: 0});
  const [searchValue, setSearchValue] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [nicheFilter, setNicheFilter] = useState([]);
  const [nicheInputValue, setNicheInputValue] = useState('');
  const [allNiches, setAllNiches] = useState([]);
  const searchTimerRef = useRef(null);
  const nichesFetchedRef = useRef(false);
  const lastStoresFetchKeyRef = useRef(null);
  const [error, setError] = useState(null);

  // Edit store modal state
  const [editModalActive, setEditModalActive] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editNicheValue, setEditNicheValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete store modal state
  const [deleteModalActive, setDeleteModalActive] = useState(false);
  const [deleteStore, setDeleteStore] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Balances map: storeId -> { currency, amount } | null
  const [balances, setBalances] = useState({});
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Webhook check state
  const [webhookModalActive, setWebhookModalActive] = useState(false);
  const [webhookResults, setWebhookResults] = useState(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookFixing, setWebhookFixing] = useState(false);

  // Recheck scopes state
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckModalActive, setRecheckModalActive] = useState(false);
  const [recheckResults, setRecheckResults] = useState(null);

  const currentStatus = TAB_STATUS[selectedTab];

  const fetchStores = async (page = 1, search = '', niches = [], status = currentStatus) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT)
      });
      if (search) params.set('search', search);
      if (niches.length > 0) params.set('niche', niches.join(','));
      if (status) params.set('status', status);
      // Non-admin: restrict to assigned stores only
      if (!isAdmin && user?.assignedStores?.length > 0) {
        params.set('storeIds', user.assignedStores.join(','));
      }

      const response = await api(`/api/stores?${params}`);
      const result = await response.json();
      if (result.success) {
        setStores(result.data || []);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  const fetchBalances = async () => {
    try {
      setBalancesLoading(true);
      const response = await api('/api/stores/balances');
      const result = await response.json();
      if (result.success) {
        setBalances(result.data || {});
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
    } finally {
      setBalancesLoading(false);
    }
  };

  const fetchNiches = async () => {
    try {
      const response = await api('/api/stores/niches');
      const result = await response.json();
      if (result.success) {
        setAllNiches(result.data);
      }
    } catch (err) {
      console.error('Error fetching niches:', err);
    }
  };

  useEffect(() => {
    if (nichesFetchedRef.current) return;
    nichesFetchedRef.current = true;
    fetchNiches();
    fetchBalances();
  }, []);

  useEffect(() => {
    const key = `${selectedTab}|${activeSearch}|${JSON.stringify(nicheFilter)}`;
    if (lastStoresFetchKeyRef.current === key) return;
    lastStoresFetchKeyRef.current = key;
    fetchStores(1, activeSearch, nicheFilter, TAB_STATUS[selectedTab]);
  }, [activeSearch, nicheFilter, selectedTab]);

  const handleTabChange = useCallback(index => {
    setSelectedTab(index);
    setPagination({page: 1, total: 0, totalPages: 0});
  }, []);

  const handleSearchChange = useCallback(value => {
    setSearchValue(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setActiveSearch(value);
    }, 400);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchValue('');
    setActiveSearch('');
  }, []);

  const handleNicheSelect = useCallback(selected => {
    setNicheFilter(prev => [...new Set([...prev, ...selected])]);
    setNicheInputValue('');
  }, []);

  const handleNicheRemove = useCallback(niche => {
    setNicheFilter(prev => prev.filter(n => n !== niche));
  }, []);

  const handleFiltersClearAll = useCallback(() => {
    setNicheFilter([]);
    setNicheInputValue('');
    setSearchValue('');
    setActiveSearch('');
  }, []);

  const handlePageChange = useCallback(
    newPage => {
      fetchStores(newPage, activeSearch, nicheFilter, currentStatus);
    },
    [activeSearch, nicheFilter, currentStatus]
  );

  const handleEditClick = useCallback(store => {
    setEditStore(store);
    setEditNameValue(store.name || '');
    setEditNicheValue(store.niche || '');
    setEditModalActive(true);
  }, []);

  const handleEditModalClose = useCallback(() => {
    setEditModalActive(false);
    setEditStore(null);
    setEditNameValue('');
    setEditNicheValue('');
  }, []);

  const handleEditSave = async () => {
    if (!editStore) return;
    try {
      setSaving(true);
      const response = await api(`/api/stores/${editStore.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: editNameValue.trim(), niche: editNicheValue.trim()})
      });
      const result = await response.json();
      if (result.success) {
        await fetchStores(pagination.page, activeSearch, nicheFilter, currentStatus);
        fetchNiches();
        handleEditModalClose();
      } else {
        setError(result.error || 'Failed to update store');
      }
    } catch (err) {
      console.error('Error updating store:', err);
      setError('Failed to update store');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = useCallback(store => {
    setDeleteStore(store);
    setDeleteModalActive(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteStore) return;
    try {
      setDeleting(true);
      const response = await api(`/api/stores/${deleteStore.id}`, {method: 'DELETE'});
      const result = await response.json();
      if (result.success) {
        await fetchStores(pagination.page, activeSearch, nicheFilter, currentStatus);
        setDeleteModalActive(false);
        setDeleteStore(null);
      } else {
        setError(result.error || 'Failed to delete store');
      }
    } catch (err) {
      console.error('Error deleting store:', err);
      setError('Failed to delete store');
    } finally {
      setDeleting(false);
    }
  };

  const handleCheckWebhooks = async () => {
    try {
      setWebhookLoading(true);
      setWebhookModalActive(true);
      const response = await api('/api/authMultip/webhooks/all');
      const result = await response.json();
      setWebhookResults(result);
    } catch (err) {
      setError('Failed to check webhooks');
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleFixAllWebhooks = async () => {
    try {
      setWebhookFixing(true);
      const response = await api('/api/authMultip/webhooks/fix-all', {method: 'POST'});
      const result = await response.json();
      setWebhookResults(result);
    } catch (err) {
      setError('Failed to fix webhooks');
    } finally {
      setWebhookFixing(false);
    }
  };

  const handleRecheckScopes = async () => {
    try {
      setRecheckLoading(true);
      setRecheckModalActive(true);
      setRecheckResults(null);
      const response = await api('/api/authMultip/check-scopes/all', {method: 'POST'});
      const result = await response.json();
      setRecheckResults(result);
      // Refresh stores list after recheck (status may have changed)
      lastStoresFetchKeyRef.current = null;
      await fetchStores(1, activeSearch, nicheFilter, currentStatus);
    } catch (err) {
      setError('Failed to recheck scopes');
    } finally {
      setRecheckLoading(false);
    }
  };

  const {page = 1, total = 0, totalPages = 0} = pagination || {};

  return (
    <Page
      title="Shopify Stores"
      subtitle="Stores are added automatically when merchants install the app"
      secondaryActions={[
        ...(isAdmin ? [{content: 'Manage Groups', onAction: () => setGroupManagerOpen(true)}] : []),
        {content: 'Check Webhooks', onAction: handleCheckWebhooks, loading: webhookLoading},
        {content: 'Recheck Scopes', onAction: handleRecheckScopes, loading: recheckLoading}
      ]}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card padding="0">
            <StoresFilterBar
              selectedTab={selectedTab}
              onTabChange={handleTabChange}
              searchValue={searchValue}
              onSearchChange={handleSearchChange}
              onSearchClear={handleSearchClear}
              nicheFilter={nicheFilter}
              nicheInputValue={nicheInputValue}
              onNicheInputChange={setNicheInputValue}
              allNiches={allNiches}
              onNicheSelect={handleNicheSelect}
              onNicheRemove={handleNicheRemove}
              onClearAll={handleFiltersClearAll}
            />
            <StoresTable
              stores={stores}
              loading={loading}
              activeSearch={activeSearch}
              nicheFilter={nicheFilter}
              balances={balances}
              balancesLoading={balancesLoading}
              onEditClick={handleEditClick}
              onDeleteClick={handleDeleteClick}
            />
            <StoresPagination
              page={page}
              total={total}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={editModalActive}
        onClose={handleEditModalClose}
        title={`Edit Store — ${editStore?.shopDomain || ''}`}
        primaryAction={{
          content: 'Save',
          onAction: handleEditSave,
          loading: saving
        }}
        secondaryActions={[{content: 'Cancel', onAction: handleEditModalClose}]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Store Name"
              value={editNameValue}
              onChange={setEditNameValue}
              autoComplete="off"
              placeholder="e.g. My Awesome Store"
            />
            <TextField
              label="Niche"
              value={editNicheValue}
              onChange={setEditNicheValue}
              autoComplete="off"
              placeholder="e.g. Fashion, Electronics, Home & Garden"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={deleteModalActive}
        onClose={() => {
          setDeleteModalActive(false);
          setDeleteStore(null);
        }}
        title="Delete Store"
        primaryAction={{
          content: 'Delete',
          destructive: true,
          onAction: handleDeleteConfirm,
          loading: deleting
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setDeleteModalActive(false);
              setDeleteStore(null);
            }
          }
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete <strong>{deleteStore?.name}</strong> (
            {deleteStore?.shopDomain})? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>

      {isAdmin && (
        <StoreGroupManager open={groupManagerOpen} onClose={() => setGroupManagerOpen(false)} />
      )}

      {/* Webhook check modal */}
      <Modal
        open={webhookModalActive}
        onClose={() => {
          setWebhookModalActive(false);
          setWebhookResults(null);
        }}
        title="Webhook Status"
        primaryAction={
          webhookResults?.needsFix > 0
            ? {content: 'Fix All Webhooks', onAction: handleFixAllWebhooks, loading: webhookFixing}
            : undefined
        }
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => {
              setWebhookModalActive(false);
              setWebhookResults(null);
            }
          }
        ]}
        large
      >
        <Modal.Section>
          {webhookLoading && <Text as="p">Checking webhooks for all stores...</Text>}
          {webhookResults && (
            <BlockStack gap="400">
              <InlineStack gap="400">
                <Badge tone="success">OK: {webhookResults.ok || 0}</Badge>
                <Badge tone={webhookResults.needsFix > 0 ? 'critical' : 'success'}>
                  Needs Fix: {webhookResults.needsFix || 0}
                </Badge>
                {webhookResults.fixed !== undefined && (
                  <Badge tone="info">Fixed: {webhookResults.fixed}</Badge>
                )}
                <Text as="span" tone="subdued">
                  Total: {webhookResults.total || 0}
                </Text>
              </InlineStack>
              {webhookResults.stores?.map(s => (
                <Card key={s.shop} padding="300">
                  <BlockStack gap="100">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="bold">
                          {s.shop}
                        </Text>
                        {s.installedVia && <Badge tone="info">{s.installedVia}</Badge>}
                      </InlineStack>
                      {s.error ? (
                        <Badge tone="warning">{s.error}</Badge>
                      ) : s.ok ? (
                        <Badge tone="success">OK</Badge>
                      ) : s.message === 'Already OK' ? (
                        <Badge tone="success">OK</Badge>
                      ) : s.fixed?.length > 0 ? (
                        <InlineStack gap="200">
                          <Badge tone="info">Fixed: {s.fixed.join(', ')}</Badge>
                          {s.errors?.length > 0 && (
                            <Badge tone="critical">Errors: {s.errors.join(', ')}</Badge>
                          )}
                        </InlineStack>
                      ) : s.errors?.length > 0 ? (
                        <Badge tone="critical">{s.errors.join(', ')}</Badge>
                      ) : (
                        <InlineStack gap="200">
                          {s.missing?.length > 0 && (
                            <Badge tone="critical">Missing: {s.missing.join(', ')}</Badge>
                          )}
                          {s.wrongAddress?.length > 0 && (
                            <Badge tone="warning">
                              Wrong URL: {s.wrongAddress.map(w => w.topic).join(', ')}
                            </Badge>
                          )}
                        </InlineStack>
                      )}
                    </InlineStack>
                    {s.registered && (
                      <Text variant="bodySm" tone="subdued">
                        Registered:{' '}
                        {s.registered.map(w => `${w.topic} → ${w.address}`).join(' | ') || 'none'}
                      </Text>
                    )}
                    {s.wrongAddress?.length > 0 && (
                      <Text variant="bodySm" tone="critical">
                        Wrong: {s.wrongAddress.map(w => `${w.topic}: ${w.current}`).join(' | ')}
                      </Text>
                    )}
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>

      {/* Recheck scopes modal */}
      <Modal
        open={recheckModalActive}
        onClose={() => {
          setRecheckModalActive(false);
          setRecheckResults(null);
        }}
        title="Recheck Scopes — Token Validity"
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => {
              setRecheckModalActive(false);
              setRecheckResults(null);
            }
          }
        ]}
        large
      >
        <Modal.Section>
          {recheckLoading && <Text as="p">Checking token validity for all stores...</Text>}
          {recheckResults && (
            <BlockStack gap="400">
              <InlineStack gap="400">
                <Badge tone="success">Alive: {recheckResults.alive || 0}</Badge>
                <Badge tone={recheckResults.dead > 0 ? 'critical' : 'success'}>
                  Dead: {recheckResults.dead || 0}
                </Badge>
                <Text as="span" tone="subdued">
                  Total: {recheckResults.total || 0}
                </Text>
              </InlineStack>
              {recheckResults.stores?.map(s => (
                <InlineStack key={s.shop} gap="300" blockAlign="center">
                  <Text variant="bodyMd" fontWeight="bold" as="span">
                    {s.shop}
                  </Text>
                  {s.alive ? (
                    <Badge tone="success">Alive</Badge>
                  ) : (
                    <Badge tone="critical">{s.reason || 'Dead'}</Badge>
                  )}
                </InlineStack>
              ))}
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
