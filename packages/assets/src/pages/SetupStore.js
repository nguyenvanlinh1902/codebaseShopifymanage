import React, {useState, useEffect} from 'react';
import {
  Page, Layout, Banner, Card, Text, BlockStack,
  Button, Modal, ChoiceList, InlineStack, Spinner, Badge,
  IndexTable, Select
} from '@shopify/polaris';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import PolicySetup from './setup-store/PolicySetup';

const SETUP_STEPS = [
  {value: 'metafields', label: 'Metafields — Create metafield definitions'},
  {value: 'themes', label: 'Themes — Import saved theme'},
  {value: 'shipping', label: 'Shipping — Apply shipping rate template'}
];

export default function SetupStore() {
  const {stores, loading: storesLoading} = usePermittedStores();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);

  // Theme/shipping options
  const [savedThemes, setSavedThemes] = useState([]);
  const [savedThemesLoading, setSavedThemesLoading] = useState(true);
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [shippingTemplates, setShippingTemplates] = useState([]);
  const [shippingTemplatesLoading, setShippingTemplatesLoading] = useState(true);
  const [selectedShippingTemplate, setSelectedShippingTemplate] = useState('');

  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadSavedThemes();
    loadShippingTemplates();
  }, []);

  const loadSavedThemes = async () => {
    try {
      setSavedThemesLoading(true);
      const res = await api('/api/themes/imported');
      const data = await res.json();
      if (data.success) setSavedThemes(data.data || []);
    } catch { /* silent */ } finally {
      setSavedThemesLoading(false);
    }
  };

  const loadShippingTemplates = async () => {
    try {
      setShippingTemplatesLoading(true);
      const res = await api('/api/shipping/templates');
      const data = await res.json();
      if (data.success) setShippingTemplates(data.data || []);
    } catch { /* silent */ } finally {
      setShippingTemplatesLoading(false);
    }
  };

  const openModal = () => {
    setSelectedSteps([]);
    setSelectedStoreIds([]);
    setSelectedThemeId('');
    setSelectedShippingTemplate('');
    setResults([]);
    setModalOpen(true);
  };

  const handleApply = async () => {
    if (!selectedSteps.length || !selectedStoreIds.length) return;
    setApplying(true);
    setResults([]);
    const allResults = [];

    // Metafields
    if (selectedSteps.includes('metafields')) {
      try {
        const res = await api('/api/setup/apply', {
          method: 'POST',
          body: JSON.stringify({storeIds: selectedStoreIds})
        });
        const data = await res.json();
        if (data.success) {
          const created = (data.data || []).reduce((s, r) => s + (r.created?.length || 0), 0);
          allResults.push({step: 'Metafields', success: true, detail: created > 0 ? `Created ${created}` : 'All exist'});
        } else {
          allResults.push({step: 'Metafields', success: false, detail: data.error || 'Failed'});
        }
      } catch {
        allResults.push({step: 'Metafields', success: false, detail: 'Request failed'});
      }
    }

    // Themes
    if (selectedSteps.includes('themes') && selectedThemeId) {
      const theme = savedThemes.find(t => t.id === selectedThemeId);
      let ok = 0;
      let fail = 0;
      for (const storeId of selectedStoreIds) {
        try {
          const res = await api(`/api/themes/imported/${selectedThemeId}/reimport`, {
            method: 'POST',
            body: JSON.stringify({storeId, themeName: theme?.themeName})
          });
          const data = await res.json();
          if (data.success) ok++;
          else fail++;
        } catch {
          fail++;
        }
      }
      allResults.push({step: 'Themes', success: fail === 0, detail: `${ok} OK, ${fail} failed`});
    }

    // Shipping
    if (selectedSteps.includes('shipping') && selectedShippingTemplate) {
      try {
        const shopDomains = selectedStoreIds
          .map(id => stores.find(s => s.id === id))
          .filter(s => s?.shopDomain)
          .map(s => s.shopDomain);
        const res = await api('/api/shipping/bulk-apply', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({templateId: selectedShippingTemplate, shopDomains})
        });
        const data = await res.json();
        if (data.success) {
          allResults.push({step: 'Shipping', success: true, detail: 'Job started'});
        } else {
          allResults.push({step: 'Shipping', success: false, detail: data.error || 'Failed'});
        }
      } catch {
        allResults.push({step: 'Shipping', success: false, detail: 'Request failed'});
      }
    }

    setResults(allResults);
    setApplying(false);
    const successCount = allResults.filter(r => r.success).length;
    setSuccessMsg(`Setup complete: ${successCount}/${allResults.length} steps succeeded.`);
  };

  const storeChoices = stores.map(s => ({
    label: `${s.name || s.shopDomain} (${s.shopDomain}.myshopify.com)`,
    value: s.id
  }));

  const themeOptions = savedThemes.map(t => ({label: t.themeName, value: t.id}));
  const shippingOptions = shippingTemplates.map(t => ({
    label: `${t.name} (${t.sourceStore}) — ${t.zoneCount} zones`,
    value: t.id
  }));

  const needsTheme = selectedSteps.includes('themes');
  const needsShipping = selectedSteps.includes('shipping');
  const canApply = selectedSteps.length > 0 && selectedStoreIds.length > 0
    && (!needsTheme || selectedThemeId)
    && (!needsShipping || selectedShippingTemplate);

  return (
    <Page title="Setup Store">
      <Layout>
        {successMsg && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMsg('')}>{successMsg}</Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Store Setup</Text>
              <Text variant="bodySm" tone="subdued">
                Setup metafields, themes, policies, and shipping rates for multiple stores at once.
              </Text>
              <InlineStack gap="300">
                <Button variant="primary" onClick={openModal}>
                  Open Setup
                </Button>
                <Button onClick={() => setPolicyModalOpen(true)}>
                  Setup Policies
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Setup Stores"
        primaryAction={{
          content: applying ? 'Applying...' : 'Apply Setup',
          onAction: handleApply,
          loading: applying,
          disabled: !canApply
        }}
        secondaryActions={[{content: 'Close', onAction: () => setModalOpen(false)}]}
        large
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Step 1: Select steps */}
            <ChoiceList
              title="Select setup steps"
              allowMultiple
              choices={SETUP_STEPS}
              selected={selectedSteps}
              onChange={setSelectedSteps}
              disabled={applying}
            />

            {/* Theme selector (if themes step selected) */}
            {needsTheme && (
              savedThemesLoading ? <Spinner size="small" /> : (
                <Select
                  label="Theme to import"
                  options={[{label: '-- Select Theme --', value: ''}, ...themeOptions]}
                  value={selectedThemeId}
                  onChange={setSelectedThemeId}
                  disabled={applying}
                />
              )
            )}

            {/* Shipping template selector (if shipping step selected) */}
            {needsShipping && (
              shippingTemplatesLoading ? <Spinner size="small" /> : (
                <Select
                  label="Shipping template"
                  options={[{label: '-- Select Template --', value: ''}, ...shippingOptions]}
                  value={selectedShippingTemplate}
                  onChange={setSelectedShippingTemplate}
                  disabled={applying}
                />
              )
            )}

            {/* Step 2: Select stores */}
            {storesLoading ? <Spinner size="small" /> : (
              <ChoiceList
                title="Select stores"
                allowMultiple
                choices={storeChoices}
                selected={selectedStoreIds}
                onChange={setSelectedStoreIds}
                disabled={applying}
              />
            )}

            {/* Results */}
            {results.length > 0 && (
              <IndexTable
                resourceName={{singular: 'step', plural: 'steps'}}
                itemCount={results.length}
                headings={[{title: 'Step'}, {title: 'Status'}, {title: 'Detail'}]}
                selectable={false}
              >
                {results.map((r, i) => (
                  <IndexTable.Row id={r.step} key={r.step} position={i}>
                    <IndexTable.Cell>
                      <Text variant="bodySm" fontWeight="semibold">{r.step}</Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={r.success ? 'success' : 'critical'}>
                        {r.success ? '✓' : '✗'}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text variant="bodySm">{r.detail}</Text>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      <PolicySetup
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        stores={stores}
        onSuccess={msg => { setPolicyModalOpen(false); setSuccessMsg(msg); }}
      />
    </Page>
  );
}
