import React, {useState, useEffect} from 'react';
import {Modal, FormLayout, TextField, Select, Checkbox, Banner, InlineGrid} from '@shopify/polaris';

const INPUT_TYPE_OPTIONS = [
  {label: 'Text', value: 'text'},
  {label: 'Number', value: 'number'},
  {label: 'Textarea', value: 'textarea'}
];

export default function CustomFieldFormModal({open, onClose, onSave, initialData}) {
  const [label, setLabel] = useState('');
  const [inputType, setInputType] = useState('text');
  const [required, setRequired] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setLabel(initialData?.label || '');
      setInputType(initialData?.inputType || 'text');
      setRequired(initialData?.required || false);
      setSortOrder(String(initialData?.sortOrder ?? '0'));
      setError('');
    }
  }, [open, initialData]);

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave({label: label.trim(), inputType, required, sortOrder: Number(sortOrder) || 0});
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!initialData;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Field' : 'Add Field'}
      primaryAction={{content: isEdit ? 'Save' : 'Create', onAction: handleSave, loading: saving, disabled: !label.trim()}}
      secondaryActions={[{content: 'Cancel', onAction: onClose}]}
    >
      <Modal.Section>
        {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}
        <FormLayout>
          <TextField label="Label" value={label} onChange={setLabel} autoComplete="off" requiredIndicator placeholder="e.g. Enter Your Name" helpText="Displayed on the product page" />
          <InlineGrid columns={2} gap="400">
            <Select label="Type" options={INPUT_TYPE_OPTIONS} value={inputType} onChange={setInputType} />
            <TextField label="Sort Order" type="number" value={sortOrder} onChange={setSortOrder} autoComplete="off" helpText="Lower = first" />
          </InlineGrid>
          <Checkbox label="Required — customer must fill this in" checked={required} onChange={setRequired} />
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}
