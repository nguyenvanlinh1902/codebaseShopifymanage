import React, {useState, useEffect, useRef} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  Select,
  Badge,
  IndexTable,
  ProgressBar,
  Spinner
} from '@shopify/polaris';
import {api} from '../../helpers/api';
import SearchableChoiceList from '../../components/searchable-choice-list';

export default function BulkApplyTab({templates, stores, groups, onError, onSuccess}) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);
  const [applying, setApplying] = useState(false);
  const [job, setJob] = useState(null);
  const pollRef = useRef(null);

  const templateOptions = templates.map(t => ({label: `${t.name} (${t.sourceStore})`, value: t.id}));
  const groupOptions = groups.map(g => ({label: g.name, value: g.id}));

  // Get target store domains based on filter
  const getTargetDomains = () => {
    if (filterType === 'all') return stores.map(s => s.shopDomain);
    if (filterType === 'group' && selectedGroup) {
      return stores.filter(s => s.groupId === selectedGroup).map(s => s.shopDomain);
    }
    return selectedStores;
  };

  const targetDomains = getTargetDomains();
  const canApply = selectedTemplate && targetDomains.length > 0;

  // Store options for individual selection
  const storeChoices = stores.map(s => ({label: s.name || s.shopDomain, value: s.shopDomain}));

  // Poll job status
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const pollJobStatus = (jobId) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api(`/api/shipping/bulk-apply/${jobId}`);
        const data = await res.json();
        if (data.success) {
          setJob(data.data);
          if (data.data.status !== 'running') {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setApplying(false);
            if (data.data.status === 'completed') onSuccess('Bulk apply completed successfully');
            else if (data.data.status === 'partial') onSuccess('Bulk apply completed with some errors');
            else onError('Bulk apply failed');
          }
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setApplying(false);
      }
    }, 3000);
  };

  const handleApply = async () => {
    if (!canApply) return;
    setApplying(true);
    setJob(null);
    try {
      const res = await api('/api/shipping/bulk-apply', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({templateId: selectedTemplate, shopDomains: targetDomains})
      });
      const data = await res.json();
      if (data.success) {
        setJob({id: data.data.jobId, status: 'running', stores: targetDomains.map(d => ({shopDomain: d, status: 'pending'}))});
        pollJobStatus(data.data.jobId);
      } else {
        onError(data.error);
        setApplying(false);
      }
    } catch {
      onError('Failed to start bulk apply');
      setApplying(false);
    }
  };

  const [debugData, setDebugData] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  const handleDebug = async shopDomain => {
    if (!selectedTemplate) return;
    setDebugLoading(true);
    setDebugData(null);
    try {
      // Fetch template and live rates in parallel (uses existing endpoints)
      const [tplRes, ratesRes] = await Promise.all([
        api(`/api/shipping/templates/${selectedTemplate}`),
        api(`/api/shipping/stores/${shopDomain}/rates`)
      ]);
      const [tplData, ratesData] = await Promise.all([
        tplRes.json(),
        ratesRes.json()
      ]);
      if (!tplData.success) {
        setDebugData({error: `Template: ${tplData.error}`});
      } else if (!ratesData.success) {
        setDebugData({error: `Store rates: ${ratesData.error}`});
      } else {
        setDebugData({
          shopDomain,
          templateName: tplData.data.name,
          templateProfiles: tplData.data.profiles || [],
          liveProfiles: ratesData.data || [],
          matchCount: '(compare below)'
        });
      }
    } catch (err) {
      setDebugData({error: err.message});
    }
    setDebugLoading(false);
  };

  const formatProfiles = profiles => {
    if (!profiles?.length) return 'No profiles';
    return profiles
      .map(p => {
        const zones = (p.locationGroups || []).flatMap(lg =>
          (lg.zones || []).map(z => {
            const rates = (z.rates || [])
              .map(r => `${r.name}=$${r.price}`)
              .join(', ');
            return `  ${z.zoneName} [${rates || 'no rates'}]`;
          })
        );
        return `${p.profileName}:\n${zones.join('\n')}`;
      })
      .join('\n\n');
  };

  const statusTone = {success: 'success', failed: 'critical', skipped: 'warning', partial: 'attention', pending: undefined};

  const completedCount = job?.stores?.filter(s => s.status !== 'pending').length || 0;
  const totalCount = job?.stores?.length || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Box padding="400">
      <BlockStack gap="400">
        {/* Template selector */}
        <Card>
          <BlockStack gap="300">
            <Select
              label="Template"
              options={[{label: '-- Select Template --', value: ''}, ...templateOptions]}
              value={selectedTemplate}
              onChange={setSelectedTemplate}
            />

            <InlineStack gap="300" blockAlign="end" wrap>
              <div className="filter-item filter-item--xs">
                <Select
                  label="Apply to"
                  options={[
                    {label: 'All Stores', value: 'all'},
                    {label: 'By Group', value: 'group'},
                    {label: 'Select Stores', value: 'individual'}
                  ]}
                  value={filterType}
                  onChange={v => { setFilterType(v); setSelectedGroup(''); setSelectedStores([]); }}
                />
              </div>
              {filterType === 'group' && (
                <div className="filter-item filter-item--md">
                  <Select
                    label="Group"
                    options={[{label: '-- Select Group --', value: ''}, ...groupOptions]}
                    value={selectedGroup}
                    onChange={setSelectedGroup}
                  />
                </div>
              )}
            </InlineStack>

            {filterType === 'individual' && (
              <SearchableChoiceList
                title="Select stores"
                choices={storeChoices}
                selected={selectedStores}
                onChange={setSelectedStores}
                showSelectAll
                searchPlaceholder="Search stores..."
              />
            )}

            <InlineStack align="space-between" blockAlign="center">
              <Text variant="bodySm" tone="subdued">
                {targetDomains.length} store(s) selected
              </Text>
              <Button
                variant="primary"
                onClick={handleApply}
                loading={applying}
                disabled={!canApply || applying}
              >
                Apply Template
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Job Progress */}
        {job && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingSm">
                  Job: <Badge tone={statusTone[job.status]}>{job.status}</Badge>
                </Text>
                <Text variant="bodySm">{completedCount}/{totalCount} stores</Text>
              </InlineStack>

              <ProgressBar progress={progress} tone={job.status === 'failed' ? 'critical' : 'primary'} />

              {/* Per-store results */}
              <Card padding="0">
                <IndexTable
                  resourceName={{singular: 'store', plural: 'stores'}}
                  itemCount={job.stores?.length || 0}
                  headings={[{title: 'Store'}, {title: 'Status'}, {title: 'Error'}, {title: ''}]}
                  selectable={false}
                >
                  {(job.stores || []).map((s, i) => (
                    <IndexTable.Row id={s.shopDomain} key={s.shopDomain} position={i}>
                      <IndexTable.Cell>
                        <Text variant="bodyMd" fontWeight="semibold">{s.shopDomain}</Text>
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
              </Card>

              {debugLoading && <Spinner size="small" />}

              {debugData && !debugData.error && (
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm">
                      Debug: {debugData.shopDomain} — {debugData.matchCount} match(es)
                    </Text>
                    <BlockStack gap="200">
                      <Text variant="bodySm" fontWeight="semibold">
                        Template profiles:
                      </Text>
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <pre style={{whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0}}>
                          {formatProfiles(debugData.templateProfiles)}
                        </pre>
                      </Box>
                    </BlockStack>
                    <BlockStack gap="200">
                      <Text variant="bodySm" fontWeight="semibold">
                        Live store profiles:
                      </Text>
                      <Box
                        padding="200"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <pre style={{whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0}}>
                          {formatProfiles(debugData.liveProfiles)}
                        </pre>
                      </Box>
                    </BlockStack>
                    {debugData.matchCount === 0 && (
                      <Text tone="critical" variant="bodySm">
                        No matches. Profile/zone/rate names differ between template and store.
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
          </Card>
        )}

        {!job && !applying && (
          <Card>
            <Text tone="subdued">
              Select a template and target stores, then click "Apply Template" to bulk update shipping rates.
            </Text>
          </Card>
        )}
      </BlockStack>
    </Box>
  );
}
