import React, {useState, useEffect, useCallback, useRef} from 'react';
import {Page, Layout, Card, Banner, useIndexResourceState} from '@shopify/polaris';
import {api} from '../helpers/api';
import StoresFilterBar from './stores/StoresFilterBar';
import StoresTable from './stores/StoresTable';
import StoresPagination from './stores/StoresPagination';
import AddStoreModal from './stores/AddStoreModal';
import DeleteConfirmationModal from './stores/DeleteConfirmationModal';

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
  const [nicheInputValue, setNicheInputValue] = useState('');
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStores = async (page = 1, search = '', niches = []) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT)
      });
      if (search) params.set('search', search);
      if (niches.length > 0) params.set('niche', niches.join(','));

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

  const handleFormChange = useCallback(newFormData => {
    setFormData(newFormData);
    setVerified(false);
    setVerifiedInfo(null);
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

      const response = await api('/api/stores/verify-token', {
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

      const response = await api('/api/stores', {
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

      const response = await api('/api/stores/bulk-delete', {
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

  const {page = 1, total = 0, totalPages = 0} = pagination || {};

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
            <StoresFilterBar
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
              selectedResources={selectedResources}
              allResourcesSelected={allResourcesSelected}
              onSelectionChange={handleSelectionChange}
              onDeleteClick={handleDeleteClick}
              onBulkDeleteClick={handleBulkDeleteClick}
              onAddStore={handleModalOpen}
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

      <AddStoreModal
        active={modalActive}
        onClose={handleModalClose}
        formData={formData}
        onFormChange={handleFormChange}
        verified={verified}
        verifiedInfo={verifiedInfo}
        verifying={verifying}
        submitting={submitting}
        onVerify={handleVerifyToken}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmationModal
        active={deleteModalActive}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        deleteTarget={deleteTarget}
        selectedCount={selectedResources.length}
      />
    </Page>
  );
}
