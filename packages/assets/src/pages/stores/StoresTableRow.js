import React from 'react';
import {IndexTable, Text, Badge, InlineStack, Button} from '@shopify/polaris';
import {DeleteIcon} from '@shopify/polaris-icons';

/**
 * Individual row in the stores table
 */
export default function StoresTableRow({store, index, isSelected, onDeleteClick}) {
  return (
    <IndexTable.Row id={store.id} key={store.id} position={index} selected={isSelected}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold">
          {store.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{store.shopDomain}</IndexTable.Cell>
      <IndexTable.Cell>{store.niche || '-'}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={store.status === 'active' ? 'success' : 'warning'}>{store.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack align="center">
          <Button
            icon={DeleteIcon}
            tone="critical"
            variant="plain"
            onClick={e => {
              e.stopPropagation();
              onDeleteClick(store.id);
            }}
            accessibilityLabel={`Delete ${store.name}`}
          />
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  );
}
