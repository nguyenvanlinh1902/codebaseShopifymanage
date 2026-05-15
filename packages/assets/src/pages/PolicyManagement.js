import React, {useState, useEffect, useCallback} from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text,
  TextField, Button, Badge, Toast, Spinner, ChoiceList,
  Modal, Box, Divider, Icon
} from '@shopify/polaris';
import {ChevronRightIcon} from '@shopify/polaris-icons';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {usePermittedStores} from '../hooks/usePermittedStores';
import {generatePolicies} from '../helpers/policy-templates';
import {api} from '../helpers/api';
import PolicyTemplateEditor from './policy-management/policy-template-editor';
import {QUILL_MODULES, QUILL_FORMATS} from './policy-management/quill-config';

const POLICY_TYPES = [
  {type: 'REFUND_POLICY', label: 'Return and refund policy'},
  {type: 'PRIVACY_POLICY', label: 'Privacy policy'},
  {type: 'TERMS_OF_SERVICE', label: 'Terms of service'},
  {type: 'SHIPPING_POLICY', label: 'Shipping policy'},
  {type: 'CONTACT_INFORMATION', label: 'Contact information'},
  {type: 'LEGAL_NOTICE', label: 'Legal notice'}
];

const EMPTY_CONTENT = Object.fromEntries(POLICY_TYPES.map(p => [p.type, '']));

const EMPTY_AUTO = Object.fromEntries(POLICY_TYPES.map(p => [p.type, false]));

function getPolicyStatus(body, autoManaged) {
  if (autoManaged) return {label: 'Automated', tone: 'automated'};
  if (body?.trim()) return {label: 'Set', tone: 'info'};
  return {label: 'No policy set', tone: undefined};
}

