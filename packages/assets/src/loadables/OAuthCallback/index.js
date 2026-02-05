import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const OAuthCallback = lazy(() => import('../../pages/OAuthCallback'));

const OAuthCallbackLoadable = () => (
  <Suspense fallback={<Loading />}>
    <OAuthCallback />
  </Suspense>
);

export default OAuthCallbackLoadable;
