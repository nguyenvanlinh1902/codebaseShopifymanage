import React from 'react';
import PropTypes from 'prop-types';
import {Card, BlockStack, TextField, Text, RadioButton, InlineStack} from '@shopify/polaris';
import RichTextEditor from './rich-text-editor';
import './rich-text-editor.css';
import ProductPicker from './product-picker';
import SmartRuleBuilder from './smart-rule-builder';
import CollectionSeo from './collection-seo';

export default function CollectionForm({formData, onChange, storeId}) {
  const isManual = formData.collectionType === 'manual';

  return (
    <BlockStack gap="400">
      {/* Title + Description */}
      <Card>
        <BlockStack gap="400">
          <TextField
            label="Title"
            value={formData.title}
            onChange={v => onChange('title', v)}
            placeholder="e.g. Summer collection"
            requiredIndicator
            autoComplete="off"
          />
          <BlockStack gap="100">
            <Text as="label" variant="bodySm" fontWeight="medium">
              Description
            </Text>
            <RichTextEditor
              value={formData.descriptionHtml}
              onChange={v => onChange('descriptionHtml', v)}
            />
          </BlockStack>
        </BlockStack>
      </Card>

      {/* Collection type */}
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">
            Collection type
          </Text>
          <InlineStack gap="400">
            <RadioButton
              label="Manual"
              helpText="Add products to this collection one by one. Learn more about manual collections."
              checked={isManual}
              id="manual"
              name="collectionType"
              onChange={() => onChange('collectionType', 'manual')}
            />
            <RadioButton
              label="Smart"
              helpText="Existing and future products that match the conditions you set will automatically be added to this collection. Learn more about smart collections."
              checked={!isManual}
              id="smart"
              name="collectionType"
              onChange={() => onChange('collectionType', 'smart')}
            />
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Products / Conditions */}
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">
            {isManual ? 'Products' : 'Conditions'}
          </Text>
          {isManual ? (
            <ProductPicker
              selectedProducts={formData.products}
              onChange={v => onChange('products', v)}
              storeId={storeId}
            />
          ) : (
            <SmartRuleBuilder
              rules={formData.rules}
              disjunctive={formData.disjunctive}
              onChange={(rules, disjunctive) => {
                onChange('rules', rules);
                onChange('disjunctive', disjunctive);
              }}
            />
          )}
        </BlockStack>
      </Card>

      {/* SEO */}
      <CollectionSeo seo={formData.seo} onChange={v => onChange('seo', v)} />
    </BlockStack>
  );
}

CollectionForm.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  storeId: PropTypes.string
};
