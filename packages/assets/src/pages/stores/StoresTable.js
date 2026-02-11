import React from 'react';
import {IndexTable, SkeletonBodyText, EmptyState} from '@shopify/polaris';
import StoresTableRow from './StoresTableRow';

/**
 * Main stores table with rows
 */
export default function StoresTable({
  stores,
  loading,
  activeSearch,
  nicheFilter,
  selectedResources,
  allResourcesSelected,
  onSelectionChange,
  onDeleteClick,
  onBulkDeleteClick,
  onAddStore
}) {
  const resourceName = {singular: 'store', plural: 'stores'};

  const promotedBulkActions = [
    {
      content: `Delete ${selectedResources.length} store(s)`,
      onAction: onBulkDeleteClick,
      destructive: true
    }
  ];

  if (loading) {
    return (
      <div style={{padding: '16px'}}>
        <SkeletonBodyText lines={5} />
      </div>
    );
  }

  if (stores.length === 0) {
    if (activeSearch || nicheFilter.length > 0) {
      return (
        <EmptyState heading="No stores found" image="">
          <p>Try a different search term or filter.</p>
        </EmptyState>
      );
    }
    return (
      <EmptyState
        heading="No stores connected"
        action={{content: 'Add Store', onAction: onAddStore}}
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>Add your first Shopify store to get started.</p>
      </EmptyState>
    );
  }

  const rowMarkup = stores.map((store, index) => (
    <StoresTableRow
      key={store.id}
      store={store}
      index={index}
      isSelected={selectedResources.includes(store.id)}
      onDeleteClick={onDeleteClick}
    />
  ));

  return (
    <IndexTable
      resourceName={resourceName}
      itemCount={stores.length}
      headings={[
        {title: 'Name'},
        {title: 'Shop Domain'},
        {title: 'Niche'},
        {title: 'Status'},
        {title: 'Actions', alignment: 'center'}
      ]}
      selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
      onSelectionChange={onSelectionChange}
      promotedBulkActions={promotedBulkActions}
    >
      {rowMarkup}
    </IndexTable>
  );
}
