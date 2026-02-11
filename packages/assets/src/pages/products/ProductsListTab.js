import React from 'react';
import ProductsTableSection from './ProductsTableSection';

/**
 * ProductsListTab Component
 * Contains the products list with search and pagination
 */
export default function ProductsListTab({
  stores,
  products,
  loading,
  selectedStore,
  selectedProducts,
  currentPage,
  itemsPerPage,
  totalProducts,
  totalPages,
  onStoreChange,
  onProductSelect,
  onSelectAll,
  onOpenReimportModal,
  onClearSelection,
  onPageChange,
  onItemsPerPageChange
}) {
  return (
    <ProductsTableSection
      stores={stores}
      products={products}
      loading={loading}
      selectedStore={selectedStore}
      selectedProducts={selectedProducts}
      currentPage={currentPage}
      itemsPerPage={itemsPerPage}
      totalProducts={totalProducts}
      totalPages={totalPages}
      onStoreChange={onStoreChange}
      onProductSelect={onProductSelect}
      onSelectAll={onSelectAll}
      onOpenReimportModal={onOpenReimportModal}
      onClearSelection={onClearSelection}
      onPageChange={onPageChange}
      onItemsPerPageChange={onItemsPerPageChange}
    />
  );
}
