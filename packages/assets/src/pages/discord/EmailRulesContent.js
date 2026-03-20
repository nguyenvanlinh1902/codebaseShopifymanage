import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {
  Card, IndexTable, Text, Badge, Button, InlineStack, BlockStack,
  Modal, FormLayout, TextField, Select, Banner, EmptyState
} from '@shopify/polaris';

const FIELD_OPTIONS = [
  {label: 'From', value: 'from'},
  {label: 'Subject', value: 'subject'},
  {label: 'Label', value: 'label'}
];
const OPERATOR_OPTIONS = [
  {label: 'Equals', value: 'equals'},
  {label: 'Contains', value: 'contains'},
  {label: 'Starts with', value: 'startsWith'},
  {label: 'Regex', value: 'regex'}
];
const ACTION_OPTIONS = [
  {label: 'Forward to Discord', value: 'forward'},
  {label: 'Ignore (skip)', value: 'ignore'}
];

const EMPTY_RULE = {
  name: '', conditions: [{field: 'from', operator: 'contains', value: ''}],
  conditionLogic: 'all', action: 'forward', priority: 0
};

/**
 * Rules CRUD table with add/edit modal and delete confirmation
 */
export default function EmailRulesContent({rules, onCreate, onUpdate, onDelete, onToggle}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [form, setForm] = useState({...EMPTY_RULE});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formError, setFormError] = useState(null);

  const openCreate = () => {
    setEditRule(null);
    setForm({...EMPTY_RULE, conditions: [{field: 'from', operator: 'contains', value: ''}]});
    setFormError(null);
    setModalOpen(true);
  };
  const openEdit = (rule) => {
    setEditRule(rule);
    setForm({...rule});
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      setFormError('Rule name is required');
      return;
    }
    if (form.conditions.some(c => !c.value?.trim())) {
      setFormError('All condition values are required');
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      if (editRule) {
        await onUpdate(editRule.id, form);
      } else {
        await onCreate(form);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId) => {
    try {
      await onDelete(ruleId);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const updateCondition = (index, key, value) => {
    const newConditions = [...form.conditions];
    newConditions[index] = {...newConditions[index], [key]: value};
    setForm({...form, conditions: newConditions});
  };
  const addCondition = () => {
    setForm({...form, conditions: [...form.conditions, {field: 'from', operator: 'contains', value: ''}]});
  };
  const removeCondition = (index) => {
    if (form.conditions.length <= 1) return;
    setForm({...form, conditions: form.conditions.filter((_, i) => i !== index)});
  };

  // Empty state
  if (rules.length === 0) {
    return (
      <Card>
        <EmptyState
          heading="No filter rules yet"
          image=""
          action={{content: 'Create first rule', onAction: openCreate}}
        >
          <p>Rules control which emails get forwarded to Discord. Without rules, all emails are forwarded.</p>
        </EmptyState>
        {renderModal()}
      </Card>
    );
  }

  function renderModal() {
    return (
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRule ? 'Edit Rule' : 'Create Rule'}
        primaryAction={{content: 'Save', onAction: handleSave, loading: saving}}
        secondaryActions={[{content: 'Cancel', onAction: () => setModalOpen(false)}]}
      >
        <Modal.Section>
          <FormLayout>
            {formError && <Banner tone="critical">{formError}</Banner>}
            <TextField
              label="Rule name"
              value={form.name}
              onChange={v => setForm({...form, name: v})}
              placeholder="e.g. Boss urgent emails"
              autoComplete="off"
              maxLength={100}
              showCharacterCount
            />

            <Text as="h3" variant="headingSm">Conditions</Text>
            {form.conditions.map((c, i) => (
              <InlineStack key={i} gap="200" blockAlign="end" wrap={false}>
                <div style={{width: 120}}>
                  <Select label={i === 0 ? 'Field' : ''} labelHidden={i > 0}
                    options={FIELD_OPTIONS} value={c.field}
                    onChange={v => updateCondition(i, 'field', v)} />
                </div>
                <div style={{width: 130}}>
                  <Select label={i === 0 ? 'Operator' : ''} labelHidden={i > 0}
                    options={OPERATOR_OPTIONS} value={c.operator}
                    onChange={v => updateCondition(i, 'operator', v)} />
                </div>
                <div style={{flex: 1}}>
                  <TextField label={i === 0 ? 'Value' : ''} labelHidden={i > 0}
                    value={c.value} onChange={v => updateCondition(i, 'value', v)}
                    placeholder="Match value..." autoComplete="off" />
                </div>
                {form.conditions.length > 1 && (
                  <Button onClick={() => removeCondition(i)} size="slim" tone="critical">
                    Remove
                  </Button>
                )}
              </InlineStack>
            ))}
            <Button onClick={addCondition} size="slim" variant="plain">
              + Add condition
            </Button>

            <InlineStack gap="300">
              <div style={{width: 160}}>
                <Select label="Match logic"
                  options={[{label: 'All match (AND)', value: 'all'}, {label: 'Any match (OR)', value: 'any'}]}
                  value={form.conditionLogic} onChange={v => setForm({...form, conditionLogic: v})} />
              </div>
              <div style={{width: 180}}>
                <Select label="Action" options={ACTION_OPTIONS}
                  value={form.action} onChange={v => setForm({...form, action: v})} />
              </div>
              <div style={{width: 80}}>
                <TextField label="Priority" type="number" value={String(form.priority || 0)}
                  onChange={v => setForm({...form, priority: parseInt(v) || 0})} autoComplete="off" />
              </div>
            </InlineStack>
          </FormLayout>
        </Modal.Section>
      </Modal>
    );
  }

  const resourceName = {singular: 'rule', plural: 'rules'};
  const rowMarkup = rules.map((rule, index) => (
    <IndexTable.Row id={rule.id} key={rule.id} position={index}>
      <IndexTable.Cell><Text fontWeight="bold">{rule.name}</Text></IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {rule.conditions?.map(c => `${c.field} ${c.operator} "${c.value}"`).join(` ${rule.conditionLogic === 'all' ? '&&' : '||'} `)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={rule.action === 'forward' ? 'success' : 'attention'}>{rule.action}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={rule.enabled ? 'success' : undefined}>{rule.enabled ? 'On' : 'Off'}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100">
          <Button onClick={() => openEdit(rule)} size="slim">Edit</Button>
          <Button onClick={() => onToggle(rule.id)} size="slim">
            {rule.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button onClick={() => setDeleteConfirm(rule)} size="slim" tone="critical">Delete</Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text as="h2" variant="headingMd">Filter Rules</Text>
            <Button onClick={openCreate} variant="primary">Add Rule</Button>
          </InlineStack>
          <Banner tone="info">
            Rules are evaluated in priority order (lowest first). First matching rule wins. No rules = forward all.
          </Banner>
          <IndexTable
            resourceName={resourceName}
            itemCount={rules.length}
            headings={[
              {title: 'Name'}, {title: 'Conditions'}, {title: 'Action'}, {title: 'Status'}, {title: 'Actions'}
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        </BlockStack>
      </Card>

      {renderModal()}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <Modal
          open
          onClose={() => setDeleteConfirm(null)}
          title="Delete rule?"
          primaryAction={{
            content: 'Delete', destructive: true,
            onAction: () => handleDelete(deleteConfirm.id)
          }}
          secondaryActions={[{content: 'Cancel', onAction: () => setDeleteConfirm(null)}]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete &ldquo;{deleteConfirm.name}&rdquo;? This cannot be undone.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
}

EmailRulesContent.propTypes = {
  rules: PropTypes.array.isRequired,
  onCreate: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired
};
