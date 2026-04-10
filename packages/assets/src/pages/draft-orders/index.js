import React, {useState, useEffect} from 'react';
import {Routes, Route, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {usePermittedStores} from '../../hooks/usePermittedStores';
import DraftOrderList from './draft-order-list';
import DraftOrderForm from './draft-order-form';

/** Wrapper reads :id and ?storeId from URL */
function DraftOrderEditWrapper({stores, storeOptions, navigate}) {
  const {id} = useParams();
  const [searchParams] = useSearchParams();
  const storeIdFromUrl = searchParams.get('storeId') || '';
  const [selectedStoreId, setSelectedStoreId] = useState(storeIdFromUrl);

  // Fallback: if no storeId in URL, use first permitted store
  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) setSelectedStoreId(stores[0].id);
  }, [stores, selectedStoreId]);

  const handleStoreChange = newId => {
    setSelectedStoreId(newId);
    navigate(`/draft-orders/${id}?storeId=${newId}`, {replace: true});
  };

  return (
    <DraftOrderForm
      storeId={selectedStoreId}
      storeOptions={storeOptions}
      onStoreChange={handleStoreChange}
      onBack={() => navigate('/draft-orders')}
      editOrderId={id}
      onOrderCreated={(newId, sId) => navigate(`/draft-orders/${newId}?storeId=${sId}`, {replace: true})}
    />
  );
}

/** Wrapper for create — reads ?storeId from URL */
function DraftOrderCreateWrapper({stores, storeOptions, navigate}) {
  const [searchParams] = useSearchParams();
  const storeIdFromUrl = searchParams.get('storeId') || '';
  const [selectedStoreId, setSelectedStoreId] = useState(storeIdFromUrl);

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) setSelectedStoreId(stores[0].id);
  }, [stores, selectedStoreId]);

  const handleStoreChange = newId => {
    setSelectedStoreId(newId);
    navigate(`/draft-orders/new?storeId=${newId}`, {replace: true});
  };

  return (
    <DraftOrderForm
      storeId={selectedStoreId}
      storeOptions={storeOptions}
      onStoreChange={handleStoreChange}
      onBack={() => navigate('/draft-orders')}
      onOrderCreated={(newId, sId) => navigate(`/draft-orders/${newId}?storeId=${sId}`, {replace: true})}
    />
  );
}

export default function DraftOrders() {
  const {stores} = usePermittedStores();
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores, selectedStoreId]);

  const storeOptions = stores.map(s => ({label: s.name || s.shopDomain, value: s.id}));

  return (
    <Routes>
      <Route path="new" element={
        <DraftOrderCreateWrapper stores={stores} storeOptions={storeOptions} navigate={navigate} />
      } />
      <Route path=":id" element={
        <DraftOrderEditWrapper stores={stores} storeOptions={storeOptions} navigate={navigate} />
      } />
      <Route index element={
        <DraftOrderList
          storeId={selectedStoreId}
          storeOptions={storeOptions}
          onStoreChange={setSelectedStoreId}
          onCreate={() => navigate(`/draft-orders/new?storeId=${selectedStoreId}`)}
          onEdit={id => navigate(`/draft-orders/${id}?storeId=${selectedStoreId}`)}
        />
      } />
    </Routes>
  );
}
