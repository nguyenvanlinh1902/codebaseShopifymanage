import React from 'react';
import PropTypes from 'prop-types';
import {Box, Text, InlineStack, Icon, Divider} from '@shopify/polaris';
import {CheckCircleIcon} from '@shopify/polaris-icons';

export function StepIndicator({steps, currentStep}) {
  return (
    <InlineStack gap="200" align="center" blockAlign="center" wrap={false}>
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <InlineStack key={step.key} gap="200" blockAlign="center" wrap={false}>
            <Box
              background={
                isDone ? 'bg-fill-success' : isActive ? 'bg-fill-info' : 'bg-surface-secondary'
              }
              borderRadius="full"
              padding="100"
              minWidth="28px"
              minHeight="28px"
            >
              <InlineStack align="center" blockAlign="center">
                {isDone ? (
                  <Icon source={CheckCircleIcon} tone="text-inverse" />
                ) : (
                  <Text
                    variant="bodySm"
                    fontWeight="bold"
                    tone={isActive ? 'text-inverse' : 'subdued'}
                    alignment="center"
                  >
                    {i + 1}
                  </Text>
                )}
              </InlineStack>
            </Box>
            <Text
              variant="bodySm"
              fontWeight={isActive ? 'bold' : 'regular'}
              tone={isDone || isActive ? undefined : 'subdued'}
            >
              {step.title}
            </Text>
            {i < steps.length - 1 && (
              <Box paddingInlineStart="100" paddingInlineEnd="100">
                <Divider />
              </Box>
            )}
          </InlineStack>
        );
      })}
    </InlineStack>
  );
}

StepIndicator.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired
    })
  ).isRequired,
  currentStep: PropTypes.number.isRequired
};
