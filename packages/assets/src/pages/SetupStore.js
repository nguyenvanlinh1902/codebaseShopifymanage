import React, {useState, useEffect} from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  IndexTable,
  Button,
  Banner,
  SkeletonBodyText,
  Badge,
  InlineStack,
  Text,
  BlockStack,
  ChoiceList
} from '@shopify/polaris';
import {api} from '../helpers/api';

export default function SetupStore() {
  // Stores
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);

  // Predefined definitions
  const [definitions, setDefinitions] = useState([]);

  // Saved themes
  const [savedThemes, setSavedThemes] = useState([]);
  const [savedThemesLoading, setSavedThemesLoading] = useState(true);
  const [selectedThemeId, setSelectedThemeId] = useState('');

  // Check results
  const [checkResults, setCheckResults] = useState([]);
  const [checking, setChecking] = useState(false);

  // Apply results
  const [applyResults, setApplyResults] = useState([]);
  const [applying, setApplying] = useState(false);

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadStores();
    loadDefinitions();
    loadSavedThemes();
  }, []);

  const loadStores = async () => {
    try {
      setStoresLoading(true);
      const res = await api('/api/stores?limit=50');
      const data = await res.json();
      if (data.success) {
        setStores(data.data || []);
      }
    } catch (err) {
      setErrorMsg('Failed to load stores');
    } finally {
      setStoresLoading(false);
    }
  };

  const loadDefinitions = async () => {
    try {
      const res = await api('/api/setup/definitions');
      const data = await res.json();
      if (data.success) {
        setDefinitions(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load definitions', err);
    }
  };

  const loadSavedThemes = async () => {
    try {
      setSavedThemesLoading(true);
      const res = await api('/api/themes/imported');
      const data = await res.json();
      if (data.success) {
        setSavedThemes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load saved themes', err);
    } finally {
      setSavedThemesLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const handleCheck = async () => {
    if (selectedStoreIds.length === 0) {
      setErrorMsg('Please select at least one store');
      return;
    }
    try {
      setChecking(true);
      setErrorMsg('');
      setSuccessMsg('');
      setCheckResults([]);
      setApplyResults([]);

      const res = await api('/api/setup/check', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const data = await res.json();
      if (data.success) {
        setCheckResults(data.data || []);
        const allOk = (data.data || []).every(
          store => !store.error && store.metafields.every(m => m.status === 'exists')
        );
        if (allOk) {
          setSuccessMsg('All selected stores have all metafield definitions.');
        }
      } else {
        setErrorMsg(data.error || 'Failed to check stores');
      }
    } catch (err) {
      setErrorMsg('Failed to check stores');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    if (selectedStoreIds.length === 0) {
      setErrorMsg('Please select at least one store');
      return;
    }
    try {
      setApplying(true);
      setErrorMsg('');
      setSuccessMsg('');
      setApplyResults([]);

      // 1. Apply metafield definitions
      const metafieldRes = await api('/api/setup/apply', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const metafieldData = await metafieldRes.json();

      let results = [];
      if (metafieldData.success) {
        results = (metafieldData.data || []).map(r => ({...r, themeResult: null}));
      }

      // 2. Import theme if selected
      if (selectedThemeId) {
        const selectedTheme = savedThemes.find(t => t.id === selectedThemeId);
        for (let i = 0; i < results.length; i++) {
          const storeId = results[i].storeId;
          try {
            const themeRes = await api(`/api/themes/imported/${selectedThemeId}/reimport`, {
              method: 'POST',
              body: JSON.stringify({storeId, themeName: selectedTheme?.themeName})
            });
            const themeData = await themeRes.json();
            results[i].themeResult = themeData.success
              ? {success: true, message: 'Theme import started'}
              : {success: false, message: themeData.error || 'Failed'};
          } catch (err) {
            results[i].themeResult = {success: false, message: 'Request failed'};
          }
        }

        // Also handle stores that weren't in metafield results (e.g. if metafield call failed)
        for (const storeId of selectedStoreIds) {
          if (!results.find(r => r.storeId === storeId)) {
            const store = stores.find(s => s.id === storeId);
            try {
              const themeRes = await api(`/api/themes/imported/${selectedThemeId}/reimport`, {
                method: 'POST',
                body: JSON.stringify({storeId, themeName: selectedTheme?.themeName})
              });
              const themeData = await themeRes.json();
              results.push({
                storeId,
                storeName: store?.name || store?.shopDomain || storeId,
                shopDomain: store?.shopDomain || '',
                created: [],
                skipped: [],
                errors: [],
                themeResult: themeData.success
                  ? {success: true, message: 'Theme import started'}
                  : {success: false, message: themeData.error || 'Failed'}
              });
            } catch (err) {
              results.push({
                storeId,
                storeName: store?.name || store?.shopDomain || storeId,
                shopDomain: store?.shopDomain || '',
                created: [],
                skipped: [],
                errors: [],
                themeResult: {success: false, message: 'Request failed'}
              });
            }
          }
        }
      }

      setApplyResults(results);

      // Build summary message
      const totalCreated = results.reduce((sum, s) => sum + (s.created?.length || 0), 0);
      const totalErrors = results.reduce((sum, s) => sum + (s.errors?.length || 0), 0);
      const themeSuccessCount = results.filter(r => r.themeResult?.success).length;
      const themeFailCount = results.filter(r => r.themeResult && !r.themeResult.success).length;

      const msgs = [];
      if (totalCreated > 0) msgs.push(`Created ${totalCreated} metafield definition(s)`);
      if (totalCreated === 0 && totalErrors === 0) msgs.push('All metafield definitions already exist');
      if (totalErrors > 0) msgs.push(`${totalErrors} metafield error(s)`);
      if (themeSuccessCount > 0) msgs.push(`Theme imported to ${themeSuccessCount} store(s)`);
      if (themeFailCount > 0) msgs.push(`Theme failed on ${themeFailCount} store(s)`);

      if (totalErrors === 0 && themeFailCount === 0) {
        setSuccessMsg(msgs.join('. ') + '.');
      } else {
        setSuccessMsg(msgs.join('. ') + '.');
      }

      setCheckResults([]);
    } catch (err) {
      setErrorMsg('Failed to apply setup');
    } finally {
      setApplying(false);
    }
  };

  const themeOptions = [
    {label: 'No theme (metafields only)', value: ''},
    ...savedThemes.map(t => ({
      label: `${t.themeName} (${t.fileName}${t.fileSize ? ' - ' + formatFileSize(t.fileSize) : ''})`,
      value: t.id
    }))
  ];

  // Definitions table
  const definitionRows = definitions.map((def, index) => (
    <IndexTable.Row id={`${def.namespace}.${def.key}`} key={`${def.namespace}.${def.key}`} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold">{def.name}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd">{def.namespace}.{def.key}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge>{def.type}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="info">{def.ownerType}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text tone="subdued" variant="bodySm">{def.description}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Setup Store">
      <Layout>
        {successMsg && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMsg('')}>
              {successMsg}
            </Banner>
          </Layout.Section>
        )}
        {errorMsg && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setErrorMsg('')}>
              {errorMsg}
            </Banner>
          </Layout.Section>
        )}

        {/* Predefined Metafield Definitions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Predefined Metafield Definitions</Text>
              <Text tone="subdued" variant="bodySm">
                These metafield definitions will be created on selected stores during setup.
              </Text>
              {definitions.length > 0 ? (
                <IndexTable
                  itemCount={definitions.length}
                  headings={[
                    {title: 'Name'},
                    {title: 'Namespace.Key'},
                    {title: 'Type'},
                    {title: 'Owner'},
                    {title: 'Description'}
                  ]}
                  selectable={false}
                >
                  {definitionRows}
                </IndexTable>
              ) : (
                <SkeletonBodyText lines={3} />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Theme Selection */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Theme (Optional)</Text>
              <Text tone="subdued" variant="bodySm">
                Optionally select a saved theme to import to the selected stores during setup.
              </Text>
              {savedThemesLoading ? (
                <SkeletonBodyText lines={2} />
              ) : savedThemes.length === 0 ? (
                <Banner tone="info">
                  No saved themes available. Upload themes via the Themes page first.
                </Banner>
              ) : (
                <Select
                  label="Select a saved theme"
                  options={themeOptions}
                  value={selectedThemeId}
                  onChange={setSelectedThemeId}
                  disabled={checking || applying}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Store Selection */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Select Stores</Text>
              {storesLoading ? (
                <SkeletonBodyText lines={4} />
              ) : stores.length === 0 ? (
                <Banner tone="warning">No stores found. Please add stores first.</Banner>
              ) : (
                <ChoiceList
                  title="Select stores to check/setup"
                  allowMultiple
                  choices={stores.map(store => ({
                    label: `${store.name || store.shopDomain} (${store.shopDomain}.myshopify.com)`,
                    value: store.id
                  }))}
                  selected={selectedStoreIds}
                  onChange={setSelectedStoreIds}
                  disabled={checking || applying}
                />
              )}

              {selectedStoreIds.length > 0 && selectedThemeId && (
                <Banner tone="info">
                  <Text as="p">
                    Setup will create metafield definitions and import theme{' '}
                    <strong>"{savedThemes.find(t => t.id === selectedThemeId)?.themeName}"</strong>{' '}
                    to <strong>{selectedStoreIds.length} store(s)</strong>.
                  </Text>
                </Banner>
              )}

              <InlineStack gap="300">
                <Button
                  onClick={handleCheck}
                  loading={checking}
                  disabled={selectedStoreIds.length === 0 || applying}
                >
                  Check Stores
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApply}
                  loading={applying}
                  disabled={selectedStoreIds.length === 0 || checking}
                >
                  Apply Setup to {selectedStoreIds.length} Store{selectedStoreIds.length !== 1 ? 's' : ''}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Check Results */}
        {checkResults.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Check Results</Text>
                {checkResults.map((storeResult) => (
                  <Card key={storeResult.storeId}>
                    <BlockStack gap="200">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="bold">
                          {storeResult.storeName}
                        </Text>
                        {storeResult.shopDomain && (
                          <Text tone="subdued" variant="bodySm">
                            ({storeResult.shopDomain}.myshopify.com)
                          </Text>
                        )}
                        {storeResult.error && (
                          <Badge tone="critical">Error: {storeResult.error}</Badge>
                        )}
                      </InlineStack>
                      {storeResult.metafields.map((mf) => (
                        <InlineStack key={`${mf.namespace}.${mf.key}`} gap="200" blockAlign="center">
                          <Badge tone={mf.status === 'exists' ? 'success' : mf.status === 'missing' ? 'warning' : 'critical'}>
                            {mf.status === 'exists' ? 'OK' : mf.status === 'missing' ? 'Missing' : 'Error'}
                          </Badge>
                          <Text variant="bodySm">
                            {mf.name} ({mf.namespace}.{mf.key})
                          </Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Apply Results */}
        {applyResults.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Setup Results</Text>
                {applyResults.map((storeResult) => (
                  <Card key={storeResult.storeId}>
                    <BlockStack gap="200">
                      <Text variant="bodyMd" fontWeight="bold">
                        {storeResult.storeName}
                        {storeResult.shopDomain && ` (${storeResult.shopDomain}.myshopify.com)`}
                      </Text>
                      {storeResult.created?.map((item, i) => (
                        <InlineStack key={`c-${i}`} gap="200" blockAlign="center">
                          <Badge tone="success">Created</Badge>
                          <Text variant="bodySm">{item.name}</Text>
                        </InlineStack>
                      ))}
                      {storeResult.skipped?.map((item, i) => (
                        <InlineStack key={`s-${i}`} gap="200" blockAlign="center">
                          <Badge>Skipped</Badge>
                          <Text variant="bodySm">{item.name} - {item.reason}</Text>
                        </InlineStack>
                      ))}
                      {storeResult.errors?.map((item, i) => (
                        <InlineStack key={`e-${i}`} gap="200" blockAlign="center">
                          <Badge tone="critical">Error</Badge>
                          <Text variant="bodySm">{item.name} - {item.error}</Text>
                        </InlineStack>
                      ))}
                      {storeResult.themeResult && (
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone={storeResult.themeResult.success ? 'success' : 'critical'}>
                            {storeResult.themeResult.success ? 'Theme OK' : 'Theme Failed'}
                          </Badge>
                          <Text variant="bodySm">{storeResult.themeResult.message}</Text>
                        </InlineStack>
                      )}
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
