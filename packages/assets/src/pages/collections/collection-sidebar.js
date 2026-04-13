import React, {useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  BlockStack,
  Select,
  Text,
  DropZone,
  InlineStack,
  Thumbnail,
  Button,
  Spinner,
  Banner
} from '@shopify/polaris';
import {DeleteIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

const TEMPLATE_OPTIONS = [
  {label: 'Default collection', value: ''},
  {label: 'collection.featured', value: 'featured'},
  {label: 'collection.sidebar', value: 'sidebar'}
];

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function CollectionSidebar({
  formData,
  onChange,
  stores,
  storeId,
  onStoreChange,
  isNew
}) {
  const [imagePreview, setImagePreview] = useState(formData.image || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const storeOptions = [
    {label: 'Select store...', value: ''},
    ...stores.map(s => ({label: `${s.name} (${s.shopDomain})`, value: s.id}))
  ];

  const handleDropZoneDrop = useCallback(
    async (_dropFiles, acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Show preview immediately
      const reader = new FileReader();
      reader.onload = async e => {
        const dataUrl = e.target.result;
        setImagePreview(dataUrl);
        setUploadError(null);

        if (!storeId) {
          setUploadError('Please select a store first');
          return;
        }

        // Upload to Shopify via staged upload
        try {
          setUploading(true);
          const res = await api('/api/collections/upload-image', {
            method: 'POST',
            body: JSON.stringify({
              storeId,
              filename: file.name,
              mimeType: file.type,
              fileSize: file.size,
              fileData: dataUrl
            })
          });
          const result = await res.json();
          if (result.success && result.data?.url) {
            onChange('image', result.data.url);
          } else {
            setUploadError(result.error || 'Upload failed');
            setImagePreview(null);
            onChange('image', '');
          }
        } catch (err) {
          setUploadError('Failed to upload image');
          setImagePreview(null);
          onChange('image', '');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [onChange, storeId]
  );

  const handleRemoveImage = useCallback(() => {
    setImagePreview(null);
    setUploadError(null);
    onChange('image', '');
  }, [onChange]);

  return (
    <BlockStack gap="400">
      {/* Store selector (new collections) */}
      {isNew ? (
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Store
            </Text>
            <Select
              label="Store"
              labelHidden
              options={storeOptions}
              value={storeId}
              onChange={onStoreChange}
            />
          </BlockStack>
        </Card>
      ) : (
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              Publishing
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Sales channels
            </Text>
            <Text as="p" variant="bodySm">
              Will be published to Online Store
            </Text>
          </BlockStack>
        </Card>
      )}

      {/* Collection image */}
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">
            Image
          </Text>
          {uploadError && (
            <Banner tone="warning" onDismiss={() => setUploadError(null)}>
              {uploadError}
            </Banner>
          )}
          {imagePreview ? (
            <BlockStack gap="200">
              <InlineStack gap="300" blockAlign="center">
                <Thumbnail
                  source={imagePreview}
                  alt="Collection image"
                  size="large"
                />
                {uploading ? (
                  <Spinner size="small" />
                ) : (
                  <Button
                    icon={DeleteIcon}
                    variant="plain"
                    tone="critical"
                    onClick={handleRemoveImage}
                    accessibilityLabel="Remove image"
                  />
                )}
              </InlineStack>
            </BlockStack>
          ) : (
            <DropZone
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              type="image"
              onDrop={handleDropZoneDrop}
            >
              <DropZone.FileUpload actionHint="or drop an image to upload" actionTitle="Add image" />
            </DropZone>
          )}
        </BlockStack>
      </Card>

      {/* Theme template */}
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">
            Theme template
          </Text>
          <Select
            label="Template"
            labelHidden
            options={TEMPLATE_OPTIONS}
            value={formData.templateSuffix}
            onChange={v => onChange('templateSuffix', v)}
            helpText="Assign a template from your current theme to define how the collection is displayed."
          />
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

CollectionSidebar.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  stores: PropTypes.array.isRequired,
  storeId: PropTypes.string,
  onStoreChange: PropTypes.func.isRequired,
  isNew: PropTypes.bool
};
