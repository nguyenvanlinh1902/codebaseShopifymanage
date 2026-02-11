import React from 'react';
import PropTypes from 'prop-types';
import {BlockStack, InlineStack, Text, Button, Box, Icon, Collapsible} from '@shopify/polaris';
import {CheckCircleIcon} from '@shopify/polaris-icons';

export default function QuickStartTask({
  completed,
  label,
  description,
  selected,
  onSelect,
  buttons
}) {
  return (
    <Box
      padding="300"
      borderRadius="200"
      background={selected ? 'bg-surface-secondary' : undefined}
    >
      <InlineStack gap="300" blockAlign="start" wrap={false}>
        <Box paddingBlockStart="050">
          {completed ? (
            <Icon source={CheckCircleIcon} tone="success" />
          ) : (
            <Box
              borderWidth="025"
              borderColor="border"
              borderRadius="full"
              minWidth="20px"
              minHeight="20px"
            />
          )}
        </Box>
        <Box width="100%">
          <BlockStack gap="100">
            <Box onClick={onSelect} role="button" style={{cursor: 'pointer'}}>
              <Text
                variant="bodyMd"
                fontWeight={selected ? 'semibold' : 'regular'}
                tone={completed ? 'subdued' : undefined}
              >
                {label}
              </Text>
            </Box>
            <Collapsible open={selected} transition={{duration: '200ms'}}>
              <BlockStack gap="300">
                <Text variant="bodySm" tone="subdued">
                  {description}
                </Text>
                <InlineStack gap="200">
                  {buttons.map(btn => (
                    <Button
                      key={btn.text}
                      onClick={btn.onClick}
                      variant={btn.variant || 'secondary'}
                      icon={btn.icon}
                      size="slim"
                    >
                      {btn.text}
                    </Button>
                  ))}
                </InlineStack>
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Box>
      </InlineStack>
    </Box>
  );
}

QuickStartTask.propTypes = {
  completed: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  buttons: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      variant: PropTypes.string,
      icon: PropTypes.func
    })
  ).isRequired
};
