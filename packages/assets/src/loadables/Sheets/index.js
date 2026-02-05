import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const Sheets = lazy(() => import('../../pages/Sheets'));

const SheetsLoadable = () => (
  <Suspense fallback={<Loading />}>
    <Sheets />
  </Suspense>
);

export default SheetsLoadable;
