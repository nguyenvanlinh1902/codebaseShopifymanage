import React, {useState} from 'react';
import {
  Modal, BlockStack, Text, IndexTable, Badge, Banner,
  Spinner, ChoiceList
} from '@shopify/polaris';
import {api} from '../../helpers/api';

export default function MetafieldSetupModal({
  open, onClose, stores, definitions, onSuccess
}) {
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [checkResults, setCheckResults] = useState([]);
  const [applyResults, setApplyResults] = useState([]);

  const handleCheck = async () => {
    if (!selectedStoreIds.length) return;
    setChecking(true);
    setCheckResults([]);
    setApplyResults([]);
    try {
      const res = await api('/api/setup/check', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const data = await res.json();
      if (data.success) setCheckResults(data.data || []);
    } catch { /* silent */ }
    setChecking(false);
  };

  const handleApply = async () => {
    if (!selectedStoreIds.length) return;
    setApplying(true);
    setApplyResults([]);
    try {
      const res = await api('/api/setup/apply', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const data = await res.json();
      if (data.success) {
        setApplyResults(data.data || []);
        const totalCreated = (data.data || []).reduce((s, r) => s + (r.created?.length || 0), 0);
        onSuccess(totalCreated === 0
          ? 'All metafield definitions already exist.'
          : `Created ${totalCreated} metafield definition(s).`
        );
      }
    } catch { /* silent */ }
    setApplying(false);
  };

  const results = applyResults.length > 0 ? applyResults : checkResults;
  const storeChoices = stores.map(s => ({
    label: `${s.name || s.shopDomain} (${s.shopDomain}.myshopify.com)`,
    value: s.id
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Setup Metafield Definitions"
      primaryAction={{
        content: 'Apply Metafields',
        onAction: handleApply,
        loading: applying,
        disabled: checking || !selectedStoreIds.length
      }}
      secondaryActions={[
        {content: 'Check', onAction: handleCheck, loading: checking, disabled: applying || !selectedStoreIds.length},
        {content: 'Close', onAction: onClose}
      ]}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Store selection */}
          <ChoiceList
            title="Select stores"
            allowMultiple
            choices={storeChoices}
            selected={selectedStoreIds}
            onChange={setSelectedStoreIds}
            disabled={checking || applying}
          />

          {/* Definitions list */}
          <Text variant="headingSm">Definitions</Text>
          <IndexTable
            resourceName={{singular: 'definition', plural: 'definitions'}}
            itemCount={definitions.length}
            headings={[{title: 'Name'}, {title: 'Namespace'}, {title: 'Key'}, {title: 'Type'}, {title: 'Owner'}]}
            selectable={false}
          >
            {definitions.map((d, i) => (
              <IndexTable.Row id={d.key} key={d.key} position={i}>
                <IndexTable.Cell><Text variant="bodySm" fontWeight="semibold">{d.name}</Text></IndexTable.Cell>
                <IndexTable.Cell>{d.namespace}</IndexTable.Cell>
                <IndexTable.Cell>{d.key}</IndexTable.Cell>
                <IndexTable.Cell><Badge>{d.type}</Badge></IndexTable.Cell>
                <IndexTable.Cell><Badge>{d.ownerType}</Badge></IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>

          {(checking || applying) && <Spinner size="small" />}

          {results.length > 0 && (
            <BlockStack gap="200">
              <Text variant="headingSm">Results</Text>
              {results.map(store => (
                <Banner
                  key={store.storeId}
                  tone={store.error ? 'critical' : (store.created?.length > 0 ? 'success' : 'info')}
                >
                  <Text fontWeight="semibold">{store.storeName}</Text>
                  {store.metafields?.map(m => (
                    <Text key={m.key} variant="bodySm">
                      {m.name}: <Badge tone={m.status === 'exists' ? 'success' : 'warning'}>{m.status}</Badge>
                    </Text>
                  ))}
                  {store.created?.length > 0 && (
                    <Text variant="bodySm">Created: {store.created.map(c => c.name).join(', ')}</Text>
                  )}
                  {store.skipped?.length > 0 && (
                    <Text variant="bodySm">Skipped: {store.skipped.map(s => s.name).join(', ')}</Text>
                  )}
                  {store.errors?.length > 0 && (
                    <Text variant="bodySm" tone="critical">
                      Errors: {store.errors.map(e => `${e.name}: ${e.error}`).join(', ')}
                    </Text>
                  )}
                </Banner>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
