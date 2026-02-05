import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const Products = lazy(() => import('../../pages/Products'));

const ProductsLoadable = () => (
  <Suspense fallback={<Loading />}>
    <Products />
  </Suspense>
);

export default ProductsLoadable;
