import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const Orders = lazy(() => import('../../pages/Orders'));

const OrdersLoadable = () => (
  <Suspense fallback={<Loading />}>
    <Orders />
  </Suspense>
);

export default OrdersLoadable;
