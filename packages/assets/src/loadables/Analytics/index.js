import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const Analytics = lazy(() => import('../../pages/Analytics'));

const AnalyticsLoadable = () => (
  <Suspense fallback={<Loading />}>
    <Analytics />
  </Suspense>
);

export default AnalyticsLoadable;
