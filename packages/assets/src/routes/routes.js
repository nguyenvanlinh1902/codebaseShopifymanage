import React, {Suspense} from 'react';
import {Route, Switch} from 'react-router-dom';
import Home from '@assets/loadables/Home/Home';
import NotFound from '@assets/loadables/NotFound/NotFound';
import Samples from '@assets/loadables/Samples/Samples';
import Settings from '@assets/loadables/Settings/Settings';
import OptionalScopes from '@assets/loadables/OptionalScopes/OptionalScopes';
import {routePrefix, isEmbeddedApp} from '@assets/config/app';
import Loading from '@assets/components/Loading';
import Tables from '@assets/loadables/Tables/Tables';
import Login from '@assets/loadables/Auth/Login';
import Register from '@assets/loadables/Auth/Register';
import ForgotPassword from '@assets/loadables/Auth/ForgotPassword';
import ResetPassword from '@assets/loadables/Auth/ResetPassword';
import TicketsList from '@assets/loadables/Tickets/TicketsList';
import TicketDetail from '@assets/loadables/Tickets/TicketDetail';
import {ProtectedRoute, GuestRoute} from '@assets/components/Auth';

const FullscreenPageA = React.lazy(() => import('../pages/FullscreenPageA'));

// eslint-disable-next-line react/prop-types
const Routes = ({prefix = routePrefix}) => (
  <Suspense fallback={<Loading />}>
    <Switch>
      {/* Auth routes (standalone mode only) */}
      {!isEmbeddedApp && (
        <>
          <GuestRoute exact path="/login" component={Login} />
          <GuestRoute exact path="/register" component={Register} />
          <GuestRoute exact path="/forgot-password" component={ForgotPassword} />
          <GuestRoute exact path="/reset-password" component={ResetPassword} />
        </>
      )}

      {/* Ticket routes */}
      <ProtectedRoute exact path={prefix + '/tickets'} component={TicketsList} />
      <ProtectedRoute exact path={prefix + '/tickets/:id'} component={TicketDetail} />

      {/* Existing routes */}
      <Route exact path={prefix + '/'} component={Home} />
      <Route exact path={prefix + '/samples'} component={Samples} />
      <Route exact path={prefix + '/settings'} component={Settings} />
      <Route exact path={prefix + '/fullscreen-page-a'} component={FullscreenPageA} />
      <Route exact path={prefix + '/optional-scopes'} component={OptionalScopes} />
      <Route exact path={prefix + '/tables'} component={Tables} />
      <Route exact path={prefix + '/tables/:tab(simple|action)'} component={Tables} />
      <Route path="*" component={NotFound} />
    </Switch>
  </Suspense>
);

export default Routes;
