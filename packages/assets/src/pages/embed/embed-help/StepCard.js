import React from 'react';
import PropTypes from 'prop-types';
import {Card, Text, BlockStack, InlineStack, Icon, Box, Badge} from '@shopify/polaris';

export default function StepCard({step, number}) {
  return (
    <Card>
      <InlineStack gap="400" blockAlign="center" wrap={false}>
        <Box background={step.bg} borderRadius="300" padding="300" minWidth="44px">
          <Icon source={step.icon} />
        </Box>
        <BlockStack gap="100">
          <InlineStack gap="200" blockAlign="center">
            <Badge size="small">{`Step ${number}`}</Badge>
            <Text variant="headingSm" as="h3" fontWeight="semibold">
              {step.title}
            </Text>
          </InlineStack>
          <Text variant="bodySm" tone="subdued">
            {step.description}
          </Text>
        </BlockStack>
      </InlineStack>
    </Card>
  );
}

StepCard.propTypes = {
  step: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    icon: PropTypes.func.isRequired,
    bg: PropTypes.string.isRequired
  }).isRequired,
  number: PropTypes.number.isRequired
};
