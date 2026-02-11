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
  searchQuery,
  currentPage,
  itemsPerPage,
  totalProducts,
  totalPages,
  onStoreChange,
  onSearchChange,
  onClearSearch,
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
      searchQuery={searchQuery}
      currentPage={currentPage}
      itemsPerPage={itemsPerPage}
      totalProducts={totalProducts}
      totalPages={totalPages}
      onStoreChange={onStoreChange}
      onSearchChange={onSearchChange}
      onClearSearch={onClearSearch}
      onProductSelect={onProductSelect}
      onSelectAll={onSelectAll}
      onOpenReimportModal={onOpenReimportModal}
      onClearSelection={onClearSelection}
      onPageChange={onPageChange}
      onItemsPerPageChange={onItemsPerPageChange}
    />
  );
}
