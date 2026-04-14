import React from 'react';
import PropTypes from 'prop-types';
import {Card, BlockStack, TextField, Text, RadioButton, InlineStack, Thumbnail, Select, Badge} from '@shopify/polaris';
import RichTextEditor from './rich-text-editor';
import './rich-text-editor.css';
import ProductPicker from './product-picker';
import SmartRuleBuilder from './smart-rule-builder';
import CollectionSeo from './collection-seo';

const SORT_OPTIONS = [
  {label: 'Most relevant', value: 'BEST_SELLING'},
  {label: 'Product title A-Z', value: 'ALPHA_ASC'},
  {label: 'Product title Z-A', value: 'ALPHA_DESC'},
  {label: 'Highest price', value: 'PRICE_DESC'},
  {label: 'Lowest price', value: 'PRICE_ASC'},
  {label: 'Newest', value: 'CREATED_DESC'},
  {label: 'Oldest', value: 'CREATED'},
  {label: 'Manually', value: 'MANUAL'}
];

export default function CollectionForm({formData, onChange, storeId, isNew}) {
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
              sortOrder={formData.sortOrder}
              onSortChange={v => onChange('sortOrder', v)}
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

      {/* Products for smart collection (edit mode) */}
      {!isManual && !isNew && formData.products?.length > 0 && (
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">Products</Text>
            <Select
              label="Sort"
              labelInline
              options={SORT_OPTIONS}
              value={formData.sortOrder || 'BEST_SELLING'}
              onChange={v => onChange('sortOrder', v)}
            />
            <BlockStack gap="0">
              {formData.products.map((product, index) => (
                <div key={product.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 0',
                  borderBottom: index < formData.products.length - 1 ? '1px solid #e3e3e3' : 'none'
                }}>
                  <Text as="span" variant="bodySm" tone="subdued" style={{minWidth: 28, textAlign: 'right'}}>
                    {index + 1}.
                  </Text>
                  <Thumbnail source={product.featuredImage?.url || ''} alt={product.title} size="small" />
                  <div style={{flex: 1}}>
                    <Text as="span" variant="bodySm">{product.title}</Text>
                  </div>
                  <Badge tone={product.status === 'ACTIVE' ? 'success' : product.status === 'DRAFT' ? 'info' : 'attention'}>
                    {(product.status || 'Active').charAt(0).toUpperCase() + (product.status || 'Active').slice(1).toLowerCase()}
                  </Badge>
                </div>
              ))}
            </BlockStack>
          </BlockStack>
        </Card>
      )}

      {/* SEO */}
      <CollectionSeo seo={formData.seo} onChange={v => onChange('seo', v)} />
    </BlockStack>
  );
}

CollectionForm.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  storeId: PropTypes.string,
  isNew: PropTypes.bool
};
