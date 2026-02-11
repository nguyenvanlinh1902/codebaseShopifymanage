import React from 'react';
import {Card, IndexTable, Text, Badge, BlockStack, SkeletonBodyText} from '@shopify/polaris';

export default function MetafieldDefinitionsTable({definitions}) {
  const definitionRows = definitions.map((def, index) => (
    <IndexTable.Row
      id={`${def.namespace}.${def.key}`}
      key={`${def.namespace}.${def.key}`}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold">
          {def.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd">
          {def.namespace}.{def.key}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge>{def.type}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="info">{def.ownerType}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text tone="subdued" variant="bodySm">
          {def.description}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Predefined Metafield Definitions
        </Text>
        <Text tone="subdued" variant="bodySm">
          These metafield definitions will be created on selected stores during setup.
        </Text>
        {definitions.length > 0 ? (
          <IndexTable
            itemCount={definitions.length}
            headings={[
              {title: 'Name'},
              {title: 'Namespace.Key'},
              {title: 'Type'},
              {title: 'Owner'},
              {title: 'Description'}
            ]}
            selectable={false}
          >
            {definitionRows}
          </IndexTable>
        ) : (
          <SkeletonBodyText lines={3} />
        )}
      </BlockStack>
    </Card>
  );
}
