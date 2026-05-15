import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {
  Card, BlockStack, Select, Text, DropZone, InlineStack,
  Thumbnail, Button, Spinner, Banner, Modal, Checkbox
} from '@shopify/polaris';
import {DeleteIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';
import StoreSelector from '../../components/store-selector';

const TEMPLATE_OPTIONS = [
  {label: 'Default collection', value: ''},
  {label: 'collection.featured', value: 'featured'},
  {label: 'collection.sidebar', value: 'sidebar'}
];

export default function CollectionSidebar({
  formData, onChange, stores, storeId, onStoreChange, isNew, collectionId
}) {
  const [imagePreview, setImagePreview] = useState(formData.image || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Publishing state
  const [allChannels, setAllChannels] = useState([]);
  const [publishedIds, setPublishedIds] = useState(new Set());
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState(new Set());
  const [savingPublish, setSavingPublish] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoadingChannels(true);
    api(`/api/collections/publications?storeId=${storeId}`)
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          const channels = result.data || [];
          setAllChannels(channels);
          if (isNew) {
            const ids = channels.map(c => c.id);
            setPublishedIds(new Set(ids));
            onChange('_publishIds', ids);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingChannels(false));
  }, [storeId, isNew]);

  useEffect(() => {
    if (!collectionId || !storeId) return;
    api(`/api/collections/${collectionId}/publications?storeId=${storeId}`)
      .then(r => r.json())
      .then(result => {
        if (result.success) setPublishedIds(new Set((result.data || []).map(p => p.id)));
      })
      .catch(() => {});
  }, [collectionId, storeId]);

  const openManage = () => {
    setPendingIds(new Set(publishedIds));
    setManageOpen(true);
  };

  const handleSavePublishing = async () => {
    if (!collectionId) {
      // New collection: just update local state, will publish on save
      setPublishedIds(new Set(pendingIds));
      onChange('_publishIds', [...pendingIds]);
      setManageOpen(false);
      return;
    }
    // Edit mode: call API to publish/unpublish
    const toPublish = [...pendingIds].filter(id => !publishedIds.has(id));
    const toUnpublish = [...publishedIds].filter(id => !pendingIds.has(id));
    if (toPublish.length === 0 && toUnpublish.length === 0) {
      setManageOpen(false);
      return;
    }
    try {
      setSavingPublish(true);
      await api(`/api/collections/${collectionId}/publish`, {
        method: 'PUT',
        body: JSON.stringify({
          storeId,
          publishIds: toPublish.length > 0 ? toPublish : undefined,
          unpublishIds: toUnpublish.length > 0 ? toUnpublish : undefined
        })
      });
      setPublishedIds(new Set(pendingIds));
      setManageOpen(false);
    } catch {
      // Error handled silently
    } finally {
      setSavingPublish(false);
    }
  };

  // --- Image handlers ---
  const handleDropZoneDrop = useCallback(async (_drop, acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      setImagePreview(dataUrl);
      setUploadError(null);
      if (!storeId) { setUploadError('Please select a store first'); return; }
      try {
        setUploading(true);
        const res = await api('/api/collections/upload-image', {
          method: 'POST',
          body: JSON.stringify({storeId, filename: file.name, mimeType: file.type, fileSize: file.size, fileData: dataUrl})
        });
        const result = await res.json();
        if (result.success && result.data?.url) onChange('image', result.data.url);
        else { setUploadError(result.error || 'Upload failed'); setImagePreview(null); onChange('image', ''); }
      } catch {
        setUploadError('Failed to upload image'); setImagePreview(null); onChange('image', '');
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  }, [onChange, storeId]);

  const handleRemoveImage = useCallback(() => {
    setImagePreview(null); setUploadError(null); onChange('image', '');
  }, [onChange]);

  const storeOptions = [
    {label: 'Select store...', value: ''},
    ...stores.map(s => ({label: `${s.name} (${s.shopDomain})`, value: s.id}))
  ];

  const publishedChannels = allChannels.filter(c => publishedIds.has(c.id));
  const unpublishedChannels = allChannels.filter(c => !publishedIds.has(c.id));

  return (
    <BlockStack gap="400">
      {isNew && (
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">Store</Text>
            <StoreSelector
              label="Store"
              labelHidden
              options={storeOptions}
              value={storeId}
              onChange={onStoreChange}
              pinnedValues={['']}
              placeholder="Select store..."
            />
          </BlockStack>
        </Card>
      )}

      {/* Publishing */}
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingSm">Publishing</Text>
            {allChannels.length > 0 && (
              <Button variant="plain" onClick={openManage}>Manage</Button>
            )}
          </InlineStack>
          <Text as="p" variant="bodySm" fontWeight="medium">Sales channels</Text>
          {loadingChannels ? (
            <Spinner size="small" />
          ) : allChannels.length === 0 ? (
            <Text as="p" variant="bodySm" tone="subdued">No sales channels available</Text>
          ) : publishedChannels.length === 0 ? (
            <Text as="p" variant="bodySm" tone="subdued">Not included in any sales channels</Text>
          ) : (
            <BlockStack gap="100">
              {publishedChannels.slice(0, 1).map(ch => (
                <InlineStack key={ch.id} gap="200" blockAlign="center">
                  <div style={{width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0}} />
                  <Text as="span" variant="bodySm">{ch.name}</Text>
                </InlineStack>
              ))}
              {unpublishedChannels.length > 0 && (
                <InlineStack gap="200" blockAlign="start">
                  <div style={{width: 8, height: 8, borderRadius: '50%', backgroundColor: '#d1d5db', flexShrink: 0, marginTop: 4}} />
                  <Text as="span" variant="bodySm" tone="subdued">
                    {unpublishedChannels.map(c => c.name).join(', ')}
                  </Text>
                </InlineStack>
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      {/* Image */}
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">Image</Text>
          {uploadError && <Banner tone="warning" onDismiss={() => setUploadError(null)}>{uploadError}</Banner>}
          {imagePreview ? (
            <InlineStack gap="300" blockAlign="center">
              <Thumbnail source={imagePreview} alt="Collection image" size="large" />
              {uploading ? <Spinner size="small" /> : (
                <Button icon={DeleteIcon} variant="plain" tone="critical" onClick={handleRemoveImage} accessibilityLabel="Remove" />
              )}
            </InlineStack>
          ) : (
            <DropZone accept="image/jpeg,image/png,image/gif,image/webp" type="image" onDrop={handleDropZoneDrop}>
              <DropZone.FileUpload actionHint="or drop an image to upload" actionTitle="Add image" />
            </DropZone>
          )}
        </BlockStack>
      </Card>

      {/* Theme template */}
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">Theme template</Text>
          <Select label="Template" labelHidden options={TEMPLATE_OPTIONS}
            value={formData.templateSuffix} onChange={v => onChange('templateSuffix', v)}
            helpText="Assign a template from your current theme to define how the collection is displayed." />
        </BlockStack>
      </Card>

      {/* Manage publishing modal */}
      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage sales channels"
        primaryAction={{content: 'Done', onAction: handleSavePublishing, loading: savingPublish}}
        secondaryActions={[{content: 'Cancel', onAction: () => setManageOpen(false)}]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            {allChannels.map(ch => (
              <Checkbox
                key={ch.id}
                label={ch.name}
                checked={pendingIds.has(ch.id)}
                onChange={checked => {
                  setPendingIds(prev => {
                    const next = new Set(prev);
                    if (checked) next.add(ch.id); else next.delete(ch.id);
                    return next;
                  });
                }}
              />
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}

CollectionSidebar.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  stores: PropTypes.array.isRequired,
  storeId: PropTypes.string,
  onStoreChange: PropTypes.func.isRequired,
  isNew: PropTypes.bool,
  collectionId: PropTypes.string
};
