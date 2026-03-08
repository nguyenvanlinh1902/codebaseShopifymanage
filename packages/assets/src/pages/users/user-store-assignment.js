import React from 'react';
import {ChoiceList, BlockStack, Text, InlineStack, Button} from '@shopify/polaris';
import PropTypes from 'prop-types';

export default function UserStoreAssignment({stores, selectedStoreIds, onChange}) {
  const allSelected = stores.length > 0 && selectedStoreIds.length === stores.length;
  const toggleAll = () => onChange(allSelected ? [] : stores.map(s => s.id));
  const choices = stores.map(s => ({label: s.name || s.shopDomain, value: s.id}));

  if (stores.length === 0) return <Text tone="subdued" variant="bodySm">No stores available</Text>;

  return (
    <BlockStack gap="200">
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="headingSm">Assigned Stores</Text>
        <Button variant="plain" onClick={toggleAll}>{allSelected ? 'Deselect All' : 'Select All'}</Button>
      </InlineStack>
      <Text variant="bodySm" tone="subdued">Empty = no store access</Text>
      <ChoiceList
        allowMultiple
        title=""
        titleHidden
        choices={choices}
        selected={selectedStoreIds}
        onChange={onChange}
      />
    </BlockStack>
  );
}

UserStoreAssignment.propTypes = {
  stores: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    shopDomain: PropTypes.string
  })).isRequired,
  selectedStoreIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired
};
