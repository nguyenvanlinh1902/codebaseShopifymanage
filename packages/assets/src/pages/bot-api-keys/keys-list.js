import React from 'react';
import PropTypes from 'prop-types';
import {
  IndexTable,
  Card,
  Badge,
  Button,
  Text,
  EmptyState,
  InlineStack,
  useIndexResourceState
} from '@shopify/polaris';

function statusBadge(key) {
  if (key.revokedAt) return <Badge tone="critical">Revoked</Badge>;
  if (key.expiresAt && new Date(key.expiresAt) <= new Date()) return <Badge tone="warning">Expired</Badge>;
  return <Badge tone="success">Active</Badge>;
}

function fmt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function KeysList({keys, loading, onRevoke}) {
  const resourceName = {singular: 'key', plural: 'keys'};
  const {selectedResources, allResourcesSelected, handleSelectionChange} = useIndexResourceState(keys, {
    resourceIDResolver: k => k.id
  });

  if (!loading && (!keys || keys.length === 0)) {
    return (
      <Card>
        <EmptyState
          heading="No bot API keys yet"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Click “Create new key” to mint a key that external AI bots can use.</p>
        </EmptyState>
      </Card>
    );
  }

  const rowMarkup = keys.map((key, index) => (
    <IndexTable.Row id={key.id} key={key.id} position={index} selected={selectedResources.includes(key.id)}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">{key.name || '(unnamed)'}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <code>bot_{key.keyPrefix}…</code>
      </IndexTable.Cell>
      <IndexTable.Cell>{key.createdByUsername || key.userId || '—'}</IndexTable.Cell>
      <IndexTable.Cell>{fmt(key.createdAt)}</IndexTable.Cell>
      <IndexTable.Cell>{fmt(key.lastUsedAt)}</IndexTable.Cell>
      <IndexTable.Cell>{key.requestCount ?? 0}</IndexTable.Cell>
      <IndexTable.Cell>{statusBadge(key)}</IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          {!key.revokedAt && (
            <Button tone="critical" variant="plain" onClick={() => onRevoke(key)}>
              Revoke
            </Button>
          )}
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      <IndexTable
        resourceName={resourceName}
        itemCount={keys.length}
        loading={loading}
        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
        onSelectionChange={handleSelectionChange}
        selectable={false}
        headings={[
          {title: 'Name'},
          {title: 'Prefix'},
          {title: 'Created by'},
          {title: 'Created'},
          {title: 'Last used'},
          {title: 'Requests'},
          {title: 'Status'},
          {title: 'Actions'}
        ]}
      >
        {rowMarkup}
      </IndexTable>
    </Card>
  );
}

KeysList.propTypes = {
  keys: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  onRevoke: PropTypes.func.isRequired
};
