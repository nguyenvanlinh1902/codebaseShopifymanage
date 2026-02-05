import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const Stores = lazy(() => import('../../pages/Stores'));

const StoresLoadable = () => (
  <Suspense fallback={<Loading />}>
    <Stores />
  </Suspense>
);

export default StoresLoadable;
