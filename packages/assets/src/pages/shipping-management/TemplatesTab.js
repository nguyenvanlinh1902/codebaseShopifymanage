import React, {useState} from 'react';
import {
  Card, BlockStack, InlineStack, Text, Button, Box,
  IndexTable, Badge, Modal, TextField, Select, SkeletonBodyText
} from '@shopify/polaris';
import {api} from '../../helpers/api';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleString(); } catch { return dateStr; }
}

export default function TemplatesTab({templates, loading, stores, onCreate, onDelete, onRecapture, onRefresh}) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({name: '', description: '', sourceStore: ''});
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewTemplate, setViewTemplate] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const storeOptions = stores.map(s => ({label: s.name || s.shopDomain, value: s.shopDomain}));

  if (loading && !templates.length) {
    return <Box padding="400"><SkeletonBodyText lines={6} /></Box>;
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.sourceStore) return;
    setCreating(true);
    await onCreate(form);
    setCreating(false);
    setShowCreate(false);
    setForm({name: '', description: '', sourceStore: ''});
  };

  const handleView = async (template) => {
    setViewTemplate(template);
    setViewLoading(true);
    try {
      const res = await api(`/api/shipping/templates/${template.id}`);
      const data = await res.json();
      if (data.success) setViewData(data.data);
    } catch { /* silent */ }
    setViewLoading(false);
  };

  const rowMarkup = templates.map((t, i) => (
    <IndexTable.Row id={t.id} key={t.id} position={i}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold">{t.name}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{t.description || '—'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm">{t.sourceStore}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge>{t.zoneCount || 0} zones</Badge>{' '}
        <Badge>{t.rateCount || 0} rates</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{formatDate(t.createdAt)}</IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => handleView(t)}>View</Button>
          <Button size="slim" onClick={() => onRecapture(t.id, t.sourceStore)}>Recapture</Button>
          <Button size="slim" tone="critical" onClick={() => setConfirmDelete(t)}>Delete</Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Box padding="400">
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" fontWeight="semibold">Templates ({templates.length})</Text>
          <InlineStack gap="300">
            <Button onClick={onRefresh} disabled={loading}>Refresh</Button>
            <Button variant="primary" onClick={() => setShowCreate(true)}>Create Template</Button>
          </InlineStack>
        </InlineStack>

        <Card padding="0">
          <IndexTable
            resourceName={{singular: 'template', plural: 'templates'}}
            itemCount={templates.length}
            headings={[
              {title: 'Name'}, {title: 'Description'}, {title: 'Source Store'},
              {title: 'Summary'}, {title: 'Created'}, {title: 'Actions'}
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
          title="Create Shipping Template"
          primaryAction={{content: 'Create', onAction: handleCreate, loading: creating, disabled: !form.name.trim() || !form.sourceStore}}
          secondaryActions={[{content: 'Cancel', onAction: () => setShowCreate(false)}]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <TextField label="Template Name" value={form.name} onChange={v => setForm({...form, name: v})} autoComplete="off" />
              <TextField label="Description (optional)" value={form.description} onChange={v => setForm({...form, description: v})} autoComplete="off" />
              <Select
                label="Source Store (capture rates from)"
                options={[{label: '-- Select Store --', value: ''}, ...storeOptions]}
                value={form.sourceStore}
                onChange={v => setForm({...form, sourceStore: v})}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* View Template Modal */}
        <Modal
          open={!!viewTemplate}
          onClose={() => { setViewTemplate(null); setViewData(null); }}
          title={viewTemplate ? `Template: ${viewTemplate.name}` : ''}
          large
        >
          <Modal.Section>
            {viewLoading ? <SkeletonBodyText lines={8} /> : viewData ? (
              <BlockStack gap="300">
                {(viewData.profiles || []).map((profile, pi) => (
                  <Card key={pi}>
                    <BlockStack gap="200">
                      <Text variant="headingSm">{profile.profileName}</Text>
                      {profile.locationGroups?.map((lg, li) =>
                        lg.zones?.map((zone, zi) => (
                          <Box key={`${li}-${zi}`} paddingInlineStart="400">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="semibold">{zone.zoneName}</Text>
                              {zone.rates?.map((rate, ri) => (
                                <InlineStack key={ri} gap="200">
                                  <Text variant="bodySm">{rate.name}:</Text>
                                  <Badge>{rate.price} {rate.currencyCode}</Badge>
                                  {!rate.active && <Badge tone="warning">Inactive</Badge>}
                                </InlineStack>
                              ))}
                            </BlockStack>
                          </Box>
                        ))
                      )}
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            ) : <Text>No data</Text>}
          </Modal.Section>
        </Modal>

        {/* Delete Confirmation */}
        <Modal
          open={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          title="Delete Template"
          primaryAction={{content: 'Delete', onAction: () => { onDelete(confirmDelete.id); setConfirmDelete(null); }, destructive: true}}
          secondaryActions={[{content: 'Cancel', onAction: () => setConfirmDelete(null)}]}
        >
          <Modal.Section>
            <Text>Delete template "{confirmDelete?.name}"? This cannot be undone.</Text>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Box>
  );
}
