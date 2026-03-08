import React from 'react';
import {BlockStack, Text, SkeletonBodyText} from '@shopify/polaris';
import PropTypes from 'prop-types';

export default function AnalyticsBalancePanel({balance, loading}) {
  if (loading) return <SkeletonBodyText lines={3} />;

  if (!balance) {
    return <Text tone="subdued">Shopify Payments not available</Text>;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: balance.currency || 'USD'
  }).format(balance.amount || 0);

  return (
    <BlockStack gap="200">
      <Text variant="headingMd">Shopify Payments Balance</Text>
      <Text variant="heading2xl" as="h2">{formatted}</Text>
      <Text variant="bodySm" tone="subdued">{balance.currency}</Text>
    </BlockStack>
  );
}

AnalyticsBalancePanel.propTypes = {
  balance: PropTypes.shape({
    currency: PropTypes.string,
    amount: PropTypes.number
  }),
  loading: PropTypes.bool
};
