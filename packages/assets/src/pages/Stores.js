import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Button,
  Modal,
  TextField,
  FormLayout,
  Banner,
  SkeletonBodyText,
  EmptyState,
  Badge,
  InlineStack,
  Text,
  Pagination,
  Autocomplete,
  Tag,
  BlockStack,
  IndexFilters,
  useSetIndexFiltersMode,
  useIndexResourceState
} from '@shopify/polaris';
import {DeleteIcon} from '@shopify/polaris-icons';
import {fetchApi} from '../helpers/fetchApi';

const PAGE_LIMIT = 10;

/**
 * Stores Management Page
 */
export default function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({page: 1, total: 0, totalPages: 0});
  const [searchValue, setSearchValue] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [nicheFilter, setNicheFilter] = useState([]);
  const [allNiches, setAllNiches] = useState([]);
  const searchTimerRef = useRef(null);
  const nichesFetchedRef = useRef(false);
  const lastStoresFetchKeyRef = useRef(null);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection
  } = useIndexResourceState(stores);

  const [modalActive, setModalActive] = useState(false);
  const [formData, setFormData] = useState({
    shopDomain: '',
    accessToken: '',
    apiSecret: '',
    name: '',
    niche: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifiedInfo, setVerifiedInfo] = useState(null);
  const [error, setError] = useState(null);

  const [deleteModalActive, setDeleteModalActive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // null = bulk, storeId = single
  const [deleting, setDeleting] = useState(false);

  const {mode, setMode} = useSetIndexFiltersMode();

  const fetchStores = async (page = 1, search = '', niches = []) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT)
      });
      if (search) params.set('search', search);
      if (niches.length > 0) params.set('niche', niches.join(','));

      const response = await fetchApi(`/api/stores?${params}`);
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

  const fetchNiches = async () => {
    try {
      const response = await fetchApi('/api/stores/niches');
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
  }, []);

  useEffect(() => {
    const key = `${activeSearch}|${JSON.stringify(nicheFilter)}`;
    if (lastStoresFetchKeyRef.current === key) return;
    lastStoresFetchKeyRef.current = key;
    fetchStores(1, activeSearch, nicheFilter);
  }, [activeSearch, nicheFilter]);

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

  const [nicheInputValue, setNicheInputValue] = useState('');

  const nicheOptions = useMemo(() => {
    const filtered = nicheInputValue
      ? allNiches.filter(n => n.toLowerCase().includes(nicheInputValue.toLowerCase()))
      : allNiches;
    return filtered.filter(n => !nicheFilter.includes(n)).map(n => ({value: n, label: n}));
  }, [allNiches, nicheInputValue, nicheFilter]);

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
      fetchStores(newPage, activeSearch, nicheFilter);
    },
    [activeSearch, nicheFilter]
  );

  const nicheFilterMarkup = (
    <BlockStack gap="200">
      <Autocomplete
        allowMultiple
        options={nicheOptions}
        selected={nicheFilter}
        onSelect={handleNicheSelect}
        textField={
          <Autocomplete.TextField
            onChange={setNicheInputValue}
            value={nicheInputValue}
            placeholder="Search niches..."
            autoComplete="off"
          />
        }
      />
      <InlineStack gap="100" wrap>
        {nicheFilter.map(niche => (
          <Tag key={niche} onRemove={() => handleNicheRemove(niche)}>
            {niche}
          </Tag>
        ))}
      </InlineStack>
    </BlockStack>
  );

  const filters = [
    {
      key: 'niche',
      label: 'Niche',
      filter: nicheFilterMarkup,
      shortcut: true
    }
  ];

  const appliedFilters =
    nicheFilter.length > 0
      ? [
          {
            key: 'niche',
            label: `Niche: ${nicheFilter.join(', ')}`,
            onRemove: () => setNicheFilter([])
          }
        ]
      : [];

  const handleModalOpen = useCallback(() => {
    setModalActive(true);
    setError(null);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalActive(false);
    setFormData({shopDomain: '', accessToken: '', apiSecret: '', name: '', niche: ''});
    setVerified(false);
    setVerifiedInfo(null);
    setError(null);
  }, []);

  const handleVerifyToken = async () => {
    if (!formData.accessToken) {
      setError('Please enter an access token');
      return;
    }

    if (!formData.shopDomain) {
      setError('Please enter your shop domain');
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      const response = await fetchApi('/api/stores/verify-token', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          accessToken: formData.accessToken,
          shopDomain: formData.shopDomain
        })
      });

      const result = await response.json();

      if (result.success) {
        setVerified(true);
        setVerifiedInfo(result.data);
        setFormData({
          ...formData,
          shopDomain: result.data.shopDomain,
          name: formData.name || result.data.shopName
        });
      } else {
        setError(result.error || 'Failed to verify token');
        setVerified(false);
      }
    } catch (err) {
      console.error('Error verifying token:', err);
      setError('Failed to verify token');
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetchApi('/api/stores', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          ...formData
        })
      });

      const result = await response.json();

      if (result.success) {
        await fetchStores(1, activeSearch, nicheFilter);
        fetchNiches();
        handleModalClose();
      } else {
        setError(result.error || 'Failed to add store');
      }
    } catch (err) {
      console.error('Error adding store:', err);
      setError('Failed to add store');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = useCallback(storeId => {
    setDeleteTarget(storeId);
    setDeleteModalActive(true);
  }, []);

  const handleBulkDeleteClick = useCallback(() => {
    setDeleteTarget(null);
    setDeleteModalActive(true);
  }, []);

  const handleDeleteModalClose = useCallback(() => {
    setDeleteModalActive(false);
    setDeleteTarget(null);
  }, []);

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      const idsToDelete = deleteTarget ? [deleteTarget] : selectedResources;

      const response = await fetchApi('/api/stores/bulk-delete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({storeIds: idsToDelete})
      });

      const result = await response.json();

      if (result.success) {
        clearSelection();
        await fetchStores(pagination.page, activeSearch, nicheFilter);
        fetchNiches();
      } else {
        setError(result.error || 'Failed to delete store(s)');
      }
    } catch (err) {
      console.error('Error deleting store(s):', err);
      setError('Failed to delete store(s)');
    } finally {
      setDeleting(false);
      handleDeleteModalClose();
    }
  };

  const promotedBulkActions = [
    {
      content: `Delete ${selectedResources.length} store(s)`,
      onAction: handleBulkDeleteClick,
      destructive: true
    }
  ];

  const deleteModalMessage = deleteTarget
    ? `Are you sure you want to delete this store? This will also remove all associated webhooks and sync configurations.`
    : `Are you sure you want to delete ${selectedResources.length} store(s)? This will also remove all associated webhooks and sync configurations.`;

  const resourceName = {singular: 'store', plural: 'stores'};
  const {page = 1, total = 0, totalPages = 0} = pagination || {};

  const rowMarkup = stores.map((store, index) => (
    <IndexTable.Row
      id={store.id}
      key={store.id}
      position={index}
      selected={selectedResources.includes(store.id)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold">
          {store.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{store.shopDomain}</IndexTable.Cell>
      <IndexTable.Cell>{store.niche || '-'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={store.status === 'active' ? 'success' : 'warning'}>{store.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack align="center">
          <Button
            icon={DeleteIcon}
            tone="critical"
            variant="plain"
            onClick={e => {
              e.stopPropagation();
              handleDeleteClick(store.id);
            }}
            accessibilityLabel={`Delete ${store.name}`}
          />
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Shopify Stores"
      subtitle="Manage your connected Shopify stores"
      primaryAction={{
        content: 'Add Store',
        onAction: handleModalOpen
      }}
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
            <IndexFilters
              queryValue={searchValue}
              queryPlaceholder="Search by store name or domain..."
              onQueryChange={handleSearchChange}
              onQueryClear={handleSearchClear}
              filters={filters}
              appliedFilters={appliedFilters}
              onClearAll={handleFiltersClearAll}
              mode={mode}
              setMode={setMode}
              cancelAction={{
                onAction: () => {
                  handleFiltersClearAll();
                  setMode('DEFAULT');
                }
              }}
              tabs={[]}
              selected={0}
              canCreateNewView={false}
            />
            {loading ? (
              <div style={{padding: '16px'}}>
                <SkeletonBodyText lines={5} />
              </div>
            ) : stores.length === 0 ? (
              activeSearch || nicheFilter.length > 0 ? (
                <EmptyState heading="No stores found" image="">
                  <p>Try a different search term or filter.</p>
                </EmptyState>
              ) : (
                <EmptyState
                  heading="No stores connected"
                  action={{content: 'Add Store', onAction: handleModalOpen}}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Add your first Shopify store to get started.</p>
                </EmptyState>
              )
            ) : (
              <>
                <IndexTable
                  resourceName={resourceName}
                  itemCount={stores.length}
                  headings={[
                    {title: 'Name'},
                    {title: 'Shop Domain'},
                    {title: 'Niche'},
                    {title: 'Status'},
                    {title: 'Actions', alignment: 'center'}
                  ]}
                  selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                  onSelectionChange={handleSelectionChange}
                  promotedBulkActions={promotedBulkActions}
                >
                  {rowMarkup}
                </IndexTable>
                {totalPages > 1 && (
                  <div style={{padding: '16px', borderTop: '1px solid #e1e3e5'}}>
                    <InlineStack align="center" blockAlign="center" gap="400">
                      <Text as="span" tone="subdued">
                        {(page - 1) * PAGE_LIMIT + 1}-{Math.min(page * PAGE_LIMIT, total)} of{' '}
                        {total}
                      </Text>
                      <Pagination
                        hasPrevious={page > 1}
                        hasNext={page < totalPages}
                        onPrevious={() => handlePageChange(page - 1)}
                        onNext={() => handlePageChange(page + 1)}
                      />
                    </InlineStack>
                  </div>
                )}
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalActive}
        onClose={handleModalClose}
        title="Add Shopify Store"
        primaryAction={{
          content: 'Add Store',
          onAction: handleSubmit,
          loading: submitting
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: handleModalClose
          }
        ]}
      >
        <Modal.Section>
          <FormLayout>
            {!verified && (
              <Banner tone="info">
                <p>
                  <strong>How to get credentials:</strong>
                </p>
                <p>
                  1. Go to Shopify Admin → Settings → Apps and sales channels
                  <br />
                  2. Click &quot;Develop apps&quot; → &quot;Create an app&quot;
                  <br />
                  3. Configure scopes → Install app → Reveal token once
                  <br />
                  4. Copy your shop domain and Admin API access token
                </p>
              </Banner>
            )}

            {verified && verifiedInfo && (
              <Banner tone="success">
                <p>
                  <strong>✓ Verified:</strong> {verifiedInfo.shopName}
                  <br />
                  Domain: {verifiedInfo.myshopifyDomain}
                  <br />
                  Email: {verifiedInfo.email}
                </p>
              </Banner>
            )}

            <TextField
              label="Shop Domain"
              value={formData.shopDomain}
              onChange={value => {
                setFormData({...formData, shopDomain: value});
                setVerified(false);
                setVerifiedInfo(null);
              }}
              placeholder="mystore or mystore.myshopify.com"
              helpText="Enter any format: 'mystore', 'mystore.myshopify.com', or full URL - we'll normalize it"
              required
              autoComplete="off"
            />

            <TextField
              label="Access Token"
              value={formData.accessToken}
              onChange={value => {
                setFormData({...formData, accessToken: value});
                setVerified(false);
                setVerifiedInfo(null);
              }}
              placeholder="shpat_..."
              helpText="Your Shopify Admin API access token from Custom App"
              type="password"
              required
              autoComplete="off"
              connectedRight={
                <Button
                  onClick={handleVerifyToken}
                  loading={verifying}
                  disabled={!formData.accessToken || !formData.shopDomain}
                >
                  {verified ? 'Re-verify' : 'Verify Store'}
                </Button>
              }
            />

            <TextField
              label="API Secret Key"
              value={formData.apiSecret}
              onChange={value => setFormData({...formData, apiSecret: value})}
              placeholder="Your Shopify app API secret key"
              helpText="Found in your Shopify app settings. Required for webhook verification."
              type="password"
              autoComplete="off"
            />

            <TextField
              label="Store Name"
              value={formData.name}
              onChange={value => setFormData({...formData, name: value})}
              placeholder="My Store"
              helpText="A friendly name for your store (auto-filled from verification)"
            />

            <TextField
              label="Niche"
              value={formData.niche}
              onChange={value => setFormData({...formData, niche: value})}
              placeholder="Electronics, Fashion, etc."
              helpText="Product niche or category (optional)"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      <Modal
        open={deleteModalActive}
        onClose={handleDeleteModalClose}
        title="Delete store(s)"
        primaryAction={{
          content: 'Delete',
          onAction: handleDeleteConfirm,
          loading: deleting,
          destructive: true
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: handleDeleteModalClose
          }
        ]}
      >
        <Modal.Section>
          <Text>{deleteModalMessage}</Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
