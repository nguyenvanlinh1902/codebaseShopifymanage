import React from 'react';
import {Checkbox, BlockStack, Text, InlineStack, Button} from '@shopify/polaris';
import PropTypes from 'prop-types';

const ALL_FEATURES = [
  {label: 'Dashboard', value: 'dashboard'},
  {label: 'Stores', value: 'stores'},
  {label: 'Google Sheets', value: 'sheets'},
  {label: 'Products', value: 'products'},
  {label: 'Orders', value: 'orders'},
  {label: 'Order Search', value: 'order-search'},
  {label: 'Customer Search', value: 'customer-search'},
  {label: 'Tracking', value: 'tracking'},
  {label: 'Analytics (Revenue)', value: 'analytics'},
  {label: 'Finance (Balance, Campaign Ads)', value: 'finance'},
  {label: 'Disputes', value: 'dispute'},
  {label: 'Themes', value: 'themes'},
  {label: 'Setup Store', value: 'setup'},
  {label: 'Policies', value: 'policies'},
  {label: 'Draft Orders', value: 'draft-orders'},
  {label: 'My Email (Outlook)', value: 'my-email'}
];

// Sub-features rendered indented right below their parent
const SUB_FEATURES = {
  dashboard: [{label: 'Finance Overview', value: 'dashboard-finance'}]
};

// All feature values including sub-features
const ALL_VALUES = [
  ...ALL_FEATURES.map(f => f.value),
  ...Object.values(SUB_FEATURES).flat().map(f => f.value)
];

export default function UserFeatureAssignment({selectedFeatures, onChange}) {
  const allSelected = ALL_VALUES.every(v => selectedFeatures.includes(v));
  const toggleAll = () => onChange(allSelected ? [] : ALL_VALUES);

  const toggle = value => {
    const next = selectedFeatures.includes(value)
      ? selectedFeatures.filter(f => f !== value)
      : [...selectedFeatures, value];
    onChange(next);
  };

  return (
    <BlockStack gap="200">
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="headingSm">Allowed Features</Text>
        <Button variant="plain" onClick={toggleAll}>
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </InlineStack>
      <Text variant="bodySm" tone="subdued">
        Select features to grant access
      </Text>
      <BlockStack gap="100">
        {ALL_FEATURES.map(feature => (
          <React.Fragment key={feature.value}>
            <Checkbox
              label={feature.label}
              checked={selectedFeatures.includes(feature.value)}
              onChange={() => toggle(feature.value)}
            />
            {SUB_FEATURES[feature.value] && selectedFeatures.includes(feature.value) && (
              <div style={{paddingLeft: 24}}>
                {SUB_FEATURES[feature.value].map(sub => (
                  <Checkbox
                    key={sub.value}
                    label={sub.label}
                    checked={selectedFeatures.includes(sub.value)}
                    onChange={() => toggle(sub.value)}
                  />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </BlockStack>
    </BlockStack>
  );
}

UserFeatureAssignment.propTypes = {
  selectedFeatures: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired
};
