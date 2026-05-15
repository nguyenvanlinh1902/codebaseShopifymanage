/* eslint-disable react/prop-types */
import React from 'react';
import {BlockStack} from '@shopify/polaris';
import ProductCore from './product-core';
import ProductPricing from './product-pricing';
import ProductInventory from './product-inventory';
import ProductShipping from './product-shipping';
import ProductVariants from './product-variants';
import ProductMetafields from './product-metafields';
import ProductSeo from './product-seo';

export default function ProductForm({formData, onChange, storeId, isNew, productId}) {
  const hasOptions = (formData.options || []).some(o => o.name && o.values?.length > 0);
  return (
    <BlockStack gap="400">
      <ProductCore formData={formData} onChange={onChange} storeId={storeId} isNew={isNew} />
      {!hasOptions && <ProductPricing formData={formData} onChange={onChange} />}
      {!hasOptions && <ProductShipping formData={formData} onChange={onChange} />}
      {!hasOptions && <ProductInventory formData={formData} onChange={onChange} storeId={storeId} />}
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
