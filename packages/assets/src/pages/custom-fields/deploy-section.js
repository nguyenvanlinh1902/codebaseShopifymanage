import React, {useState, useCallback, useEffect, useMemo} from 'react';
import {
  Card, BlockStack, InlineStack, Text, Button, Badge,
  Spinner, Banner, Divider, Select, Box, Checkbox
} from '@shopify/polaris';
import {usePermittedStores} from '../../hooks/usePermittedStores';
import {api} from '../../helpers/api';

export default function DeploySection({fields}) {
  const {stores, loading: storesLoading} = usePermittedStores();
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);

  const allFieldIds = useMemo(() => (fields || []).map(f => f.id), [fields]);

  useEffect(() => {
    setSelectedFieldIds(prev => {
      const filtered = prev.filter(id => allFieldIds.includes(id));
      return filtered.length === prev.length && prev.length > 0 ? prev : allFieldIds;
    });
  }, [allFieldIds]);

  const toggleField = (fieldId) => {
    setSelectedFieldIds(prev =>
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    );
  };

  const toggleAllFields = () => {
    setSelectedFieldIds(prev => prev.length === allFieldIds.length ? [] : allFieldIds);
  };

  // Load collections when store selected
  const loadCollections = useCallback(async (storeId) => {
    if (!storeId) { setCollections([]); return; }
    setCollectionsLoading(true);
    setError('');
    try {
      const res = await api(`/api/custom-fields/collections/${storeId}`);
      const data = await res.json();
      if (data.success) setCollections(data.data || []);
      else setError(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  const handleStoreChange = (value) => {
    setSelectedStoreId(value);
    setDeployResult(null);
    setCollections([]);
    if (value) loadCollections(value);
  };

  const handleDeploy = async () => {
    if (!selectedStoreId) return;
    setDeploying(true);
    setDeployResult(null);
    setError('');
    try {
      const res = await api('/api/custom-fields/deploy', {
        method: 'POST',
        body: JSON.stringify({storeIds: [selectedStoreId], fieldIds: selectedFieldIds})
      });
      const data = await res.json();
      if (data.success) {
        setDeployResult(data.data[0]);
        loadCollections(selectedStoreId);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  };

  const updateCollectionFields = async (collectionId, nextFieldKeys) => {
    console.log('[DeploySection] updateCollectionFields →', {collectionId, nextFieldKeys, storeId: selectedStoreId});
    setTogglingId(collectionId);
    try {
      const res = await api(`/api/custom-fields/collections/${selectedStoreId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({collectionId, fieldKeys: nextFieldKeys})
      });
      const data = await res.json();
      console.log('[DeploySection] toggle response', res.status, data);
      if (data.success) {
        setCollections(prev => prev.map(c =>
          c.id === collectionId ? {...c, fieldKeys: data.data.fieldKeys} : c
        ));
      } else {
        setError(data.error || `Failed (${res.status})`);
      }
    } catch (err) {
      console.error('[DeploySection] toggle error', err);
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const toggleCollectionField = (collection, fieldKey) => {
    const current = collection.fieldKeys || [];
    const next = current.includes(fieldKey)
      ? current.filter(k => k !== fieldKey)
      : [...current, fieldKey];
    console.log('[DeploySection] toggleCollectionField', {collection: collection.id, fieldKey, current, next});
    updateCollectionFields(collection.id, next);
  };


  const storeOptions = [{label: 'Select a store...', value: ''}, ...(stores || []).map(s => ({
    label: `${s.name || s.shopDomain} (${s.shopDomain})`,
    value: s.id
  }))];

  const hasFields = fields?.length > 0;
  const enabledCount = collections.filter(c => (c.fieldKeys || []).length > 0).length;

  return (
    <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">Manage by Store</Text>

          {!hasFields && (
            <Banner tone="warning">Define at least one custom field above first.</Banner>
          )}

          {storesLoading ? (
            <Spinner size="small" />
          ) : (
            <BlockStack gap="400">
              <InlineStack gap="300" blockAlign="end">
                <div style={{flex: 1}}>
                  <Select label="Store" options={storeOptions} value={selectedStoreId} onChange={handleStoreChange} />
                </div>
                <Button variant="primary" onClick={handleDeploy} loading={deploying} disabled={!selectedStoreId || !hasFields || selectedFieldIds.length === 0}>
                  Setup Store
                </Button>
              </InlineStack>

              {hasFields && (
                <Box borderWidth="025" borderColor="border" borderRadius="200" padding="300">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">Fields to setup</Text>
                      <Button variant="plain" onClick={toggleAllFields}>
                        {selectedFieldIds.length === allFieldIds.length ? 'Clear all' : 'Select all'}
                      </Button>
                    </InlineStack>
                    <BlockStack gap="100">
                      {fields.map(f => (
                        <Checkbox
                          key={f.id}
                          label={`${f.label}${f.required ? ' *' : ''}`}
                          checked={selectedFieldIds.includes(f.id)}
                          onChange={() => toggleField(f.id)}
                        />
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Box>
              )}

              {deployResult && (
                <Banner tone={deployResult.status === 'success' ? 'success' : 'critical'} onDismiss={() => setDeployResult(null)}>
                  <p>
                    {deployResult.status === 'success' && !deployResult.errors?.length && 'Store setup complete. '}
                    {deployResult.storefrontToken && `Storefront token: ${deployResult.storefrontToken}. `}
                    {deployResult.errors?.length > 0 && deployResult.errors.join('; ')}
                  </p>
                </Banner>
              )}

              {/* Collections list */}
              {selectedStoreId && (
                <>
                  <Divider />
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingSm">Collections</Text>
                    {enabledCount > 0 && <Badge tone="success">{enabledCount} enabled</Badge>}
                  </InlineStack>

                  {collectionsLoading ? (
                    <BlockStack align="center" inlineAlign="center"><Spinner size="small" /></BlockStack>
                  ) : collections.length === 0 ? (
                    <Text tone="subdued">No collections found. Setup the store first.</Text>
                  ) : (
                    <Box borderWidth="025" borderColor="border" borderRadius="200" overflow="hidden">
                      <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                        {collections.map((col) => {
                          const count = (col.fieldKeys || []).length;
                          const isBusy = togglingId === col.id;
                          return (
                            <Box key={col.id} padding="300" borderBlockStartWidth="025" borderColor="border">
                              <InlineStack align="space-between" blockAlign="center" wrap={false} gap="300">
                                <BlockStack gap="050">
                                  <Text variant="bodySm" fontWeight="semibold">{col.title}</Text>
                                  <Text variant="bodySm" tone="subdued">{col.productsCount} products</Text>
                                </BlockStack>
                                <InlineStack gap="300" blockAlign="center" wrap>
                                  {fields.map(f => (
                                    <Checkbox
                                      key={f.id}
                                      label={f.label}
                                      checked={(col.fieldKeys || []).includes(f.key)}
                                      disabled={isBusy}
                                      onChange={() => toggleCollectionField(col, f.key)}
                                    />
                                  ))}
                                  {count > 0 && (
                                    <Button
                                      size="slim"
                                      variant="plain"
                                      tone="critical"
                                      disabled={isBusy}
                                      onClick={() => updateCollectionFields(col.id, [])}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                  {isBusy && <Spinner size="small" />}
                                </InlineStack>
                              </InlineStack>
                            </Box>
                          );
                        })}
                      </div>
                    </Box>
                  )}
                </>
              )}
            </BlockStack>
          )}

          {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}
        </BlockStack>
      </Card>
  );
}
