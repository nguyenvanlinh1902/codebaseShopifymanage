import React, {useState, useEffect} from 'react';
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Select,
  Badge,
  Button,
  Card,
  Spinner,
  IndexTable,
  ProgressBar,
  ChoiceList,
  Box
} from '@shopify/polaris';
import {api} from '../../helpers/api';

export default function ShippingSetup({open, onClose, stores, onSuccess}) {
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [applying, setApplying] = useState(false);
  const [job, setJob] = useState(null);
  const [pollTimer, setPollTimer] = useState(null);
  const [debugData, setDebugData] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setJob(null);
    setSelectedTemplate('');
    setSelectedStoreIds([]);
    setDebugData(null);
    loadTemplates();
    return () => { if (pollTimer) clearInterval(pollTimer); };
  }, [open]);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await api('/api/shipping/templates');
      const data = await res.json();
      if (data.success) setTemplates(data.data || []);
    } catch { /* silent */ }
    setTemplatesLoading(false);
  };

  const selectedDomains = selectedStoreIds
    .map(id => (stores || []).find(s => s.id === id))
    .filter(s => s && s.shopDomain)
    .map(s => s.shopDomain);

  const storeChoices = (stores || []).map(s => ({
    label: `${s.name || s.shopDomain} (${s.shopDomain}.myshopify.com)`,
    value: s.id
  }));

  const templateOptions = templates.map(t => ({
    label: `${t.name} (${t.sourceStore}) — ${t.zoneCount} zones, ${t.rateCount} rates`,
    value: t.id
  }));

  const handleApply = async () => {
    if (!selectedTemplate || !selectedDomains.length) return;
    setApplying(true);
    setJob(null);
    setDebugData(null);
    try {
      const res = await api('/api/shipping/bulk-apply', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({templateId: selectedTemplate, shopDomains: selectedDomains})
      });
      const data = await res.json();
      if (data.success) {
        const initialJob = {
          id: data.data.jobId,
          status: 'running',
          stores: selectedDomains.map(d => ({shopDomain: d, status: 'pending', error: null}))
        };
        setJob(initialJob);
        startPolling(data.data.jobId);
      }
    } catch { /* silent */ }
  };

  const startPolling = (jobId) => {
    const timer = setInterval(async () => {
      try {
        const res = await api(`/api/shipping/bulk-apply/${jobId}`);
        const data = await res.json();
        if (data.success) {
          setJob(data.data);
          if (data.data.status !== 'running') {
            clearInterval(timer);
            setApplying(false);
          }
        }
      } catch {
        clearInterval(timer);
        setApplying(false);
      }
    }, 3000);
    setPollTimer(timer);
  };

  const handleDebug = async (shopDomain) => {
    if (!selectedTemplate) return;
    setDebugLoading(true);
    setDebugData(null);
    try {
      const res = await api(`/api/shipping/debug-match/${selectedTemplate}/${shopDomain}`);
      const data = await res.json();
      setDebugData(data.success ? data.data : {error: data.error});
    } catch (err) {
      setDebugData({error: err.message});
    }
    setDebugLoading(false);
  };

  const statusTone = {success: 'success', failed: 'critical', skipped: 'warning', partial: 'attention', pending: undefined};
  const completedCount = job?.stores?.filter(s => s.status !== 'pending').length || 0;
  const totalCount = job?.stores?.length || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const formatProfiles = (profiles) => {
    if (!profiles?.length) return 'No profiles';
    return profiles.map(p => {
      const zones = (p.locationGroups || []).flatMap(lg =>
        (lg.zones || []).map(z => {
          const rates = (z.rates || []).map(r => `${r.name}=$${r.price}`).join(', ');
          return `${z.zoneName} [${rates || 'no rates'}]`;
        })
      );
      return `${p.profileName}: ${zones.join('; ')}`;
    }).join('\n');
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (pollTimer) clearInterval(pollTimer); onClose(); }}
      title="Setup Shipping Rates"
      primaryAction={!job ? {
        content: 'Apply Shipping',
        onAction: handleApply,
        loading: applying,
        disabled: !selectedTemplate || !selectedDomains.length
      } : undefined}
      secondaryActions={[{content: job ? 'Close' : 'Cancel', onAction: () => { if (pollTimer) clearInterval(pollTimer); onClose(); }}]}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          <ChoiceList
            title="Select stores"
            allowMultiple
            choices={storeChoices}
            selected={selectedStoreIds}
            onChange={setSelectedStoreIds}
            disabled={applying}
          />

          {templatesLoading ? <Spinner size="small" /> : (
            <Select
              label="Shipping Template"
              options={[{label: '-- Select Template --', value: ''}, ...templateOptions]}
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              disabled={applying}
            />
          )}

          {templates.length === 0 && !templatesLoading && (
            <Card>
              <Text tone="subdued">
                No templates found. Go to Shipping page to create a template first.
              </Text>
            </Card>
          )}

          {job && (
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Badge tone={statusTone[job.status]}>{job.status}</Badge>
                <Text variant="bodySm">{completedCount}/{totalCount}</Text>
              </InlineStack>

              <ProgressBar progress={progress} tone={job.status === 'failed' ? 'critical' : 'primary'} />

              <IndexTable
                resourceName={{singular: 'store', plural: 'stores'}}
                itemCount={job.stores?.length || 0}
                headings={[{title: 'Store'}, {title: 'Status'}, {title: 'Error'}, {title: ''}]}
                selectable={false}
              >
                {(job.stores || []).map((s, i) => (
                  <IndexTable.Row id={s.shopDomain} key={s.shopDomain} position={i}>
                    <IndexTable.Cell>
                      <Text variant="bodySm" fontWeight="semibold">{s.shopDomain}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={statusTone[s.status]}>{s.status}</Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm" tone="critical">{s.error || '—'}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {(s.status === 'skipped' || s.status === 'failed') && (
                        <Button size="slim" onClick={() => handleDebug(s.shopDomain)}>
                          Debug
                        </Button>
                      )}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </BlockStack>
          )}

          {debugLoading && <Spinner size="small" />}

          {debugData && !debugData.error && (
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm">Debug: {debugData.shopDomain}</Text>
                <Text variant="bodySm" fontWeight="semibold">
                  Match result: {debugData.matchCount} update(s)
                </Text>

                <BlockStack gap="200">
                  <Text variant="bodySm" fontWeight="semibold">Template profiles:</Text>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <pre style={{whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0}}>
                      {formatProfiles(debugData.templateProfiles)}
                    </pre>
                  </Box>
                </BlockStack>

                <BlockStack gap="200">
                  <Text variant="bodySm" fontWeight="semibold">Live store profiles:</Text>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <pre style={{whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0}}>
                      {formatProfiles(debugData.liveProfiles)}
                    </pre>
                  </Box>
                </BlockStack>

                {debugData.matchCount === 0 && (
                  <Text tone="critical" variant="bodySm">
                    No matches found. Check if profile names, zone names, or rate names differ between template and store.
                  </Text>
                )}
              </BlockStack>
            </Card>
          )}

          {debugData?.error && (
            <Card>
              <Text tone="critical">Debug error: {debugData.error}</Text>
            </Card>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
