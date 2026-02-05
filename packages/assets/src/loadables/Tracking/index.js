import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const Tracking = lazy(() => import('../../pages/Tracking'));

const TrackingLoadable = () => (
  <Suspense fallback={<Loading />}>
    <Tracking />
  </Suspense>
);

export default TrackingLoadable;
