import React, {useState, useEffect} from 'react';
import {
  Card, BlockStack, InlineStack, Text, Button, Badge,
  IndexTable, Spinner
} from '@shopify/polaris';
import {api} from '../../helpers/api';

const STEPS = [
  {key: 'metafields', label: 'Metafields'},
  {key: 'policies', label: 'Policies'},
  {key: 'shipping', label: 'Shipping'},
  {key: 'themes', label: 'Themes'}
];

export default function SetupStatusChecklist({stores, storesLoading, onAction}) {
  const [statusData, setStatusData] = useState([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!stores.length || storesLoading) return;
    checkAll();
  }, [stores, storesLoading]);

  const checkAll = async () => {
    if (!stores.length) return;
    setChecking(true);
    try {
      const storeIds = stores.map(s => s.id);
      const res = await api('/api/setup/check-all', {
        method: 'POST',
        body: JSON.stringify({storeIds})
      });
      const data = await res.json();
      if (data.success) setStatusData(data.data || []);
    } catch {
      setStatusData([]);
    }
    setChecking(false);
  };

  const aggregated = STEPS.map(step => {
    const doneCount = statusData.filter(s => s[step.key]?.done).length;
    const total = statusData.length;
    return {...step, doneCount, total, allDone: doneCount === total && total > 0};
  });

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">Setup Status</Text>
          <Button size="slim" onClick={checkAll} loading={checking}>Refresh</Button>
        </InlineStack>

        {(checking && statusData.length === 0) || storesLoading ? (
          <InlineStack align="center" gap="200">
            <Spinner size="small" />
            <Text tone="subdued">Checking setup status...</Text>
          </InlineStack>
        ) : statusData.length === 0 ? (
          <Text tone="subdued">No stores to check.</Text>
        ) : (
          <BlockStack gap="300">
            {/* Step buttons */}
            <InlineStack gap="300" wrap>
              {aggregated.map(step => (
                <Button
                  key={step.key}
                  onClick={() => onAction(step.key)}
                  icon={step.allDone ? undefined : undefined}
                >
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone={step.allDone ? 'success' : 'warning'}>
                      {step.allDone ? '✓' : '✗'}
                    </Badge>
                    <Text variant="bodySm">{step.label}</Text>
                    <Text variant="bodySm" tone="subdued">
                      ({step.doneCount}/{step.total})
                    </Text>
                  </InlineStack>
                </Button>
              ))}
            </InlineStack>

            {/* Per-store detail table */}
            <IndexTable
              resourceName={{singular: 'store', plural: 'stores'}}
              itemCount={statusData.length}
              headings={[
                {title: 'Store'},
                ...STEPS.map(s => ({title: s.label}))
              ]}
              selectable={false}
            >
              {statusData.map((store, i) => (
                <IndexTable.Row id={store.storeId} key={store.storeId} position={i}>
                  <IndexTable.Cell>
                    <Text variant="bodySm" fontWeight="semibold">{store.storeName}</Text>
                  </IndexTable.Cell>
                  {STEPS.map(step => (
                    <IndexTable.Cell key={step.key}>
                      <InlineStack gap="100" blockAlign="center">
                        <Badge tone={store[step.key]?.done ? 'success' : 'warning'}>
                          {store[step.key]?.done ? '✓' : '✗'}
                        </Badge>
                        <Text variant="bodySm" tone="subdued">
                          {store[step.key]?.detail || ''}
                        </Text>
                      </InlineStack>
                    </IndexTable.Cell>
                  ))}
                </IndexTable.Row>
              ))}
            </IndexTable>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
