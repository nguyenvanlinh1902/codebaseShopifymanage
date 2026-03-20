import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const EmailManagement = lazy(() => import('../../pages/EmailManagement'));

const EmailManagementLoadable = () => (
  <Suspense fallback={<Loading />}>
    <EmailManagement />
  </Suspense>
);

export default EmailManagementLoadable;
