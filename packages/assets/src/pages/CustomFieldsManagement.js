import React, {useState, useEffect, useCallback} from 'react';
import {
  Page, Layout, Card, BlockStack, InlineStack, Text,
  Button, Badge, Toast, SkeletonBodyText, EmptyState, Box,
  InlineGrid, Modal, Icon
} from '@shopify/polaris';
import {EditIcon, DeleteIcon, DragHandleIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import CustomFieldFormModal from './custom-fields/custom-field-form-modal';
import DeploySection from './custom-fields/deploy-section';

const INPUT_TYPE_LABELS = {text: 'Text', number: 'Number', textarea: 'Textarea'};
const INPUT_TYPE_TONES = {text: 'info', number: 'attention', textarea: 'new'};

export default function CustomFieldsManagement() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/api/custom-fields');
      const data = await res.json();
      if (data.success) setFields(data.data || []);
      else setErrorMsg(data.error || 'Failed to load fields');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleSave = async (formData) => {
    const isEdit = !!editingField;
    const url = isEdit ? `/api/custom-fields/${editingField.id}` : '/api/custom-fields';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await api(url, {method, body: JSON.stringify(formData)});
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    setToastMsg(isEdit ? 'Field updated' : 'Field created');
    loadFields();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api(`/api/custom-fields/${deleteTarget.id}`, {method: 'DELETE'});
      const data = await res.json();
      if (data.success) {
        setToastMsg('Field deleted');
        loadFields();
      } else {
        setErrorMsg(data.error);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const openCreate = () => { setEditingField(null); setModalOpen(true); };
  const openEdit = (field) => { setEditingField(field); setModalOpen(true); };

  return (
    <Page title="Custom Fields" subtitle="Define input fields shown on product pages" primaryAction={{content: 'Add Field', onAction: openCreate}}>
      <BlockStack gap="600">
        {/* Field Definitions */}
        <Layout>
          <Layout.Section>
            {loading ? (
              <Card>
                <BlockStack gap="400">
                  <SkeletonBodyText lines={8} />
                </BlockStack>
              </Card>
            ) : fields.length === 0 ? (
              <Card>
                <EmptyState
                  heading="No custom fields yet"
                  image=""
                  action={{content: 'Add Field', onAction: openCreate}}
                >
                  <p>Custom fields appear on the product page for customers to fill in (e.g. Name, Number).</p>
                </EmptyState>
              </Card>
            ) : (
              <BlockStack gap="300">
                {fields.map((field) => (
                  <Card key={field.id} padding="400">
                    <InlineStack align="space-between" blockAlign="center" wrap={false}>
                      <InlineStack gap="400" blockAlign="center" wrap={false}>
                        <Box color="text-secondary"><Icon source={DragHandleIcon} /></Box>
                        <BlockStack gap="100">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">{field.label}</Text>
                            {field.required && <Badge tone="info" size="small">Required</Badge>}
                          </InlineStack>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {INPUT_TYPE_LABELS[field.inputType] || field.inputType}
                            {field.sortOrder > 0 ? ` · Order: ${field.sortOrder}` : ''}
                          </Text>
                        </BlockStack>
                      </InlineStack>
                      <InlineStack gap="200">
                        <Button icon={EditIcon} variant="plain" onClick={() => openEdit(field)} accessibilityLabel={`Edit ${field.label}`} />
                        <Button icon={DeleteIcon} variant="plain" tone="critical" onClick={() => setDeleteTarget(field)} accessibilityLabel={`Delete ${field.label}`} />
                      </InlineStack>
                    </InlineStack>
                  </Card>
                ))}
              </BlockStack>
            )}
          </Layout.Section>
        </Layout>

        {/* Deploy Section */}
        <Layout>
          <Layout.Section>
            <DeploySection fields={fields} />
          </Layout.Section>
        </Layout>
      </BlockStack>

      <CustomFieldFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editingField}
      />

      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title={`Delete "${deleteTarget.label}"?`}
          primaryAction={{content: 'Delete', destructive: true, onAction: handleDelete, loading: deleting}}
          secondaryActions={[{content: 'Cancel', onAction: () => setDeleteTarget(null)}]}
        >
          <Modal.Section>
            <Text>This will remove the field definition. Deployed stores are not affected until you re-deploy.</Text>
          </Modal.Section>
        </Modal>
      )}

      {toastMsg && <Toast content={toastMsg} onDismiss={() => setToastMsg('')} />}
      {errorMsg && <Toast content={errorMsg} error onDismiss={() => setErrorMsg('')} />}
    </Page>
  );
}
