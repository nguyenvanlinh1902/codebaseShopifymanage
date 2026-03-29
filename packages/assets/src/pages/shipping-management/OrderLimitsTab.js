import React, {useState, useEffect, useCallback} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  TextField,
  Select,
  ChoiceList,
  Badge,
  IndexTable,
  Box,
  Modal,
  Spinner
} from '@shopify/polaris';
import {api} from '../../helpers/api';

const TIMEZONE_OPTIONS = [
  {label: 'US Eastern (New York)', value: 'America/New_York'},
  {label: 'US Central (Chicago)', value: 'America/Chicago'},
  {label: 'US Pacific (Los Angeles)', value: 'America/Los_Angeles'},
  {label: 'Vietnam (Saigon)', value: 'Asia/Ho_Chi_Minh'},
  {label: 'Japan (Tokyo)', value: 'Asia/Tokyo'},
  {label: 'UK (London)', value: 'Europe/London'},
  {label: 'UTC', value: 'UTC'}
];

export default function OrderLimitsTab({templates, stores, onError, onSuccess}) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    shopDomains: [],
    dailyLimit: '',
    totalLimit: '',
    timezone: 'America/New_York',
    normalTemplateId: '',
    highPriceTemplateId: ''
  });

  const storeChoices = stores.map(s => ({
    label: s.name || s.shopDomain,
    value: s.shopDomain
  }));

  const templateOptions = [{label: 'Select template...', value: ''}, ...templates.map(t => ({
    label: `${t.name} (${t.sourceStore})`,
    value: t.id
  }))];

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/shipping/order-limits');
      const data = await res.json();
      if (data.success) setRules(data.data);
      else onError(data.error);
    } catch {
      onError('Failed to fetch order limits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, []);

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormData({shopDomains: [], dailyLimit: '', totalLimit: '', timezone: 'America/New_York', normalTemplateId: '', highPriceTemplateId: ''});
  };

  const openCreate = () => {
    closeModal();
    setModalOpen(true);
  };

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setFormData({
      shopDomains: [rule.shopDomain],
      dailyLimit: String(rule.dailyLimit),
      totalLimit: rule.totalLimit ? String(rule.totalLimit) : '',
      timezone: rule.timezone,
      normalTemplateId: rule.normalTemplateId,
      highPriceTemplateId: rule.highPriceTemplateId
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const limit = parseInt(formData.dailyLimit, 10);
    if (!limit || limit <= 0) return onError('Daily limit must be a positive number');
    if (!formData.shopDomains.length) return onError('Please select at least one store');

    const totalLimitVal = formData.totalLimit ? parseInt(formData.totalLimit, 10) : 0;
    const {shopDomains, ...rest} = formData;

    try {
      if (editingId) {
        const payload = {...rest, shopDomain: shopDomains[0], dailyLimit: limit, totalLimit: totalLimitVal};
        const res = await api(`/api/shipping/order-limits/${editingId}`, {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) { onSuccess('Rule updated'); closeModal(); fetchRules(); }
        else onError(data.error);
      } else {
        const results = await Promise.allSettled(
          shopDomains.map(shopDomain => {
            const payload = {...rest, shopDomain, dailyLimit: limit, totalLimit: totalLimitVal};
            return api('/api/shipping/order-limits', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(payload)
            }).then(r => r.json());
          })
        );
        const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
        if (succeeded > 0) onSuccess(`${succeeded} rule(s) created`);
        if (failed.length > 0) {
          const errors = failed.map(r => r.status === 'fulfilled' ? r.value.error : 'Request failed');
          onError(`${failed.length} failed: ${errors.join(', ')}`);
        }
        closeModal();
        fetchRules();
      }
    } catch {
      onError('Failed to save rule');
    }
  };

  const handleAction = async (id, action) => {
    setActionLoading(prev => ({...prev, [id]: true}));
    try {
      const urlMap = {
        toggle: `/api/shipping/order-limits/${id}/toggle`,
        reset: `/api/shipping/order-limits/${id}/reset`,
        delete: `/api/shipping/order-limits/${id}`
      };
      const methodMap = {toggle: 'POST', reset: 'POST', delete: 'DELETE'};
      const res = await api(urlMap[action], {method: methodMap[action]});
      const data = await res.json();
      if (data.success) {
        onSuccess(`Rule ${action}d`);
        fetchRules();
      } else {
        onError(data.error);
      }
    } catch {
      onError(`Failed to ${action} rule`);
    } finally {
      setActionLoading(prev => ({...prev, [id]: false}));
    }
  };

  const getStatusBadge = (rule) => {
    if (!rule.enabled) {
      const hitTotal = rule.totalLimit > 0 && (rule.totalCount || 0) >= rule.totalLimit;
      return <Badge tone={hitTotal ? 'warning' : undefined}>{hitTotal ? 'Total Reached' : 'Disabled'}</Badge>;
    }
    if (rule.isLimited) return <Badge tone="critical">Limited</Badge>;
    return <Badge tone="success">Normal</Badge>;
  };

  const resourceName = {singular: 'rule', plural: 'rules'};
  const headings = [
    {title: 'Store'},
    {title: 'Daily Limit'},
    {title: 'Total Limit'},
    {title: 'Timezone'},
    {title: 'Daily Count'},
    {title: 'Total Count'},
    {title: 'Status'},
    {title: 'Actions'}
  ];

  const rowMarkup = rules.map((rule, index) => (
    <IndexTable.Row id={rule.id} key={rule.id} position={index}>
      <IndexTable.Cell><Text variant="bodyMd" fontWeight="bold">{stores.find(s => s.shopDomain === rule.shopDomain)?.name || rule.shopDomain}</Text></IndexTable.Cell>
      <IndexTable.Cell>{rule.dailyLimit}</IndexTable.Cell>
      <IndexTable.Cell>{rule.totalLimit || '∞'}</IndexTable.Cell>
      <IndexTable.Cell>{rule.timezone}</IndexTable.Cell>
      <IndexTable.Cell>{rule.currentCount} / {rule.dailyLimit}</IndexTable.Cell>
      <IndexTable.Cell>{rule.totalCount || 0}{rule.totalLimit ? ` / ${rule.totalLimit}` : ''}</IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(rule)}</IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          {actionLoading[rule.id] ? <Spinner size="small" /> : (
            <>
              <Button size="slim" onClick={() => handleAction(rule.id, 'toggle')}>
                {rule.enabled ? 'Disable' : 'Enable'}
              </Button>
              {rule.enabled && (
                <Button size="slim" onClick={() => handleAction(rule.id, 'reset')}>Reset</Button>
              )}
              <Button size="slim" onClick={() => handleEdit(rule)}>Edit</Button>
              <Button size="slim" tone="critical" onClick={() => handleAction(rule.id, 'delete')}>Delete</Button>
            </>
          )}
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Box paddingBlockStart="400">
      <BlockStack gap="400">
        <InlineStack align="end">
          <Button variant="primary" onClick={openCreate}>Create Rule</Button>
        </InlineStack>

        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={editingId ? 'Edit Order Limit Rule' : 'Create Order Limit Rule'}
          primaryAction={{content: editingId ? 'Update' : 'Create', onAction: handleSave}}
          secondaryActions={[{content: 'Cancel', onAction: closeModal}]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <ChoiceList
                title="Stores"
                choices={storeChoices}
                selected={formData.shopDomains}
                onChange={v => setFormData(p => ({...p, shopDomains: v}))}
                allowMultiple={!editingId}
                disabled={editingId ? true : false}
              />
              <TextField label="Daily Limit" type="number" value={formData.dailyLimit}
                onChange={v => setFormData(p => ({...p, dailyLimit: v}))} autoComplete="off" />
              <TextField label="Total Limit (0 = unlimited)" type="number" value={formData.totalLimit}
                onChange={v => setFormData(p => ({...p, totalLimit: v}))} autoComplete="off"
                helpText="Auto-disable rule when total orders reach this limit" />
              <Select label="Timezone" options={TIMEZONE_OPTIONS} value={formData.timezone}
                onChange={v => setFormData(p => ({...p, timezone: v}))} />
              <Select label="Normal Template" options={templateOptions} value={formData.normalTemplateId}
                onChange={v => setFormData(p => ({...p, normalTemplateId: v}))} />
              <Select label="High-Price Template" options={templateOptions} value={formData.highPriceTemplateId}
                onChange={v => setFormData(p => ({...p, highPriceTemplateId: v}))} />
            </BlockStack>
          </Modal.Section>
        </Modal>

        <Card>
          {loading ? (
            <Box padding="400"><InlineStack align="center"><Spinner /></InlineStack></Box>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={rules.length}
              headings={headings}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>
    </Box>
  );
}
