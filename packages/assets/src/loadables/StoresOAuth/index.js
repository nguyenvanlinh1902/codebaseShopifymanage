import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const StoresOAuth = lazy(() => import('../../pages/StoresOAuth'));

const StoresOAuthLoadable = () => (
  <Suspense fallback={<Loading />}>
    <StoresOAuth />
  </Suspense>
);

export default StoresOAuthLoadable;
