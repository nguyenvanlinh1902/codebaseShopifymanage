import React from 'react';
import {ChoiceList, BlockStack, Text, InlineStack, Button} from '@shopify/polaris';
import PropTypes from 'prop-types';

export default function UserStoreAssignment({stores, selectedStoreIds, onChange}) {
  // Support both legacy string[] and current {id, shopDomain}[] formats
  const selectedIds = selectedStoreIds.map(s => (typeof s === 'string' ? s : s.id));
  const allSelected = stores.length > 0 && selectedIds.length === stores.length;

  const toggleAll = () =>
    onChange(allSelected ? [] : stores.map(s => ({id: s.id, shopDomain: s.shopDomain})));

  const choices = stores.map(s => ({label: `${s.name || s.shopDomain} (${s.shopDomain})`, value: s.id}));

  // ChoiceList returns string[] of IDs; map back to {id, shopDomain} objects
  const handleChange = ids => {
    onChange(
      ids.map(id => {
        const store = stores.find(s => s.id === id);
        return {id, shopDomain: store?.shopDomain || ''};
      })
    );
  };

  if (stores.length === 0)
    return (
      <Text tone="subdued" variant="bodySm">
        No stores available
      </Text>
    );

  return (
    <BlockStack gap="200">
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="headingSm">Assigned Stores</Text>
        <Button variant="plain" onClick={toggleAll}>
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </InlineStack>
      <Text variant="bodySm" tone="subdued">
        Empty = no store access
      </Text>
      <ChoiceList
        allowMultiple
        title=""
        titleHidden
        choices={choices}
        selected={selectedIds}
        onChange={handleChange}
      />
    </BlockStack>
  );
}

UserStoreAssignment.propTypes = {
  stores: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      shopDomain: PropTypes.string
    })
  ).isRequired,
  selectedStoreIds: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.arrayOf(PropTypes.shape({id: PropTypes.string, shopDomain: PropTypes.string}))
  ]).isRequired,
  onChange: PropTypes.func.isRequired
};
