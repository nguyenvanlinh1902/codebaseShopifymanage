/* eslint-disable react/prop-types */
import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import {Card, BlockStack, TextField, Text} from '@shopify/polaris';
import RichTextEditor from '../collections/rich-text-editor';
import '../collections/rich-text-editor.css';
import ProductMedia from './product-media';

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function ProductCore({formData, onChange, storeId, isNew}) {
  useEffect(() => {
    // Only auto-slugify handle from title for brand-new products. For existing
    // products Shopify already has a handle — never overwrite it from the title.
    if (isNew && !formData.handleManuallyEdited) {
      onChange('handle', slugify(formData.title));
    }
  }, [formData.title, isNew]);

  return (
    <Card>
      <BlockStack gap="400">
        <TextField
          label="Title"
          value={formData.title || ''}
          onChange={v => onChange('title', v)}
          autoComplete="off"
          requiredIndicator
        />
        <BlockStack gap="100">
          <Text as="label" variant="bodySm" fontWeight="medium">
            Description
          </Text>
          <div className="pc-desc-compact">
            <RichTextEditor
              value={formData.descriptionHtml || ''}
              onChange={v => onChange('descriptionHtml', v)}
            />
          </div>
        </BlockStack>
        <ProductMedia formData={formData} onChange={onChange} storeId={storeId} embedded />
        <TextField
          label="Category"
          value={
            typeof formData.category === 'object' && formData.category !== null
              ? formData.category.fullName || formData.category.name || ''
              : formData.category || ''
          }
          onChange={v => onChange('category', v)}
          placeholder="e.g. Apparel"
          autoComplete="off"
          helpText="Product category (e.g. Apparel, Electronics)"
        />
      </BlockStack>
      <style>{`
        .pc-desc-compact .rte-content .tiptap {
          min-height: 80px;
          max-height: 200px;
          overflow-y: auto;
        }
      `}</style>
    </Card>
  );
}

ProductCore.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  storeId: PropTypes.string
};
