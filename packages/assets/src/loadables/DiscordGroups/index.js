import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const DiscordGroups = lazy(() => import('../../pages/DiscordGroups'));

const DiscordGroupsLoadable = () => (
  <Suspense fallback={<Loading />}>
    <DiscordGroups />
  </Suspense>
);

export default DiscordGroupsLoadable;
