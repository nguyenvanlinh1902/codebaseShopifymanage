import React, {useState, useEffect, useMemo} from 'react';
import {
  Card, BlockStack, InlineStack, Text, Button, Badge,
  Spinner, Banner, Divider, Checkbox, TextField, Box, Icon, Collapsible
} from '@shopify/polaris';
import {SearchIcon, ClipboardIcon} from '@shopify/polaris-icons';
import {usePermittedStores} from '../../hooks/usePermittedStores';
import {api} from '../../helpers/api';

export default function DeploySection({fields}) {
  const {stores, loading: storesLoading} = usePermittedStores();
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [deploying, setDeploying] = useState(false);
  const [undeploying, setUndeploying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [deployResults, setDeployResults] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [snippet, setSnippet] = useState('');
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load snippet when fields change
  useEffect(() => {
    if (!fields?.length) return;
    api('/api/custom-fields/snippet').then(r => r.json()).then(data => {
      if (data.success) setSnippet(data.data.snippet);
    }).catch(() => {});
  }, [fields]);

  const filteredStores = useMemo(() => {
    if (!stores?.length) return [];
    if (!search.trim()) return stores;
    const q = search.toLowerCase();
    return stores.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.shopDomain || '').toLowerCase().includes(q)
    );
  }, [stores, search]);

  const toggleStore = (storeId) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  };

  const toggleAll = () => {
    const allFilteredIds = filteredStores.map(s => s.id);
    const allSelected = allFilteredIds.every(id => selectedStoreIds.includes(id));
    if (allSelected) {
      setSelectedStoreIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedStoreIds(prev => [...new Set([...prev, ...allFilteredIds])]);
    }
  };

  const allFilteredSelected = filteredStores.length > 0 && filteredStores.every(s => selectedStoreIds.includes(s.id));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeploy = async () => {
    if (!selectedStoreIds.length) return;
    setDeploying(true);
    setDeployResults([]);
    setStatusData([]);
    setError('');
    try {
      const res = await api('/api/custom-fields/deploy', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const data = await res.json();
      if (data.success) setDeployResults(data.data || []);
      else setError(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!selectedStoreIds.length) return;
    setChecking(true);
    setStatusData([]);
    setDeployResults([]);
    setError('');
    try {
      const res = await api('/api/custom-fields/deploy-check', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const data = await res.json();
      if (data.success) setStatusData(data.data || []);
      else setError(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleUndeploy = async () => {
    if (!selectedStoreIds.length || !confirm('Remove custom fields from selected stores?')) return;
    setUndeploying(true);
    setDeployResults([]);
    setStatusData([]);
    setError('');
    try {
      const res = await api('/api/custom-fields/undeploy', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const data = await res.json();
      if (data.success) setDeployResults(data.data || []);
      else setError(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setUndeploying(false);
    }
  };

  const busy = deploying || undeploying || checking;
  const hasFields = fields?.length > 0;

  return (
    <BlockStack gap="400">
      {/* Theme Code Section */}
      {hasFields && snippet && (
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Theme Code</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Add this to your theme: Online Store → Themes → Edit code → snippets/product-form.liquid
                </Text>
              </BlockStack>
              <InlineStack gap="200">
                <Button icon={ClipboardIcon} onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>
                <Button variant="plain" onClick={() => setSnippetOpen(!snippetOpen)}>
                  {snippetOpen ? 'Hide' : 'Show'}
                </Button>
              </InlineStack>
            </InlineStack>

            <Collapsible open={snippetOpen}>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <pre style={{margin: 0, fontSize: '12px', lineHeight: '1.5', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                  {snippet}
                </pre>
              </Box>
            </Collapsible>

            <Banner tone="info">
              <p>Paste this code <strong>before the Add to Cart button</strong> inside your product form template. Only need to do once per theme.</p>
            </Banner>
          </BlockStack>
        </Card>
      )}

      {/* Deploy Metafields Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">Deploy Metafields</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Create metafield definitions on selected stores
              </Text>
            </BlockStack>
            {selectedStoreIds.length > 0 && (
              <Badge tone="info">{selectedStoreIds.length} selected</Badge>
            )}
          </InlineStack>

          {!hasFields && (
            <Banner tone="warning">Define at least one custom field above before deploying.</Banner>
          )}

          {storesLoading ? (
            <BlockStack align="center" inlineAlign="center"><Spinner size="small" /></BlockStack>
          ) : (
            <BlockStack gap="300">
              <TextField
                prefix={<Icon source={SearchIcon} />}
                placeholder="Search stores..."
                value={search}
                onChange={setSearch}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setSearch('')}
              />

              <Box borderWidth="025" borderColor="border" borderRadius="200" overflow="hidden">
                <Box padding="300" background="bg-surface-secondary">
                  <Checkbox
                    label={<Text variant="bodySm" fontWeight="semibold">
                      {search ? `All matching (${filteredStores.length})` : `All stores (${stores.length})`}
                    </Text>}
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                  />
                </Box>

                <div style={{maxHeight: '280px', overflowY: 'auto'}}>
                  {filteredStores.length === 0 ? (
                    <Box padding="400">
                      <Text tone="subdued" alignment="center">No stores found</Text>
                    </Box>
                  ) : (
                    filteredStores.map((store) => (
                      <Box key={store.id} padding="300" borderBlockStartWidth="025" borderColor="border">
                        <Checkbox
                          label={
                            <InlineStack gap="200" blockAlign="center">
                              <Text variant="bodySm">{store.name || store.shopDomain}</Text>
                              <Text variant="bodySm" tone="subdued">{store.shopDomain}</Text>
                            </InlineStack>
                          }
                          checked={selectedStoreIds.includes(store.id)}
                          onChange={() => toggleStore(store.id)}
                        />
                      </Box>
                    ))
                  )}
                </div>
              </Box>
            </BlockStack>
          )}

          <InlineStack gap="300">
            <Button variant="primary" onClick={handleDeploy} loading={deploying} disabled={busy || !selectedStoreIds.length || !hasFields}>
              Deploy
            </Button>
            <Button onClick={handleCheckStatus} loading={checking} disabled={busy || !selectedStoreIds.length}>
              Check Status
            </Button>
            <Button tone="critical" onClick={handleUndeploy} loading={undeploying} disabled={busy || !selectedStoreIds.length}>
              Undeploy
            </Button>
          </InlineStack>

          {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}

          {deployResults.length > 0 && (
            <>
              <Divider />
              <Text as="h3" variant="headingSm">Results</Text>
              <BlockStack gap="200">
                {deployResults.map(r => (
                  <Box key={r.storeId} padding="200" background={r.status === 'success' ? 'bg-surface-success' : 'bg-surface-critical'} borderRadius="200">
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Badge tone={r.status === 'success' ? 'success' : 'critical'} size="small">{r.status}</Badge>
                      <BlockStack gap="0">
                        <Text variant="bodySm" fontWeight="semibold">{r.storeName || r.storeId}</Text>
                        {r.created > 0 && <Text variant="bodySm" tone="subdued">{r.created} created, {r.skipped} skipped</Text>}
                        {r.removed > 0 && <Text variant="bodySm" tone="subdued">{r.removed} removed</Text>}
                        {r.errors?.length > 0 && <Text variant="bodySm" tone="critical">{r.errors.join('; ')}</Text>}
                      </BlockStack>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            </>
          )}

          {statusData.length > 0 && (
            <>
              <Divider />
              <Text as="h3" variant="headingSm">Deployment Status</Text>
              <BlockStack gap="200">
                {statusData.map(s => (
                  <Box key={s.storeId} padding="200" borderWidth="025" borderColor="border" borderRadius="200">
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Badge tone={s.deployed ? 'success' : undefined} size="small">{s.deployed ? 'Deployed' : 'Not deployed'}</Badge>
                      <BlockStack gap="0">
                        <Text variant="bodySm" fontWeight="semibold">{s.storeName || s.storeId}</Text>
                        {s.deployed && <Text variant="bodySm" tone="subdued">{s.fieldCount} fields · {new Date(s.deployedAt).toLocaleDateString()}</Text>}
                      </BlockStack>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            </>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
