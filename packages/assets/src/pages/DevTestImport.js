import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Banner,
  Button,
  Spinner,
  Divider,
  Box,
  Tabs
} from '@shopify/polaris';
import {RefreshIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import DirectImportTab from './products/DirectImportTab';

export default function DevTestImport() {
  const {stores} = usePermittedStores();
  const [selectedTab, setSelectedTab] = useState(0);
  const [stuckImports, setStuckImports] = useState([]);
  const [queueStats, setQueueStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState({});
  const [processingQueue, setProcessingQueue] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [stuckRes, statsRes] = await Promise.all([
        api('/api/products/stuck-imports').then(r => r.json()),
        api('/api/products/queue-stats').then(r => r.json())
      ]);
      if (stuckRes.success) setStuckImports(stuckRes.data || []);
      if (statsRes.success) setQueueStats(statsRes.data || null);
    } catch (err) {
      setError(`Failed to fetch: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = async importId => {
    try {
      setRetrying(prev => ({...prev, [importId]: true}));
      setError(null);
      const res = await api(`/api/products/imports/${importId}/retry`, {method: 'POST'});
      const json = await res.json();
      if (json.success) {
        setSuccess(`Import ${importId} queued for retry`);
        await fetchData();
      } else {
        setError(json.error || 'Retry failed');
      }
    } catch (err) {
      setError(`Retry failed: ${err.message}`);
    } finally {
      setRetrying(prev => ({...prev, [importId]: false}));
    }
  };

  const handleProcessQueue = async () => {
    try {
      setProcessingQueue(true);
      setError(null);
      const res = await api('/api/products/process-queue', {method: 'POST'});
      const json = await res.json();
      if (json.success) {
        setSuccess('Queue processed successfully');
        await fetchData();
      } else {
        setError(json.error || 'Process queue failed');
      }
    } catch (err) {
      setError(`Process queue failed: ${err.message}`);
    } finally {
      setProcessingQueue(false);
    }
  };

  const fmtDate = iso => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString();
  };

  const statusTone = status => {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'critical';
    if (status === 'processing') return 'attention';
    return 'info';
  };

  const tabs = [
    {id: 'stuck', content: `Stuck Imports (${stuckImports.length})`, panelID: 'stuck-panel'},
    {id: 'direct', content: 'Direct Import', panelID: 'direct-panel'}
  ];

  return (
    <Page title="Test Import" subtitle="Debug and retry stuck product imports">
      <BlockStack gap="400">
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

        {/* Queue Stats */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingSm" as="h3">
                Queue Stats
              </Text>
              <InlineStack gap="200">
                <Button onClick={handleProcessQueue} loading={processingQueue} size="slim">
                  Process Queue Now
                </Button>
                <Button
                  onClick={fetchData}
                  loading={loading}
                  icon={RefreshIcon}
                  size="slim"
                  variant="plain"
                />
              </InlineStack>
            </InlineStack>
            {queueStats ? (
              <InlineStack gap="300" wrap>
                <Badge tone="info">{queueStats.pending || 0} pending</Badge>
                <Badge tone="attention">{queueStats.processing || 0} processing</Badge>
                <Badge tone="success">{queueStats.completed || 0} completed</Badge>
                <Badge tone="critical">{queueStats.failed || 0} failed</Badge>
                <Badge>{queueStats.total || 0} total</Badge>
              </InlineStack>
            ) : (
              loading && <Spinner size="small" />
            )}
            {queueStats?.activeImports?.length > 0 && (
              <>
                <Divider />
                <Text variant="bodySm" fontWeight="semibold">
                  Active Imports:
                </Text>
                <BlockStack gap="100">
                  {queueStats.activeImports.map(imp => (
                    <InlineStack key={imp.importId} gap="200" blockAlign="center" wrap>
                      <Badge size="small" tone={statusTone(imp.status)}>
                        {imp.status}
                      </Badge>
                      <Text variant="bodySm">
                        {imp.storeName || ''} - {imp.fileName}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        {imp.processedProducts}/{imp.totalProducts} ({imp.completionPercentage}%)
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </>
            )}
          </BlockStack>
        </Card>

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          {selectedTab === 0 && (
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">
                    Stuck Imports (pending/processing, 0 progress, &gt;2 min)
                  </Text>
                  <Button
                    onClick={fetchData}
                    loading={loading}
                    size="slim"
                    variant="plain"
                    icon={RefreshIcon}
                  />
                </InlineStack>

                {stuckImports.length === 0 ? (
                  <Text tone="subdued">No stuck imports found.</Text>
                ) : (
                  <BlockStack gap="300">
                    {stuckImports.map(imp => (
                      <Card key={imp.id}>
                        <BlockStack gap="200">
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Badge tone={statusTone(imp.status)}>{imp.status}</Badge>
                              <Text variant="bodyMd" fontWeight="semibold">
                                {imp.fileName}
                              </Text>
                            </InlineStack>
                            <Button
                              onClick={() => handleRetry(imp.id)}
                              loading={retrying[imp.id]}
                              size="slim"
                              tone="critical"
                            >
                              Retry
                            </Button>
                          </InlineStack>
                          <InlineStack gap="300" wrap>
                            <Text variant="bodySm" tone="subdued">
                              Store: {imp.storeName}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              Products: {imp.totalProducts}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              Variants: {imp.totalVariants || 0}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              Created: {fmtDate(imp.createdAt)}
                            </Text>
                          </InlineStack>
                          <InlineStack gap="200">
                            <Text variant="bodySm">
                              Progress: {imp.processedProducts || 0}/{imp.totalProducts}
                            </Text>
                            {(imp.successCount || 0) > 0 && (
                              <Text variant="bodySm" tone="success">
                                {imp.successCount} success
                              </Text>
                            )}
                            {(imp.failedCount || 0) > 0 && (
                              <Text variant="bodySm" tone="critical">
                                {imp.failedCount} failed
                              </Text>
                            )}
                          </InlineStack>
                          {imp.error && (
                            <Box background="bg-surface-critical" padding="200" borderRadius="100">
                              <Text variant="bodySm" tone="critical">
                                Error: {imp.error}
                              </Text>
                            </Box>
                          )}
                          <Text variant="bodySm" tone="subdued" breakWord>
                            ID: {imp.id}
                          </Text>
                        </BlockStack>
                      </Card>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          )}

          {selectedTab === 1 && <DirectImportTab stores={stores} />}
        </Tabs>
      </BlockStack>
    </Page>
  );
}
