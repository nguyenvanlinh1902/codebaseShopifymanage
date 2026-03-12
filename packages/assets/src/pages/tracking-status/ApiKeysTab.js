import React, {useState} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  IndexTable,
  Badge,
  Modal,
  TextField,
  SkeletonBodyText
} from '@shopify/polaris';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function ApiKeysTab({apiKeys, loading, onCreate, onUpdate, onDelete, onRefresh, onSyncQuota}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newQuota, setNewQuota] = useState('100');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingQuota, setEditingQuota] = useState(null); // {id, value}
  const [syncingId, setSyncingId] = useState(null);

  if (loading && !apiKeys.length) {
    return (
      <Box padding="400">
        <SkeletonBodyText lines={6} />
      </Box>
    );
  }

  const handleCreate = () => {
    if (!newName.trim() || !newApiKey.trim()) return;
    onCreate({name: newName.trim(), apiKey: newApiKey.trim(), quotaTotal: parseInt(newQuota) || 100});
    setShowCreate(false);
    setNewName('');
    setNewApiKey('');
    setNewQuota('100');
  };

  const handleToggleStatus = (key) => {
    const newStatus = key.status === 'active' ? 'banned' : 'active';
    onUpdate(key.id, {status: newStatus, errorCount: 0, lastError: null});
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      onDelete(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const handleSaveQuota = (id) => {
    const val = parseInt(editingQuota?.value);
    if (!val || val < 1) return;
    onUpdate(id, {quotaTotal: val});
    setEditingQuota(null);
  };

  const handleSyncQuota = async (id) => {
    if (!onSyncQuota) return;
    setSyncingId(id);
    try { await onSyncQuota(id); } finally { setSyncingId(null); }
  };

  const resourceName = {singular: 'API key', plural: 'API keys'};

  const rowMarkup = apiKeys.map((key, index) => (
    <IndexTable.Row id={key.id} key={key.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold">{key.name}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontFamily="mono">{key.apiKey}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={key.status === 'active' ? 'success' : 'critical'}>{key.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {editingQuota?.id === key.id ? (
          <InlineStack gap="100" blockAlign="center">
            <div style={{width: 80}}>
              <TextField
                type="number"
                value={editingQuota.value}
                onChange={(v) => setEditingQuota({id: key.id, value: v})}
                autoComplete="off"
                autoFocus
              />
            </div>
            <Button size="slim" variant="primary" onClick={() => handleSaveQuota(key.id)}>Save</Button>
            <Button size="slim" onClick={() => setEditingQuota(null)}>Cancel</Button>
          </InlineStack>
        ) : (
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center">
              <Text variant="bodyMd">{key.quotaUsed ?? 0} / {key.quotaTotal ?? 100}</Text>
              <Button size="slim" onClick={() => setEditingQuota({id: key.id, value: String(key.quotaTotal ?? 100)})}>Edit</Button>
              <Button size="slim" loading={syncingId === key.id} onClick={() => handleSyncQuota(key.id)}>Sync</Button>
            </InlineStack>
            {key.quotaRemain != null && (
              <Text variant="bodySm" tone="subdued">Remain: {key.quotaRemain} | Today: {key.todayUsed ?? 0}</Text>
            )}
          </BlockStack>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {key.errorCount > 0
          ? <Badge tone="warning">{key.errorCount} errors</Badge>
          : <Text variant="bodySm" tone="subdued">None</Text>}
      </IndexTable.Cell>
      <IndexTable.Cell>{formatDate(key.lastUsedAt)}</IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button
            size="slim"
            onClick={() => handleToggleStatus(key)}
          >
            {key.status === 'active' ? 'Disable' : 'Enable'}
          </Button>
          <Button
            size="slim"
            tone="critical"
            onClick={() => setConfirmDelete(key)}
          >
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Box padding="400">
      <BlockStack gap="400">
        {/* Header */}
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" fontWeight="semibold">
            API Keys ({apiKeys.length})
          </Text>
          <InlineStack gap="300">
            <Button onClick={onRefresh} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setShowCreate(true)}>Add API Key</Button>
          </InlineStack>
        </InlineStack>

        {/* Table */}
        <Card padding="0">
          <IndexTable
            resourceName={resourceName}
            itemCount={apiKeys.length}
            headings={[
              {title: 'Name'},
              {title: 'Key'},
              {title: 'Status'},
              {title: 'Quota'},
              {title: 'Errors'},
              {title: 'Last Used'},
              {title: 'Actions'}
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        </Card>

        {/* Create Modal */}
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="Add 17TRACK API Key"
          primaryAction={{content: 'Create', onAction: handleCreate, disabled: !newName.trim() || !newApiKey.trim()}}
          secondaryActions={[{content: 'Cancel', onAction: () => setShowCreate(false)}]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <TextField
                label="Name"
                value={newName}
                onChange={setNewName}
                placeholder="e.g. Account #1"
                autoComplete="off"
              />
              <TextField
                label="API Key"
                value={newApiKey}
                onChange={setNewApiKey}
                placeholder="Paste 17TRACK API key"
                autoComplete="off"
              />
              <TextField
                label="Monthly Quota"
                type="number"
                value={newQuota}
                onChange={setNewQuota}
                helpText="Free tier: 100 registrations/month"
                autoComplete="off"
              />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          open={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          title="Delete API Key"
          primaryAction={{content: 'Delete', onAction: handleConfirmDelete, destructive: true}}
          secondaryActions={[{content: 'Cancel', onAction: () => setConfirmDelete(null)}]}
        >
          <Modal.Section>
            <Text>
              Are you sure you want to delete the key "{confirmDelete?.name}"? This action cannot be undone.
            </Text>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Box>
  );
}
