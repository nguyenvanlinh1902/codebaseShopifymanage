import React, {lazy, Suspense} from 'react';
import Loading from '../../components/Loading';

const DiscordSettings = lazy(() => import('../../pages/DiscordSettings'));

const DiscordSettingsLoadable = () => (
  <Suspense fallback={<Loading />}>
    <DiscordSettings />
  </Suspense>
);

export default DiscordSettingsLoadable;
