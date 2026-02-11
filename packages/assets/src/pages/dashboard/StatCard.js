import React from 'react';
import {Card, BlockStack, InlineStack, Text, Icon} from '@shopify/polaris';
import {CheckCircleIcon, AlertCircleIcon} from '@shopify/polaris-icons';

export default function StatCard({title, value, icon, color, done, label}) {
  return (
    <div style={{flex: 1}}>
      <Card>
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="bodySm" as="p" tone="subdued">
              {title}
            </Text>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon source={icon} tone="base" />
            </div>
          </InlineStack>
          <Text variant="heading2xl" as="p">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </Text>
          <InlineStack gap="200" blockAlign="center">
            {done !== null && done !== undefined && (
              <Icon
                source={done ? CheckCircleIcon : AlertCircleIcon}
                tone={done ? 'success' : 'caution'}
              />
            )}
            <Text variant="bodySm" as="p" tone={done ? 'success' : 'subdued'}>
              {label || (done ? 'Configured' : 'Not configured')}
            </Text>
          </InlineStack>
        </BlockStack>
      </Card>
    </div>
  );
}
