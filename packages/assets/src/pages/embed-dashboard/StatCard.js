import React from 'react';
import PropTypes from 'prop-types';
import {Card, BlockStack, InlineStack, Text, Badge, Box, Icon} from '@shopify/polaris';

export default function StatCard({title, value, icon, iconBg, status, statusTone, subtitle}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="bodySm" tone="subdued" fontWeight="medium">
            {title}
          </Text>
          <Box background={iconBg} borderRadius="300" padding="200">
            <Icon source={icon} tone="base" />
          </Box>
        </InlineStack>
        <Text variant="headingXl" as="p" fontWeight="bold">
          {value}
        </Text>
        {status && (
          <InlineStack gap="150" blockAlign="center">
            <Badge tone={statusTone} size="small">
              {status}
            </Badge>
            {subtitle && (
              <Text variant="bodySm" tone="subdued">
                {subtitle}
              </Text>
            )}
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.func.isRequired,
  iconBg: PropTypes.string,
  status: PropTypes.string,
  statusTone: PropTypes.string,
  subtitle: PropTypes.string
};
