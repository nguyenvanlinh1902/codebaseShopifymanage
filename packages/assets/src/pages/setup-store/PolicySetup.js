import React, {useState, useEffect} from 'react';
import {
  Modal, BlockStack, Text, Tabs, TextField, InlineStack,
  Badge, Spinner, Card, ChoiceList, Banner, Button
} from '@shopify/polaris';
import {api} from '../../helpers/api';
import {generatePolicies} from '../../helpers/policy-templates';

const POLICY_TYPES = [
  {type: 'REFUND_POLICY', label: 'Refund Policy'},
  {type: 'PRIVACY_POLICY', label: 'Privacy Policy'},
  {type: 'TERMS_OF_SERVICE', label: 'Terms of Service'},
  {type: 'SHIPPING_POLICY', label: 'Shipping Policy'},
  {type: 'CONTACT_INFORMATION', label: 'Contact Information'}
];

const EMPTY_CONTENT = Object.fromEntries(POLICY_TYPES.map(p => [p.type, '']));

export default function PolicySetup({open, onClose, stores, onSuccess}) {
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [policyContent, setPolicyContent] = useState(EMPTY_CONTENT);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResults, setApplyResults] = useState([]);
  const [templateEmail, setTemplateEmail] = useState('');

  const tabs = POLICY_TYPES.map(p => ({
    id: p.type, content: p.label, panelID: `${p.type}-panel`
  }));

  const currentType = POLICY_TYPES[selectedTab].type;
  const currentLabel = POLICY_TYPES[selectedTab].label;

  const storeChoices = (stores || []).map(s => ({
    label: `${s.name || s.shopDomain} (${s.shopDomain}.myshopify.com)`,
    value: s.id
  }));

  // Auto-load policies when stores are selected
  useEffect(() => {
    if (!open || selectedStoreIds.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setApplyResults([]);
    setPolicyContent(EMPTY_CONTENT);

    api('/api/setup/check-policies', {
      method: 'POST',
      body: JSON.stringify({storeIds: selectedStoreIds})
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data.success) return;
        const firstStore = (data.data || []).find(s => !s.error && s.policies?.length > 0);
        if (firstStore) {
          setPolicyContent(prev => {
            const updated = {...prev};
            firstStore.policies.forEach(p => {
              if (p.body) updated[p.type] = p.body;
            });
            return updated;
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, selectedStoreIds]);

  const handleApply = async () => {
    const policies = POLICY_TYPES.filter(p => policyContent[p.type]?.trim()).map(p => ({
      type: p.type, body: policyContent[p.type]
    }));
    if (policies.length === 0 || !selectedStoreIds.length) return;

    try {
      setApplying(true);
      setApplyResults([]);
      const res = await api('/api/setup/apply-policies', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds, policies})
      });
      const data = await res.json();
      if (data.success) {
        setApplyResults(data.data || []);
        const totalUpdated = (data.data || []).reduce((sum, s) => sum + s.updated.length, 0);
        onSuccess(`Policies applied: ${totalUpdated} updated across ${data.data.length} store(s).`);
      }
    } catch { /* silent */ } finally {
      setApplying(false);
    }
  };

  // Get store name from first selected store for template generation
  const getSelectedStoreName = () => {
    if (!selectedStoreIds.length || !stores?.length) return '';
    const store = stores.find(s => s.id === selectedStoreIds[0]);
    return store?.name || store?.shopDomain || '';
  };

  const handleGenerateFromTemplate = () => {
    const storeName = getSelectedStoreName();
    if (!storeName || !templateEmail.trim()) return;
    const generated = generatePolicies(storeName, templateEmail.trim());
    setPolicyContent(prev => ({...prev, ...generated}));
  };

  const filledCount = POLICY_TYPES.filter(p => policyContent[p.type]?.trim()).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Setup Policies"
      primaryAction={{
        content: applying ? 'Applying...' : `Apply Policies (${filledCount})`,
        onAction: handleApply,
        disabled: filledCount === 0 || applying || loading || !selectedStoreIds.length,
        loading: applying
      }}
      secondaryActions={[{content: 'Close', onAction: onClose}]}
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
            disabled={applying}
          />

          {loading ? (
            <InlineStack align="center">
              <Spinner size="small" />
              <Text tone="subdued">Loading current policies...</Text>
            </InlineStack>
          ) : selectedStoreIds.length > 0 ? (
            <BlockStack gap="300">
              {/* Generate from template */}
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingSm">Generate from Template</Text>
                  <Text variant="bodySm" tone="subdued">
                    Enter support email to auto-fill all 4 policies using store name "{getSelectedStoreName()}".
                  </Text>
                  <InlineStack gap="300" blockAlign="end">
                    <div style={{flex: 1}}>
                      <TextField
                        label="Support Email"
                        type="email"
                        value={templateEmail}
                        onChange={setTemplateEmail}
                        placeholder="support@example.com"
                        autoComplete="email"
                      />
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleGenerateFromTemplate}
                      disabled={!templateEmail.trim() || !getSelectedStoreName()}
                    >
                      Generate All Policies
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
                <BlockStack gap="300">
                  <TextField
                    label={currentLabel}
                    value={policyContent[currentType]}
                    onChange={val => setPolicyContent(prev => ({...prev, [currentType]: val}))}
                    multiline={14}
                    placeholder={`Enter ${currentLabel} content (HTML supported)...`}
                    autoComplete="off"
                  />
                  {policyContent[currentType]?.trim() && <Badge tone="success">Content set</Badge>}
                </BlockStack>
              </Tabs>
            </BlockStack>
          ) : (
            <Text tone="subdued">Select stores to load current policies.</Text>
          )}

          {applyResults.length > 0 && (
            <BlockStack gap="200">
              <Text variant="headingSm">Results</Text>
              {applyResults.map(store => (
                <Card key={store.storeId}>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodyMd" fontWeight="semibold">{store.storeName}</Text>
                    {store.updated.length > 0 && <Badge tone="success">{store.updated.length} updated</Badge>}
                    {store.errors.length > 0 && <Badge tone="critical">{store.errors.length} failed</Badge>}
                  </InlineStack>
                </Card>
              ))}
              <Banner tone="info">
                "Use automated policy" can only be toggled in each store's Shopify Admin (Settings &gt; Policies).
              </Banner>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
