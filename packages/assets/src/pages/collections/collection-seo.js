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

export default function CollectionSeo({seo, onChange}) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (field, value) => {
    onChange({...seo, [field]: value});
  };

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
          <BlockStack gap="100">
            {seo.title ? (
              <Text as="p" variant="bodySm" fontWeight="medium" tone="success">
                {seo.title}
              </Text>
            ) : (
              <Text as="p" variant="bodySm" tone="subdued">
                Add a title and description to see how this collection might appear in search engine
                results.
              </Text>
            )}
            {seo.description && (
              <Text as="p" variant="bodySm" tone="subdued">
                {seo.description}
              </Text>
            )}
            {seo.handle && (
              <Text as="p" variant="bodySm" tone="subdued">
                /collections/{seo.handle}
              </Text>
            )}
          </BlockStack>
        )}

        <Collapsible open={expanded} id="seo-fields">
          <BlockStack gap="300">
            <TextField
              label="Page title"
              value={seo.title}
              onChange={v => handleChange('title', v)}
              placeholder="Collection page title for search engines"
              autoComplete="off"
              helpText="Recommended: 50–60 characters"
            />
            <TextField
              label="Meta description"
              value={seo.description}
              onChange={v => handleChange('description', v)}
              placeholder="Describe this collection for search engines"
              multiline={3}
              autoComplete="off"
              helpText="Recommended: 120–160 characters"
            />
            <TextField
              label="URL handle"
              value={seo.handle}
              onChange={v => handleChange('handle', v)}
              placeholder="collection-url-handle"
              prefix="/collections/"
              autoComplete="off"
              helpText="Use only lowercase letters, numbers, and hyphens."
            />
          </BlockStack>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}

CollectionSeo.propTypes = {
  seo: PropTypes.shape({
    title: PropTypes.string,
    description: PropTypes.string,
    handle: PropTypes.string
  }).isRequired,
  onChange: PropTypes.func.isRequired
};
