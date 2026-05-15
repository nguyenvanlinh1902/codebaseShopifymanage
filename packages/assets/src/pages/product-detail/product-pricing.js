/* eslint-disable react/prop-types */
import React, {useState} from 'react';
import {Card, BlockStack, InlineStack, TextField, Checkbox, Button, Collapsible, Text} from '@shopify/polaris';
import {ChevronDownIcon, ChevronRightIcon} from '@shopify/polaris-icons';

export default function ProductPricing({formData, onChange}) {
  const [open, setOpen] = useState(false);
  const v = formData.variants?.[0] || {};

  const update = (field, value) => {
    const variants = [...(formData.variants || [{}])];
    variants[0] = {...variants[0], [field]: value};
    onChange('variants', variants);
  };

  const updateInvItem = (field, value) => {
    const variants = [...(formData.variants || [{}])];
    variants[0] = {
      ...variants[0],
      inventoryItem: {...(variants[0].inventoryItem || {}), [field]: value}
    };
    onChange('variants', variants);
  };

  const cost = v.inventoryItem?.cost ?? v.cost ?? '';

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">Price</Text>
        <TextField
          label="Price"
          labelHidden
          type="number"
          prefix="$"
          value={String(v.price ?? '')}
          onChange={val => update('price', val)}
          autoComplete="off"
          placeholder="0.00"
        />
        <Button
          icon={open ? ChevronDownIcon : ChevronRightIcon}
          variant="plain"
          onClick={() => setOpen(o => !o)}
          textAlign="left"
        >
          {open ? 'Hide pricing options' : 'Compare-at, cost, tax'}
        </Button>
        <Collapsible open={open} id="pricing-more">
          <BlockStack gap="300">
            <InlineStack gap="300" wrap={false}>
              <div style={{flex: 1}}>
                <TextField
                  label="Compare-at price"
                  type="number"
                  prefix="$"
                  value={String(v.compareAtPrice ?? '')}
                  onChange={val => update('compareAtPrice', val)}
                  autoComplete="off"
                />
              </div>
              <div style={{flex: 1}}>
                <TextField
                  label="Cost per item"
                  type="number"
                  prefix="$"
                  value={String(cost ?? '')}
                  onChange={val => updateInvItem('cost', val)}
                  autoComplete="off"
                  helpText="Customers won't see this."
                />
              </div>
            </InlineStack>
            <Checkbox
              label="Charge tax on this product"
              checked={v.taxable !== false}
              onChange={val => update('taxable', val)}
            />
          </BlockStack>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}
