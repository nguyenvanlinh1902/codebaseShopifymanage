/* eslint-disable react/prop-types */
import React from 'react';
import {BlockStack} from '@shopify/polaris';
import ProductCore from './product-core';
import ProductVariants from './product-variants';
import ProductMetafields from './product-metafields';
import ProductSeo from './product-seo';

export default function ProductForm({formData, onChange, storeId, isNew, productId}) {
  return (
    <BlockStack gap="400">
      <ProductCore formData={formData} onChange={onChange} storeId={storeId} isNew={isNew} />
      <ProductVariants
        formData={formData}
        onChange={onChange}
        storeId={storeId}
        productId={productId}
      />
      <ProductMetafields formData={formData} onChange={onChange} storeId={storeId} />
      <ProductSeo formData={formData} onChange={onChange} />
    </BlockStack>
  );
}
