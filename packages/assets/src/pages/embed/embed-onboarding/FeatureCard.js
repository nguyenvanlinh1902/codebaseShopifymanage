import React from 'react';
import PropTypes from 'prop-types';
import {Card, BlockStack, Box, Text, Icon} from '@shopify/polaris';

export function FeatureCard({icon, bg, title, description}) {
  return (
    <Card>
      <BlockStack gap="300">
        <Box background={bg} borderRadius="300" padding="200" maxWidth="fit-content">
          <Icon source={icon} />
        </Box>
        <Text variant="headingSm" as="h3" fontWeight="semibold">
          {title}
        </Text>
        <Text variant="bodySm" tone="subdued">
          {description}
        </Text>
      </BlockStack>
    </Card>
  );
}

FeatureCard.propTypes = {
  icon: PropTypes.func.isRequired,
  bg: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired
};
