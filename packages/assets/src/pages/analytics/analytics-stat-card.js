import React from 'react';
import {Text, InlineStack, BlockStack, Icon} from '@shopify/polaris';
import PropTypes from 'prop-types';

export default function AnalyticsStatCard({title, value, icon, color, subtitle}) {
  return (
    <div style={{
      padding: '20px',
      borderRadius: '12px',
      background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
      border: `1px solid ${color}30`
    }}>
      <InlineStack align="space-between" blockAlign="center">
        <BlockStack gap="100">
          <Text variant="bodySm" tone="subdued">{title}</Text>
          <Text variant="heading2xl" as="h3">{value}</Text>
          {subtitle && <Text variant="bodySm" tone="subdued">{subtitle}</Text>}
        </BlockStack>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: `${color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon source={icon} tone="base" />
        </div>
      </InlineStack>
    </div>
  );
}

AnalyticsStatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.elementType.isRequired,
  color: PropTypes.string.isRequired,
  subtitle: PropTypes.string
};
