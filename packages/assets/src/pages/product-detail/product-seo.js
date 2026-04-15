/* eslint-disable react/prop-types */
import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  BlockStack,
  TextField,
  Text,
  Button,
  Collapsible,
  InlineStack
} from '@shopify/polaris';
import {EditIcon} from '@shopify/polaris-icons';

export default function ProductSeo({formData, onChange, shopDomain}) {
  const [expanded, setExpanded] = useState(false);
  const seo = formData.seo || {};

  const handleChange = (field, value) => {
    onChange('seo', {...seo, [field]: value});
  };

  const domain = shopDomain || 'your-store.myshopify.com';
  const handle = formData.handle || '';
  const displayTitle = seo.title || formData.title || '';
  const strippedDesc = (seo.description || (formData.descriptionHtml || '').replace(/<[^>]+>/g, ' ')).trim();
  const shortDesc = strippedDesc.length > 160 ? `${strippedDesc.slice(0, 160)}…` : strippedDesc;
  const price = formData.variants?.[0]?.price;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            Search engine listing
          </Text>
          <Button icon={EditIcon} variant="plain" onClick={() => setExpanded(v => !v)}>
            {expanded ? 'Done' : 'Edit'}
          </Button>
        </InlineStack>

        {!expanded && (
          <div className="pseo-preview">
            {displayTitle ? (
              <>
                <div className="pseo-domain">{domain.replace(/^https?:\/\//, '').split('/')[0]}</div>
                <div className="pseo-url">
                  https://{domain.replace(/^https?:\/\//, '')}
                  {handle && <> <span className="pseo-sep">›</span> products <span className="pseo-sep">›</span> {handle}</>}
                </div>
                <div className="pseo-title">{displayTitle.length > 70 ? `${displayTitle.slice(0, 70)}…` : displayTitle}</div>
                {shortDesc && <div className="pseo-desc">{shortDesc}</div>}
                {price && <div className="pseo-price">${price} USD</div>}
              </>
            ) : (
              <Text as="p" variant="bodySm" tone="subdued">
                Add a title and description to see how this product might appear in search engine
                results.
              </Text>
            )}
          </div>
        )}

        <Collapsible open={expanded} id="product-seo-fields">
          <BlockStack gap="300">
            <TextField
              label="Page title"
              value={seo.title || ''}
              onChange={v => handleChange('title', v)}
              placeholder="Product page title for search engines"
              autoComplete="off"
              helpText={`${(seo.title || '').length} of 70 characters used`}
            />
            <TextField
              label="Meta description"
              value={seo.description || ''}
              onChange={v => handleChange('description', v)}
              placeholder="Describe this product for search engines"
              multiline={3}
              autoComplete="off"
              helpText={`${(seo.description || '').length} of 160 characters used`}
            />
            <TextField
              label="URL handle"
              value={handle}
              onChange={v => {
                onChange('handleManuallyEdited', true);
                onChange('handle', v);
              }}
              prefix="products/"
              autoComplete="off"
              helpText={`https://${domain.replace(/^https?:\/\//, '')}/products/${handle}`}
            />
          </BlockStack>
        </Collapsible>
      </BlockStack>
      <style>{`
        .pseo-preview { display: flex; flex-direction: column; gap: 2px; }
        .pseo-domain { font-size: 13px; color: #202223; font-weight: 500; }
        .pseo-url { font-size: 12px; color: #6d7175; }
        .pseo-sep { color: #8c9196; }
        .pseo-title {
          color: #1a0dab;
          font-size: 18px;
          line-height: 1.3;
          margin-top: 4px;
          cursor: pointer;
          text-decoration: none;
        }
        .pseo-title:hover { text-decoration: underline; }
        .pseo-desc {
          font-size: 13px;
          color: #4a4a4a;
          line-height: 1.45;
          margin-top: 4px;
        }
        .pseo-price {
          font-size: 13px;
          color: #202223;
          margin-top: 6px;
        }
      `}</style>
    </Card>
  );
}

ProductSeo.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired
};
