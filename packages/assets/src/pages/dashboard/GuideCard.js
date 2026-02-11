import React from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Icon,
  Collapsible,
  Box
} from '@shopify/polaris';
import {ChevronDownIcon, ChevronUpIcon} from '@shopify/polaris-icons';

export default function GuideCard({
  step,
  title,
  description,
  icon,
  color,
  done,
  doneText,
  pendingText,
  open,
  onToggle,
  actionLabel,
  actionUrl,
  children
}) {
  return (
    <Card>
      <BlockStack gap="300">
        {/* Header */}
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Icon source={icon} tone="base" />
            </div>
            <BlockStack gap="050">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingSm" as="h3">
                  Step {step}: {title}
                </Text>
                {done === true && <Badge tone="success">{doneText}</Badge>}
                {done === false && <Badge tone="attention">{pendingText}</Badge>}
                {done === null && <Badge>{pendingText}</Badge>}
              </InlineStack>
              <Text variant="bodySm" as="p" tone="subdued">
                {description}
              </Text>
            </BlockStack>
          </InlineStack>
          <InlineStack gap="200">
            <Button url={actionUrl} size="slim">
              {actionLabel}
            </Button>
            <Button
              onClick={onToggle}
              icon={open ? ChevronUpIcon : ChevronDownIcon}
              variant="plain"
              accessibilityLabel={open ? 'Collapse guide' : 'Expand guide'}
            />
          </InlineStack>
        </InlineStack>

        {/* Collapsible Guide */}
        <Collapsible open={open} transition={{duration: '200ms', timingFunction: 'ease-in-out'}}>
          <Box paddingBlockStart="200" paddingInlineStart="1200">
            {children}
          </Box>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}
