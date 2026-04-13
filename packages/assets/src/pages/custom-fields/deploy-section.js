import React, {useState, useCallback} from 'react';
import {
  Card, BlockStack, InlineStack, Text, Button, Badge,
  Spinner, Banner, Divider, Select, Box
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
        body: JSON.stringify({storeIds: [selectedStoreId]})
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

  const handleToggle = async (collectionId, currentEnabled) => {
    setTogglingId(collectionId);
    try {
      const res = await api(`/api/custom-fields/collections/${selectedStoreId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({collectionId, enabled: !currentEnabled})
      });
      const data = await res.json();
      if (data.success) {
        setCollections(prev => prev.map(c =>
          c.id === collectionId ? {...c, customFieldsEnabled: !currentEnabled} : c
        ));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  };


  const storeOptions = [{label: 'Select a store...', value: ''}, ...(stores || []).map(s => ({
    label: `${s.name || s.shopDomain} (${s.shopDomain})`,
    value: s.id
  }))];

  const hasFields = fields?.length > 0;
  const enabledCount = collections.filter(c => c.customFieldsEnabled).length;

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
                <Button variant="primary" onClick={handleDeploy} loading={deploying} disabled={!selectedStoreId || !hasFields}>
                  Setup Store
                </Button>
              </InlineStack>

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
                        {collections.map((col) => (
                          <Box key={col.id} padding="300" borderBlockStartWidth="025" borderColor="border">
                            <InlineStack align="space-between" blockAlign="center" wrap={false}>
                              <BlockStack gap="0">
                                <Text variant="bodySm" fontWeight="semibold">{col.title}</Text>
                                <Text variant="bodySm" tone="subdued">{col.productsCount} products</Text>
                              </BlockStack>
                              <Button
                                size="slim"
                                variant={col.customFieldsEnabled ? 'primary' : 'secondary'}
                                tone={col.customFieldsEnabled ? 'success' : undefined}
                                loading={togglingId === col.id}
                                onClick={() => handleToggle(col.id, col.customFieldsEnabled)}
                              >
                                {col.customFieldsEnabled ? 'Enabled' : 'Enable'}
                              </Button>
                            </InlineStack>
                          </Box>
                        ))}
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
