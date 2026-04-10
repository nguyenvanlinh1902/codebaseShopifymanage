import React, {useState, useEffect} from 'react';
import {
  BlockStack, InlineStack, Text, Button,
  Toast, Tabs, Banner
} from '@shopify/polaris';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {DEFAULT_TEMPLATES} from '../../helpers/policy-templates';
import {api} from '../../helpers/api';
import {QUILL_MODULES, QUILL_FORMATS} from './quill-config';

const POLICY_TYPES = [
  {type: 'REFUND_POLICY', label: 'Refund policy'},
  {type: 'PRIVACY_POLICY', label: 'Privacy policy'},
  {type: 'TERMS_OF_SERVICE', label: 'Terms of service'},
  {type: 'SHIPPING_POLICY', label: 'Shipping policy'},
  {type: 'CONTACT_INFORMATION', label: 'Contact information'}
];

/**
 * PolicyTemplateEditor — manage editable policy templates stored in DB.
 * Templates use {{storeName}}, {{email}}, {{lastUpdated}} as placeholders.
 * Falls back to hardcoded defaults when no DB entry exists.
 *
 * Props:
 * - customTemplates: { [type]: body } from parent (fetched from DB)
 * - onTemplatesChange: callback when templates are saved
 */
export default function PolicyTemplateEditor({customTemplates, onTemplatesChange}) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [editContent, setEditContent] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dirty, setDirty] = useState(false);

  // Merge DB templates with defaults for display
  useEffect(() => {
    const merged = {};
    POLICY_TYPES.forEach(p => {
      merged[p.type] = customTemplates[p.type] || DEFAULT_TEMPLATES[p.type] || '';
    });
    setEditContent(merged);
    setDirty(false);
  }, [customTemplates]);

  const currentType = POLICY_TYPES[selectedTab].type;

  const tabs = POLICY_TYPES.map(p => {
    const isCustom = !!customTemplates[p.type];
    return {
      id: p.type,
      content: isCustom ? `${p.label} (custom)` : p.label,
      panelID: `${p.type}-panel`
    };
  });

  const handleContentChange = (val) => {
    setEditContent(prev => ({...prev, [currentType]: val}));
    setDirty(true);
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      setErrorMsg('');
      const templates = POLICY_TYPES.map(p => ({type: p.type, body: editContent[p.type] || ''}));
      const res = await api('/api/policy-templates', {
        method: 'PUT',
        body: JSON.stringify({templates})
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Templates saved');
        setDirty(false);
        if (onTemplatesChange) {
          const updated = {};
          templates.forEach(t => { updated[t.type] = t.body; });
          onTemplatesChange(updated);
        }
      } else {
        setErrorMsg(data.error || 'Failed to save');
      }
    } catch {
      setErrorMsg('Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setEditContent(prev => ({...prev, [currentType]: DEFAULT_TEMPLATES[currentType] || ''}));
    setDirty(true);
  };

  return (
    <>
      {successMsg && <Toast content={successMsg} onDismiss={() => setSuccessMsg('')} />}
      {errorMsg && <Toast content={errorMsg} error onDismiss={() => setErrorMsg('')} />}

      <BlockStack gap="400">
        <Text variant="bodySm" tone="subdued">
          Edit default templates. Use {'{{storeName}}'}, {'{{email}}'}, {'{{lastUpdated}}'} as placeholders.
        </Text>

        <InlineStack gap="200">
          <Button onClick={handleResetToDefault} disabled={saving} size="slim">
            Reset Current
          </Button>
          <Button variant="primary" onClick={handleSaveAll} disabled={saving || !dirty} loading={saving} size="slim">
            Save All Templates
          </Button>
        </InlineStack>

        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <div style={{marginTop: 12}}>
            <style>{`
              .template-editor .ql-container { min-height: 280px; font-size: 14px; }
              .template-editor .ql-editor { min-height: 280px; }
              .template-editor .ql-toolbar { border-top: 0; }
            `}</style>
            <div className="template-editor">
              <ReactQuill
                theme="snow"
                value={editContent[currentType] || ''}
                onChange={handleContentChange}
                modules={QUILL_MODULES}
                formats={QUILL_FORMATS}
                placeholder="Enter template HTML..."
              />
            </div>
          </div>
        </Tabs>

        {dirty && (
          <Banner tone="warning">
            Unsaved changes. Click "Save All Templates" to persist.
          </Banner>
        )}
      </BlockStack>
    </>
  );
}
