/* eslint-disable react/prop-types */
import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Modal,
  TextField,
  Select,
  Banner,
  Spinner
} from '@shopify/polaris';
import {api} from '../../helpers/api';

const TYPE_OPTIONS = [
  {label: 'Single line text', value: 'single_line_text_field'},
  {label: 'Multi line text', value: 'multi_line_text_field'},
  {label: 'Integer', value: 'number_integer'},
  {label: 'Decimal', value: 'number_decimal'},
  {label: 'Boolean', value: 'boolean'},
  {label: 'URL', value: 'url'}
];

const EMPTY_FIELD = {namespace: '', key: '', value: '', type: 'single_line_text_field'};
const EMPTY_DEF = {name: '', namespace: '', key: '', type: 'single_line_text_field'};

export default function ProductMetafields({formData, onChange, storeId}) {
  const [definitions, setDefinitions] = useState([]);
  const [loadingDefs, setLoadingDefs] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [defModal, setDefModal] = useState(false);
  const [newField, setNewField] = useState(EMPTY_FIELD);
  const [newDef, setNewDef] = useState(EMPTY_DEF);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewTab, setViewTab] = useState('all');
  const [viewQuery, setViewQuery] = useState('');

  const metafields = formData.metafields || [];
  const PREVIEW_COUNT = 2;

  // Merge definitions with existing metafield values so definition-only rows are editable too
  const rows = [];
  const seen = new Set();
  definitions.forEach(def => {
    const key = `${def.namespace}.${def.key}`;
    seen.add(key);
    const existing = metafields.find(m => m.namespace === def.namespace && m.key === def.key);
    rows.push({
      namespace: def.namespace,
      key: def.key,
      type: def.type || existing?.type || 'single_line_text_field',
      name: def.name,
      value: existing?.value || '',
      index: existing ? metafields.indexOf(existing) : -1
    });
  });
  metafields.forEach((mf, i) => {
    const key = `${mf.namespace}.${mf.key}`;
    if (seen.has(key)) return;
    rows.push({
      namespace: mf.namespace,
      key: mf.key,
      type: mf.type,
      name: null,
      value: mf.value || '',
      index: i
    });
  });

  const visibleRows = showAll ? rows : rows.slice(0, PREVIEW_COUNT);
  const hasMore = rows.length > PREVIEW_COUNT;

  const fetchDefinitions = useCallback(async () => {
    if (!storeId) return;
    setLoadingDefs(true);
    try {
      const res = await api(`/api/shopify-products/metafield-definitions?storeId=${storeId}`);
      const result = await res.json();
      if (result?.success) setDefinitions(result.data || []);
    } catch (e) {
      console.error('Failed to load metafield definitions', e);
    } finally {
      setLoadingDefs(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  const handleAddField = () => {
    if (!newField.namespace || !newField.key) {
      setError('Namespace and key are required.');
      return;
    }
    onChange('metafields', [...metafields, {...newField}]);
    setNewField(EMPTY_FIELD);
    setAddModal(false);
    setError('');
  };

  const handleUpdateValue = (index, value) => {
    const updated = metafields.map((m, i) => (i === index ? {...m, value} : m));
    onChange('metafields', updated);
  };

  const handleUpdateRow = (row, value) => {
    if (row.index >= 0) {
      handleUpdateValue(row.index, value);
      return;
    }
    onChange('metafields', [
      ...metafields,
      {namespace: row.namespace, key: row.key, type: row.type, value}
    ]);
  };

  const handleDeleteLocal = async index => {
    const mf = metafields[index];
    if (mf.id) {
      try {
        await api(`/api/shopify-products/metafields/${mf.id}?storeId=${storeId}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.error('Failed to delete metafield', e);
      }
    }
    onChange(
      'metafields',
      metafields.filter((_, i) => i !== index)
    );
  };

  const handleCreateDefinition = async () => {
    if (!newDef.name || !newDef.namespace || !newDef.key) {
      setError('Name, namespace, and key are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api('/api/shopify-products/metafield-definitions', {
        method: 'POST',
        body: JSON.stringify({storeId, definition: {...newDef, ownerType: 'PRODUCT'}})
      });
      setNewDef(EMPTY_DEF);
      setDefModal(false);
      fetchDefinitions();
    } catch (e) {
      setError('Failed to create definition.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            Metafields
          </Text>
          {loadingDefs && <Spinner size="small" />}
        </InlineStack>

        {rows.length === 0 && (
          <Text as="p" variant="bodySm" tone="subdued">
            No metafields added yet.
          </Text>
        )}

        {visibleRows.map((row, i) => {
          const humanize = s => (s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const label = row.name || humanize(row.key);
          return (
            <div key={`${row.namespace}.${row.key}`} className="pmf-row">
              <label className="pmf-label" title={`${row.namespace}.${row.key}`}>
                {label}
              </label>
              <div className="pmf-input">
                <TextField
                  label={label}
                  labelHidden
                  value={row.value}
                  onChange={v => handleUpdateRow(row, v)}
                  autoComplete="off"
                />
              </div>
            </div>
          );
        })}

        <Button variant="plain" onClick={() => setViewAllOpen(true)}>View all</Button>

        {/* Add metafield modal */}
        <Modal
          open={addModal}
          onClose={() => setAddModal(false)}
          title="Add metafield"
          primaryAction={{content: 'Add', onAction: handleAddField}}
          secondaryActions={[{content: 'Cancel', onAction: () => setAddModal(false)}]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              {error && <Banner tone="critical">{error}</Banner>}
              <TextField
                label="Namespace"
                value={newField.namespace}
                onChange={v => setNewField(f => ({...f, namespace: v}))}
                autoComplete="off"
              />
              <TextField
                label="Key"
                value={newField.key}
                onChange={v => setNewField(f => ({...f, key: v}))}
                autoComplete="off"
              />
              <Select
                label="Type"
                options={TYPE_OPTIONS}
                value={newField.type}
                onChange={v => setNewField(f => ({...f, type: v}))}
              />
              <TextField
                label="Value"
                value={newField.value}
                onChange={v => setNewField(f => ({...f, value: v}))}
                autoComplete="off"
              />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Manage definitions modal */}
        <Modal
          open={defModal}
          onClose={() => setDefModal(false)}
          title="Create metafield definition"
          primaryAction={{content: 'Create', onAction: handleCreateDefinition, loading: saving}}
          secondaryActions={[{content: 'Cancel', onAction: () => setDefModal(false)}]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              {error && <Banner tone="critical">{error}</Banner>}
              <TextField
                label="Name"
                value={newDef.name}
                onChange={v => setNewDef(d => ({...d, name: v}))}
                autoComplete="off"
              />
              <TextField
                label="Namespace"
                value={newDef.namespace}
                onChange={v => setNewDef(d => ({...d, namespace: v}))}
                autoComplete="off"
              />
              <TextField
                label="Key"
                value={newDef.key}
                onChange={v => setNewDef(d => ({...d, key: v}))}
                autoComplete="off"
              />
              <Select
                label="Type"
                options={TYPE_OPTIONS}
                value={newDef.type}
                onChange={v => setNewDef(d => ({...d, type: v}))}
              />
            </BlockStack>
          </Modal.Section>
          {definitions.length > 0 && (
            <Modal.Section>
              <BlockStack gap="200">
                <Text as="h3" variant="bodySm" fontWeight="medium">
                  Existing definitions
                </Text>
                {definitions.map((d, i) => (
                  <Text key={i} as="p" variant="bodySm" tone="subdued">
                    {d.namespace}.{d.key} — {d.name} ({d.type})
                  </Text>
                ))}
              </BlockStack>
            </Modal.Section>
          )}
        </Modal>

        {/* View all metafields modal — mirrors the Shopify full-page view */}
        <Modal
          open={viewAllOpen}
          onClose={() => setViewAllOpen(false)}
          title="Product metafields"
          size="large"
          secondaryActions={[
            {content: 'Add metafield', onAction: () => { setViewAllOpen(false); setAddModal(true); }},
            {content: 'Close', onAction: () => setViewAllOpen(false)}
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <div className="pmf-tabs">
                {[
                  {id: 'all', label: 'All'},
                  {id: 'category', label: 'Category metafields'},
                  {id: 'product', label: 'Product metafields'}
                ].map(t => (
                  <button
                    type="button"
                    key={t.id}
                    className={`pmf-tab ${viewTab === t.id ? 'pmf-tab-active' : ''}`}
                    onClick={() => setViewTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <TextField
                label="Search"
                labelHidden
                placeholder="Search metafields"
                value={viewQuery}
                onChange={setViewQuery}
                autoComplete="off"
              />
              <Text as="h3" variant="headingSm">Product metafields</Text>
              <Text as="p" variant="bodySm" tone="subdued">Pinned</Text>
              <BlockStack gap="200">
                {rows
                  .filter(r => {
                    const isCategory = (r.namespace || '').startsWith('shopify');
                    if (viewTab === 'category' && !isCategory) return false;
                    if (viewTab === 'product' && isCategory) return false;
                    return true;
                  })
                  .filter(r => !viewQuery || (r.name || r.key).toLowerCase().includes(viewQuery.toLowerCase()))
                  .map(row => {
                    const humanize = s => (s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const label = row.name || humanize(row.key);
                    return (
                      <div key={`${row.namespace}.${row.key}`} className="pmf-row">
                        <label className="pmf-label">{label}</label>
                        <div className="pmf-input">
                          <TextField
                            label={label}
                            labelHidden
                            value={row.value}
                            onChange={v => handleUpdateRow(row, v)}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    );
                  })}
                {rows.length === 0 && (
                  <Text as="p" variant="bodySm" tone="subdued">No metafields or definitions yet.</Text>
                )}
              </BlockStack>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Learn more about metafields
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
      <style>{`
        .pmf-row {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 16px;
          align-items: center;
        }
        .pmf-label {
          font-size: 13px;
          color: var(--p-color-text);
          white-space: normal;
          word-break: break-word;
          line-height: 1.35;
        }
        .pmf-tabs {
          display: inline-flex;
          gap: 4px;
          padding: 4px;
          background: var(--p-color-bg-surface-secondary);
          border-radius: 8px;
        }
        .pmf-tab {
          border: 0;
          background: transparent;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 500;
          color: var(--p-color-text-subdued);
          cursor: pointer;
          border-radius: 6px;
          transition: background .15s ease;
        }
        .pmf-tab:hover { background: var(--p-color-bg-surface-hover); }
        .pmf-tab-active {
          background: var(--p-color-bg-surface);
          color: var(--p-color-text);
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }
      `}</style>
    </Card>
  );
}

ProductMetafields.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  storeId: PropTypes.string
};
