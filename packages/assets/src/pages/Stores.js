import React, {useState, useEffect, useCallback, useRef} from 'react';
import {Page, Layout, Card, Banner, Modal, TextField, Text} from '@shopify/polaris';
import {api} from '../helpers/api';
import StoresFilterBar from './stores/StoresFilterBar';
import StoresTable from './stores/StoresTable';
import StoresPagination from './stores/StoresPagination';

const PAGE_LIMIT = 10;

/**
 * Stores Management Page
 * Stores are created automatically when merchants install the app via Shopify OAuth.
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
  const [error, setError] = useState(null);

  // Edit niche modal state
  const [editModalActive, setEditModalActive] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [editNicheValue, setEditNicheValue] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleEditClick = useCallback(store => {
    setEditStore(store);
    setEditNicheValue(store.niche || '');
    setEditModalActive(true);
  }, []);

  const handleEditModalClose = useCallback(() => {
    setEditModalActive(false);
    setEditStore(null);
    setEditNicheValue('');
  }, []);

  const handleEditSave = async () => {
    if (!editStore) return;
    try {
      setSaving(true);
      const response = await api(`/api/stores/${editStore.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({niche: editNicheValue.trim()})
      });
      const result = await response.json();
      if (result.success) {
        await fetchStores(pagination.page, activeSearch, nicheFilter);
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

  const {page = 1, total = 0, totalPages = 0} = pagination || {};

  return (
    <Page
      title="Shopify Stores"
      subtitle="Stores are added automatically when merchants install the app"
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
              onEditClick={handleEditClick}
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
        title={`Edit Niche — ${editStore?.name || ''}`}
        primaryAction={{
          content: 'Save',
          onAction: handleEditSave,
          loading: saving
        }}
        secondaryActions={[{content: 'Cancel', onAction: handleEditModalClose}]}
      >
        <Modal.Section>
          <Text as="p" tone="subdued">
            {editStore?.shopDomain}
          </Text>
          <div style={{marginTop: '12px'}}>
            <TextField
              label="Niche"
              value={editNicheValue}
              onChange={setEditNicheValue}
              autoComplete="off"
              placeholder="e.g. Fashion, Electronics, Home & Garden"
            />
          </div>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
