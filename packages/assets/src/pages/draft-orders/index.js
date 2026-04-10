import React, {useState, useEffect} from 'react';
import {usePermittedStores} from '../../hooks/usePermittedStores';
import DraftOrderList from './draft-order-list';
import DraftOrderForm from './draft-order-form';

export default function DraftOrders() {
  const {stores} = usePermittedStores();
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [view, setView] = useState('list');
  const [editingOrderId, setEditingOrderId] = useState(null);

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores, selectedStoreId]);

  const storeOptions = stores.map(s => ({label: s.name || s.shopDomain, value: s.id}));

  if (view === 'create') {
    return (
      <DraftOrderForm
        storeId={selectedStoreId}
        storeOptions={storeOptions}
        onStoreChange={setSelectedStoreId}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'edit' && editingOrderId) {
    return (
      <DraftOrderForm
        storeId={selectedStoreId}
        storeOptions={storeOptions}
        onStoreChange={setSelectedStoreId}
        onBack={() => {
          setView('list');
          setEditingOrderId(null);
        }}
        editOrderId={editingOrderId}
      />
    );
  }

  return (
    <DraftOrderList
      storeId={selectedStoreId}
      storeOptions={storeOptions}
      onStoreChange={setSelectedStoreId}
      onCreate={() => setView('create')}
      onEdit={id => {
        setEditingOrderId(id);
        setView('edit');
      }}
    />
  );
}
