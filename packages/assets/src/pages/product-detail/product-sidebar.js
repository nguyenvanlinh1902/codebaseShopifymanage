/* eslint-disable react/prop-types */
import React from 'react';
import {Card, BlockStack, Select, Text} from '@shopify/polaris';
import ProductOrganization from './product-organization';
import ProductPublishing from './product-publishing';
import StoreSelector from '../../components/store-selector';

const STATUS_OPTIONS = [
  {label: 'Active', value: 'ACTIVE'},
  {label: 'Draft', value: 'DRAFT'},
  {label: 'Archived', value: 'ARCHIVED'}
];

export default function ProductSidebar({
  formData,
  onChange,
  stores,
  storeId,
  onStoreChange,
  isNew,
  productId
}) {
  const storeOptions = stores.map(s => ({label: s.shopDomain || s.name || s.id, value: s.id}));

  return (
    <BlockStack gap="400">
      {isNew && (
        <Card>
          <BlockStack gap="200">
            {storeOptions.length === 0 ? (
              <Text as="p" tone="critical">
                No stores available. Please connect a store first.
              </Text>
            ) : (
              <StoreSelector
                label="Store"
                options={storeOptions}
                value={storeId}
                onChange={onStoreChange}
                pinnedValues={[]}
              />
            )}
          </BlockStack>
        </Card>
      )}
      <Card>
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            Status
          </Text>
          <Select
            options={STATUS_OPTIONS}
            value={formData.status || 'DRAFT'}
            onChange={v => onChange('status', v)}
          />
        </BlockStack>
      </Card>
      <ProductPublishing
        formData={formData}
        onChange={onChange}
        storeId={storeId}
        productId={productId}
        isNew={isNew}
      />
      <ProductOrganization formData={formData} onChange={onChange} storeId={storeId} />
      <Card>
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            Theme template
          </Text>
          <Select
            options={[
              {label: 'Default product', value: ''},
              {label: 'product.alternate', value: 'alternate'}
            ]}
            value={formData.templateSuffix || ''}
            onChange={v => onChange('templateSuffix', v)}
          />
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
