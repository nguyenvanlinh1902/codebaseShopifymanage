import React from 'react';
import PropTypes from 'prop-types';
import {Text, BlockStack, InlineStack, Collapsible, Icon, Box} from '@shopify/polaris';
import {ChevronDownIcon, ChevronUpIcon} from '@shopify/polaris-icons';

export default function FaqItem({item, open, onToggle}) {
  return (
    <BlockStack gap="0">
      <Box
        paddingBlockStart="300"
        paddingBlockEnd="300"
        role="button"
        onClick={onToggle}
        style={{cursor: 'pointer'}}
      >
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text variant="bodyMd" fontWeight="medium">
            {item.question}
          </Text>
          <Icon source={open ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
        </InlineStack>
      </Box>
      <Collapsible open={open} transition={{duration: '200ms'}}>
        <Box paddingBlockEnd="300">
          <Text variant="bodyMd" tone="subdued">
            {item.answer}
          </Text>
        </Box>
      </Collapsible>
    </BlockStack>
  );
}

FaqItem.propTypes = {
  item: PropTypes.shape({
    question: PropTypes.string.isRequired,
    answer: PropTypes.string.isRequired
  }).isRequired,
  open: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired
};
