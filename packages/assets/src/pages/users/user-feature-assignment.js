import React from 'react';
import {ChoiceList, BlockStack, Text, InlineStack, Button} from '@shopify/polaris';
import PropTypes from 'prop-types';

const ALL_FEATURES = [
  {label: 'Dashboard', value: 'dashboard'},
  {label: 'Stores', value: 'stores'},
  {label: 'Google Sheets', value: 'sheets'},
  {label: 'Products', value: 'products'},
  {label: 'Orders', value: 'orders'},
  {label: 'Tracking', value: 'tracking'},
  {label: 'Analytics', value: 'analytics'},
  {label: 'Themes', value: 'themes'},
  {label: 'Setup Store', value: 'setup'}
];

export default function UserFeatureAssignment({selectedFeatures, onChange}) {
  const allSelected = selectedFeatures.length === ALL_FEATURES.length;
  const toggleAll = () => onChange(allSelected ? [] : ALL_FEATURES.map(f => f.value));

  return (
    <BlockStack gap="200">
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="headingSm">Allowed Features</Text>
        <Button variant="plain" onClick={toggleAll}>{allSelected ? 'Deselect All' : 'Select All'}</Button>
      </InlineStack>
      <Text variant="bodySm" tone="subdued">Empty = all features allowed</Text>
      <ChoiceList
        allowMultiple
        title=""
        titleHidden
        choices={ALL_FEATURES}
        selected={selectedFeatures}
        onChange={onChange}
      />
    </BlockStack>
  );
}

UserFeatureAssignment.propTypes = {
  selectedFeatures: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired
};
