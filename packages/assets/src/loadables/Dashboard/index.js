import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const Dashboard = lazy(() => import('../../pages/Dashboard'));

const DashboardLoadable = () => (
  <Suspense fallback={<Loading />}>
    <Dashboard />
  </Suspense>
);

export default DashboardLoadable;