export default function PolicyManagement() {
  const {stores, loading: storesLoading} = usePermittedStores();
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [policyContent, setPolicyContent] = useState(EMPTY_CONTENT);
  const [autoManaged, setAutoManaged] = useState(EMPTY_AUTO);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResults, setApplyResults] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Custom templates from DB (keyed by type)
  const [customTemplates, setCustomTemplates] = useState({});

  // Edit modal
  const [editType, setEditType] = useState(null);

  const [togglingAuto, setTogglingAuto] = useState(false);

  // Shopify API supports DISABLE only (autoManaged ON → OFF via privacyFeaturesDisable).
  // Enabling autoManaged back must be done in Shopify Admin (no enable mutation exists).
  const handleToggleAutoManaged = async () => {
    const storeId = selectedStoreIds[0];
    const store = stores?.find(s => s.id === storeId);
    const domain = store?.shopDomain;
    if (!storeId || !domain) {
      setErrorMsg('Select a store first');
      return;
    }

    // OFF → must redirect to Shopify Admin (no API to enable)
    if (!autoManaged.PRIVACY_POLICY) {
      window.open(`https://admin.shopify.com/store/${domain}/settings/legal`, '_blank', 'noopener,noreferrer');
      return;
    }

    // ON → call API to disable
    try {
      setTogglingAuto(true);
      const res = await api('/api/setup/disable-auto-policy', {
        method: 'POST',
        body: JSON.stringify({storeIds: [storeId]})
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      const result = data.data?.[0];
      if (result?.error) throw new Error(result.error);
      setAutoManaged(prev => ({...prev, PRIVACY_POLICY: false}));
      setSuccessMsg('Auto-managed privacy policy disabled');
      await loadPolicies();
    } catch (err) {
      setErrorMsg(`Disable failed: ${err.message}`);
    } finally {
      setTogglingAuto(false);
    }
  };

  // Apply modal — per-store name + email
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [storeInputs, setStoreInputs] = useState({}); // { [storeId]: { name, email } }

  // Custom template editor modal
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);

  // Store list search + pagination (10 per page)
  const STORES_PER_PAGE = 10;
  const [storeSearch, setStoreSearch] = useState('');
  const [storePage, setStorePage] = useState(1);

  const filteredStores = (stores || []).filter(s => {
    if (!storeSearch.trim()) return true;
    const q = storeSearch.toLowerCase();
    return (s.name || '').toLowerCase().includes(q) ||
      (s.shopDomain || '').toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filteredStores.length / STORES_PER_PAGE));
  const currentPage = Math.min(storePage, totalPages);
  const pagedStores = filteredStores.slice(
    (currentPage - 1) * STORES_PER_PAGE,
    currentPage * STORES_PER_PAGE
  );
  const storeChoices = pagedStores.map(s => ({
    label: `${s.name || s.shopDomain} (${s.shopDomain}.myshopify.com)`,
    value: s.id
  }));

  // Reset to page 1 whenever search query changes
  useEffect(() => { setStorePage(1); }, [storeSearch]);

  const editPolicy = editType ? POLICY_TYPES.find(p => p.type === editType) : null;

  const loadPolicies = useCallback(async () => {
    if (selectedStoreIds.length === 0) return;
    setLoading(true);
    setApplyResults([]);
    setErrorMsg('');
    setPolicyContent(EMPTY_CONTENT);
    setAutoManaged(EMPTY_AUTO);

    try {
      const res = await api('/api/setup/check-policies', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const data = await res.json();
      if (!data.success) return;
      const firstStore = (data.data || []).find(s => !s.error && s.policies?.length > 0);
      if (firstStore) {
        setPolicyContent(prev => {
          const updated = {...prev};
          firstStore.policies.forEach(p => {
            if (p.body) updated[p.type] = p.body;
          });
          return updated;
        });
        setAutoManaged(prev => {
          const updated = {...prev};
          firstStore.policies.forEach(p => {
            if (p.type in updated) updated[p.type] = p.autoManaged || false;
          });
          return updated;
        });
      }
    } catch (err) { console.warn('Load policies failed:', err); } finally {
      setLoading(false);
    }
  }, [selectedStoreIds]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  // Fetch custom templates from DB on mount
  useEffect(() => {
    api('/api/policy-templates').then(r => r.json()).then(data => {
      if (data.success) {
        const map = {};
        (data.data || []).forEach(t => { map[t.type] = t.body; });
        setCustomTemplates(map);
      }
    }).catch(err => console.warn('Load custom templates failed:', err));
  }, []);

  // Open apply modal — auto-fill store name from each selected store
  const handleOpenApplyModal = () => {
    if (!selectedStoreIds.length || !stores?.length) return;
    const inputs = {};
    selectedStoreIds.forEach(id => {
      const store = stores.find(s => s.id === id);
      inputs[id] = {name: store?.name || store?.shopDomain || '', email: ''};
    });
    setStoreInputs(inputs);
    setTemplateModalOpen(true);
  };

  const updateStoreInput = (storeId, field, value) => {
    setStoreInputs(prev => ({...prev, [storeId]: {...prev[storeId], [field]: value}}));
  };

  const allInputsValid = selectedStoreIds.every(
    id => storeInputs[id]?.name?.trim() && storeInputs[id]?.email?.trim()
  );

  // Generate per-store policies + apply each store with its own template
  const handleApplyWithTemplate = async () => {
    if (!allInputsValid || !selectedStoreIds.length) return;

    setTemplateModalOpen(false);

    try {
      setApplying(true);
      setApplyResults([]);
      setSuccessMsg('');
      setErrorMsg('');

      // Apply each store with its own generated policies
      const results = await Promise.all(
        selectedStoreIds.map(async storeId => {
          const {name, email} = storeInputs[storeId];
          const generated = generatePolicies(name, email, customTemplates);
          const policies = POLICY_TYPES
            .filter(p => generated[p.type]?.trim())
            .map(p => ({type: p.type, body: generated[p.type]}));

          const res = await api('/api/setup/apply-policies', {
            method: 'POST',
            body: JSON.stringify({storeIds: [storeId], policies})
          });
          const data = await res.json();
          return data.success ? data.data[0] : {storeId, storeName: name, updated: [], errors: [{type: 'store', error: data.error}]};
        })
      );

      setApplyResults(results);
      const totalUpdated = results.reduce((sum, s) => sum + s.updated.length, 0);
      const failedDetails = results.flatMap(s =>
        (s.errors || []).map(e => `${s.storeName} - ${e.type}: ${e.error}`)
      );
      setSuccessMsg(`${totalUpdated} policies updated across ${results.length} store(s).`);
      if (failedDetails.length > 0) setErrorMsg(failedDetails.join('; '));

      // Update local display with last store's content
      const lastId = selectedStoreIds[selectedStoreIds.length - 1];
      const lastGenerated = generatePolicies(storeInputs[lastId].name, storeInputs[lastId].email, customTemplates);
      setPolicyContent(prev => ({...prev, ...lastGenerated}));
    } catch (err) {
      console.warn('Apply policies failed:', err);
      setErrorMsg('Request failed');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Page title="Policy Management">
      <Layout>
        {successMsg && (
          <Toast content={successMsg} onDismiss={() => setSuccessMsg('')} />
        )}
        {errorMsg && (
          <Toast content={errorMsg} error onDismiss={() => setErrorMsg('')} />
        )}

        {/* Store selection */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Select Stores</Text>
              {storesLoading ? (
                <Spinner size="small" />
              ) : (
                <BlockStack gap="300">
                  <TextField
                    label="Search stores"
                    labelHidden
                    placeholder="Search by name or domain"
                    value={storeSearch}
                    onChange={setStoreSearch}
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setStoreSearch('')}
                    disabled={applying}
                  />
                  {filteredStores.length === 0 ? (
                    <Text tone="subdued">No stores match your search.</Text>
                  ) : (
                    <ChoiceList
                      title="Stores"
                      titleHidden
                      allowMultiple
                      choices={storeChoices}
                      selected={selectedStoreIds}
                      onChange={setSelectedStoreIds}
                      disabled={applying}
                    />
                  )}
                  {totalPages > 1 && (
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm" tone="subdued">
                        Page {currentPage} of {totalPages} · {filteredStores.length} stores
                      </Text>
                      <InlineStack gap="100">
                        <Button
                          size="slim"
                          disabled={currentPage <= 1}
                          onClick={() => setStorePage(p => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          size="slim"
                          disabled={currentPage >= totalPages}
                          onClick={() => setStorePage(p => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </InlineStack>
                    </InlineStack>
                  )}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Written policies list */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Written policies</Text>
                  <Text variant="bodySm" tone="subdued">
                    Policies are linked in the footer of checkout and can be added to your online store menu.
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Button onClick={() => setTemplateEditorOpen(true)} size="slim">
                    Customize Templates
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleOpenApplyModal}
                    disabled={applying || loading || !selectedStoreIds.length}
                    loading={applying}
                    size="slim"
                  >
                    Apply All
                  </Button>
                </InlineStack>
              </InlineStack>

              {loading ? (
                <InlineStack align="center" gap="200">
                  <Spinner size="small" />
                  <Text tone="subdued">Loading policies...</Text>
                </InlineStack>
              ) : selectedStoreIds.length === 0 ? (
                <Text tone="subdued">Select stores to load current policies.</Text>
              ) : (
                <BlockStack gap="0">
                  <Divider />
                  {POLICY_TYPES.map(p => {
                    const status = getPolicyStatus(policyContent[p.type], autoManaged[p.type]);
                    return (
                      <React.Fragment key={p.type}>
                        <Box
                          paddingBlockStart="300"
                          paddingBlockEnd="300"
                          paddingInlineStart="300"
                          paddingInlineEnd="300"
                        >
                          <div
                            onClick={() => setEditType(p.type)}
                            style={{cursor: 'pointer'}}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter') setEditType(p.type); }}
                          >
                            <InlineStack align="space-between" blockAlign="center" wrap={false}>
                              <Text variant="bodyMd">{p.label}</Text>
                              <InlineStack gap="200" blockAlign="center" wrap={false}>
                                {status.tone === 'automated' ? (
                                  <InlineStack gap="100" blockAlign="center">
                                    <span style={{
                                      width: 8, height: 8, borderRadius: '50%',
                                      backgroundColor: '#1f8b3b', display: 'inline-block'
                                    }} />
                                    <Text variant="bodySm" tone="subdued">{status.label}</Text>
                                  </InlineStack>
                                ) : status.tone === 'info' ? (
                                  <Badge tone="info">{status.label}</Badge>
                                ) : (
                                  <Text variant="bodySm" tone="subdued">{status.label}</Text>
                                )}
                                <Icon source={ChevronRightIcon} tone="subdued" />
                              </InlineStack>
                            </InlineStack>
                          </div>
                        </Box>
                        <Divider />
                      </React.Fragment>
                    );
                  })}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Results */}
        {applyResults.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Results</Text>
                {applyResults.map(store => (
                  <Card key={store.storeId}>
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="bodyMd" fontWeight="semibold">{store.storeName}</Text>
                      {store.updated.length > 0 && <Badge tone="success">{store.updated.length} updated</Badge>}
                      {store.errors.length > 0 && <Badge tone="critical">{store.errors.length} failed</Badge>}
                    </InlineStack>
                    {store.errors.length > 0 && (
                      <BlockStack gap="100">
                        {store.errors.map((e, i) => (
                          <Text key={i} variant="bodySm" tone="critical">{e.type}: {e.error}</Text>
                        ))}
                      </BlockStack>
                    )}
                  </Card>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {/* Edit policy modal */}
      <Modal
        open={!!editType}
        onClose={() => setEditType(null)}
        title={editPolicy?.label || ''}
        primaryAction={{content: 'Save', onAction: () => setEditType(null)}}
        secondaryActions={[{content: 'Cancel', onAction: () => setEditType(null)}]}
        large
      >
        {/* AutoManaged status — always show for Privacy Policy */}
        {editType === 'PRIVACY_POLICY' && (
          <Box padding="400" borderBlockEndWidth="025" borderColor="border">
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <BlockStack gap="050">
                <Text variant="bodySm" fontWeight="semibold">Use automated policy</Text>
                <Text variant="bodySm" tone="subdued">
                  {autoManaged.PRIVACY_POLICY
                    ? 'Click to disable. Shopify-generated content will be replaced when you save custom text.'
                    : 'To re-enable, open Shopify Admin → Settings → Policies (Shopify API does not support enabling).'}
                </Text>
              </BlockStack>
              <div
                role="button"
                tabIndex={0}
                aria-disabled={togglingAuto}
                title={autoManaged.PRIVACY_POLICY ? 'Disable auto-managed policy' : 'Open Shopify Admin to enable'}
                onClick={togglingAuto ? undefined : handleToggleAutoManaged}
                onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !togglingAuto) { e.preventDefault(); handleToggleAutoManaged(); } }}
                style={{
                  width: 40, height: 22, borderRadius: 11, padding: 2,
                  backgroundColor: autoManaged.PRIVACY_POLICY ? '#303030' : '#b5b5b5',
                  flexShrink: 0, marginLeft: 12,
                  cursor: togglingAuto ? 'wait' : 'pointer',
                  opacity: togglingAuto ? 0.6 : 1,
                  transition: 'background-color 0.15s'
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
                  transform: autoManaged.PRIVACY_POLICY ? 'translateX(18px)' : 'translateX(0)',
                  transition: 'transform 0.15s'
                }} />
              </div>
            </InlineStack>
          </Box>
        )}

        {/* Editor area */}
        <Modal.Section>
          <style>{`
            .policy-editor .ql-container { min-height: 320px; font-size: 14px; }
            .policy-editor .ql-editor { min-height: 320px; }
            .policy-editor .ql-toolbar { border-top: 0; }
          `}</style>
          <div className="policy-editor">
            <ReactQuill
              theme="snow"
              value={editType ? policyContent[editType] : ''}
              onChange={val => editType && setPolicyContent(prev => ({...prev, [editType]: val}))}
              modules={QUILL_MODULES}
              formats={QUILL_FORMATS}
              placeholder="Enter policy content..."
            />
          </div>
        </Modal.Section>
      </Modal>

      {/* Template modal */}
      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Apply Policies from Template"
        primaryAction={{
          content: applying ? 'Applying...' : `Generate & Apply (${selectedStoreIds.length} store${selectedStoreIds.length > 1 ? 's' : ''})`,
          onAction: handleApplyWithTemplate,
          disabled: !allInputsValid || applying,
          loading: applying
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setTemplateModalOpen(false)}]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text variant="bodySm" tone="subdued">
              Enter store name and support email for each store. Policies will be generated and applied automatically.
            </Text>
            {selectedStoreIds.map(storeId => {
              const store = stores?.find(s => s.id === storeId);
              const domain = store?.shopDomain || '';
              const input = storeInputs[storeId] || {name: '', email: ''};
              return (
                <Card key={storeId}>
                  <BlockStack gap="200">
                    <Text variant="headingSm">{domain}.myshopify.com</Text>
                    <InlineStack gap="300" wrap={false}>
                      <div style={{flex: 1}}>
                        <TextField
                          label="Store Name"
                          value={input.name}
                          onChange={val => updateStoreInput(storeId, 'name', val)}
                          placeholder="My Store"
                          autoComplete="off"
                        />
                      </div>
                      <div style={{flex: 1}}>
                        <TextField
                          label="Support Email"
                          value={input.email}
                          onChange={val => updateStoreInput(storeId, 'email', val)}
                          placeholder="support@example.com"
                          type="email"
                          autoComplete="off"
                        />
                      </div>
                    </InlineStack>
                  </BlockStack>
                </Card>
              );
            })}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Template editor modal */}
      <Modal
        open={templateEditorOpen}
        onClose={() => setTemplateEditorOpen(false)}
        title="Customize Policy Templates"
        large
      >
        <Modal.Section>
          <PolicyTemplateEditor
            customTemplates={customTemplates}
            onTemplatesChange={updated => {
              setCustomTemplates(updated);
              setTemplateEditorOpen(false);
            }}
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}
