/* eslint-disable react/prop-types */
import React, {useState} from 'react';
import {Card, BlockStack, Text, Banner, InlineStack, Button} from '@shopify/polaris';
import {PlusIcon} from '@shopify/polaris-icons';
import ProductOptionEditor from './product-option-editor';
import ProductVariantTable from './product-variant-table';
import ProductAddVariantModal from './product-add-variant-modal';

function cartesian(arrays) {
  if (arrays.length === 0) return [[]];
  return arrays.reduce((acc, arr) => acc.flatMap(combo => arr.map(val => [...combo, val])), [[]]);
}

function regenerateVariants(newOptions, existingVariants) {
  const validOptions = newOptions.filter(o => o.name && o.values.length > 0);
  if (validOptions.length === 0) {
    return [
      {optionValues: {}, price: '0.00', sku: '', compareAtPrice: '', barcode: '', inventory: {}}
    ];
  }

  const combos = cartesian(validOptions.map(o => o.values));

  const existing = new Map();
  (existingVariants || []).forEach(v => {
    const key = validOptions.map(o => v.optionValues?.[o.name] || '').join('|');
    existing.set(key, v);
  });

  return combos.map(combo => {
    const optionValues = {};
    validOptions.forEach((o, i) => {
      optionValues[o.name] = combo[i];
    });
    const key = combo.join('|');
    const prev = existing.get(key);
    return {
      optionValues,
      price: prev?.price ?? '0.00',
      compareAtPrice: prev?.compareAtPrice ?? '',
      sku: prev?.sku ?? '',
      barcode: prev?.barcode ?? '',
      inventory: prev?.inventory ?? {},
      inventoryItemId: prev?.inventoryItemId ?? null,
      id: prev?.id ?? null
    };
  });
}

export default function ProductVariants({formData, onChange, storeId, productId}) {
  const options = formData.options || [];
  const variants = formData.variants || [];
  const [modalOpen, setModalOpen] = useState(false);

  const totalCombos = options
    .filter(o => o.values?.length > 0)
    .reduce((acc, o) => acc * o.values.length, 1);

  const handleOptionsChange = newOptions => {
    onChange('options', newOptions);
    onChange('variants', regenerateVariants(newOptions, variants));
  };

  const handleVariantChange = (index, field, value) => {
    const updated = [...variants];
    if (field.startsWith('inventory.')) {
      const locId = field.split('.')[1];
      updated[index] = {
        ...updated[index],
        inventory: {...(updated[index].inventory || {}), [locId]: value}
      };
    } else {
      updated[index] = {...updated[index], [field]: value};
    }
    onChange('variants', updated);
  };

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">Variants</Text>
          <Button icon={PlusIcon} variant="plain" onClick={() => setModalOpen(true)} disabled={!productId}>
            Add variant
          </Button>
        </InlineStack>
        <ProductOptionEditor options={options} onChange={handleOptionsChange} />
        {totalCombos > 100 && (
          <Banner tone="warning">
            {totalCombos > 2000
              ? `${totalCombos} combinations exceed Shopify's 2000 variant limit. Reduce option values.`
              : `${totalCombos} combinations — this will generate a large variant table.`}
          </Banner>
        )}
        <ProductAddVariantModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          product={{...formData, variants, options}}
          productId={productId}
          storeId={storeId}
          onSaved={() => setModalOpen(false)}
        />
        {options.length > 0 && variants.length > 0 && (
          <ProductVariantTable
            variants={variants}
            options={options}
            media={formData.media || []}
            onVariantChange={handleVariantChange}
            storeId={storeId}
            productId={productId}
          />
        )}
      </BlockStack>
    </Card>
  );
}
