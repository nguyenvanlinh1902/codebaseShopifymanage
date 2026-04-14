import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Card,
  IndexTable,
  TextField,
  Select,
  InlineStack,
  Text,
  Button,
  Badge,
  SkeletonBodyText,
  EmptyState,
  BlockStack,
  Banner,
  Box
} from '@shopify/polaris';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';

export default function Collections() {
  const navigate = useNavigate();
  const {stores} = usePermittedStores();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedStore, setSelectedStore] = useState(
    () => searchParams.get('store') || localStorage.getItem('collections_last_store') || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({
    hasNextPage: false,
    hasPreviousPage: false,
    endCursor: null,
    startCursor: null
  });
  const [cursor, setCursor] = useState(null);
  const [prevCursors, setPrevCursors] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchCollections(null);
    setPrevCursors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, debouncedSearch]);

  const fetchCollections = useCallback(
    async after => {
      if (!selectedStore) {
        setCollections([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({storeId: selectedStore});
        if (debouncedSearch) params.append('query', debouncedSearch);
        if (after) params.append('after', after);
        const res = await api(`/api/collections/list?${params}`);
        const result = await res.json();
        if (result.success) {
          setCollections(result.data?.collections || []);
          setPageInfo(result.data?.pageInfo || {});
          setCursor(after);
        } else {
          setError(result.error || 'Failed to load collections');
        }
      } catch (err) {
        setError('Failed to load collections');
      } finally {
        setLoading(false);
      }
    },
    [selectedStore, debouncedSearch]
  );

  const handleStoreChange = useCallback(
    value => {
      setSelectedStore(value);
      setSearchParams(value ? {store: value} : {});
      if (value) localStorage.setItem('collections_last_store', value);
    },
    [setSearchParams]
  );

  const handleNext = () => {
    if (pageInfo.endCursor) {
      setPrevCursors(prev => [...prev, cursor]);
      fetchCollections(pageInfo.endCursor);
    }
  };

  const handlePrev = () => {
    const prev = [...prevCursors];
    const prevCursor = prev.pop();
    setPrevCursors(prev);
    fetchCollections(prevCursor || null);
  };

  const storeOptions = [
    {label: 'Select a store...', value: ''},
    ...stores.map(s => ({label: `${s.name} (${s.shopDomain})`, value: s.id}))
  ];

  const rowMarkup = collections.map((collection, index) => (
    <IndexTable.Row
      id={collection.id}
      key={collection.id}
      position={index}
      onClick={() => navigate(`/collections/${collection.id.split('/').pop()}?store=${selectedStore}`)}
    >
      <IndexTable.Cell>
        <Text fontWeight="semibold">{collection.title}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{collection.productsCount ?? 0}</IndexTable.Cell>
      <IndexTable.Cell>
        {collection.type === 'smart' && collection.ruleSet?.rules?.length > 0
          ? collection.ruleSet.rules.map(r => `${r.column} ${r.relation} ${r.condition}`).join(', ')
          : collection.type === 'smart'
          ? 'Smart'
          : '—'}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={collection.type === 'smart' ? 'info' : 'subdued'}>
          {collection.type === 'smart' ? 'Automated' : 'Manual'}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Collections"
      primaryAction={{content: 'Add collection', onAction: () => navigate(selectedStore ? `/collections/new?store=${selectedStore}` : '/collections/new')}}
      fullWidth
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
        <Card>
          <InlineStack align="space-between" blockAlign="center" gap="400" wrap>
            <div className="filter-item filter-item--lg">
              <Select
                label="Store"
                labelHidden
                options={storeOptions}
                value={selectedStore}
                onChange={handleStoreChange}
              />
            </div>
            <div className="filter-item filter-item--lg">
              <TextField
                label="Search"
                labelHidden
                placeholder="Search collections"
                value={searchQuery}
                onChange={setSearchQuery}
                clearButton
                onClearButtonClick={() => setSearchQuery('')}
                autoComplete="off"
              />
            </div>
          </InlineStack>
        </Card>

        <Card>
          {!selectedStore ? (
            <EmptyState heading="Select a store" image="">
              <p>Choose a store to view its collections.</p>
            </EmptyState>
          ) : loading ? (
            <SkeletonBodyText lines={6} />
          ) : collections.length === 0 ? (
            <EmptyState
              heading="No collections found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{content: 'Add collection', onAction: () => navigate('/collections/new')}}
            >
              <p>Create a collection to organize your products.</p>
            </EmptyState>
          ) : (
            <>
              <IndexTable
                resourceName={{singular: 'collection', plural: 'collections'}}
                itemCount={collections.length}
                selectable={false}
                headings={[
                  {title: 'Title'},
                  {title: 'Products'},
                  {title: 'Conditions'},
                  {title: 'Type'}
                ]}
              >
                {rowMarkup}
              </IndexTable>
              <Box padding="400">
                <InlineStack align="end" gap="200">
                  <Button
                    size="slim"
                    onClick={handlePrev}
                    disabled={prevCursors.length === 0 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    size="slim"
                    onClick={handleNext}
                    disabled={!pageInfo.hasNextPage || loading}
                  >
                    Next
                  </Button>
                </InlineStack>
              </Box>
            </>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
