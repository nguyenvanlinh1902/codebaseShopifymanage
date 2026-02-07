import React, {forwardRef} from 'react';
import PropTypes from 'prop-types';
import {BrowserRouter, Routes, Route, Link as RouterLink, useLocation} from 'react-router-dom';
import {AppProvider, Frame, Navigation, Spinner} from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';
import {
  HomeIcon,
  StoreIcon,
  NoteIcon,
  ProductIcon,
  OrderIcon,
  DeliveryIcon,
  ChartVerticalFilledIcon,
  ExitIcon
} from '@shopify/polaris-icons';

import {AuthProvider, useAuth} from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stores from './pages/Stores';
import StoresOAuth from './pages/StoresOAuth';
import OAuthCallback from './pages/OAuthCallback';
import Sheets from './pages/Sheets';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Tracking from './pages/Tracking';
import Analytics from './pages/Analytics';
import NotFound from './pages/NotFound';

// Custom link component so Polaris uses React Router instead of native <a> tags
const PolarisLink = forwardRef(({url, external, ...rest}, ref) => {
  if (external) {
    // eslint-disable-next-line react/jsx-no-target-blank
    return <a href={url} ref={ref} target="_blank" rel="noopener noreferrer" {...rest} />;
  }
  return <RouterLink to={url} ref={ref} {...rest} />;
});
PolarisLink.displayName = 'PolarisLink';
PolarisLink.propTypes = {
  url: PropTypes.string,
  external: PropTypes.bool
};

/**
 * Main App Component
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider i18n={enTranslations} linkComponent={PolarisLink}>
        <AuthProvider>
          <Routes>
            {/* OAuth callback route (no navigation frame, no auth required) */}
            <Route path="/oauth/callback" element={<OAuthCallback />} />

            {/* All other routes require auth */}
            <Route path="*" element={<ProtectedApp />} />
          </Routes>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  );
}

function ProtectedApp() {
  const {isAuthenticated, loading} = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh'
        }}
      >
        <Spinner size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <AppFrame />;
}

function AppFrame() {
  const location = useLocation();
  const {logout} = useAuth();

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {label: 'Dashboard', icon: HomeIcon, url: '/', exactMatch: true},
          {label: 'Stores', icon: StoreIcon, url: '/stores'},
          {label: 'Google Sheets', icon: NoteIcon, url: '/sheets'},
          {label: 'Products', icon: ProductIcon, url: '/products'},
          {label: 'Orders', icon: OrderIcon, url: '/orders'},
          {label: 'Tracking', icon: DeliveryIcon, url: '/tracking'},
          {label: 'Analytics', icon: ChartVerticalFilledIcon, url: '/analytics'}
        ]}
      />
      <Navigation.Section items={[{label: 'Logout', icon: ExitIcon, onClick: logout}]} />
    </Navigation>
  );

  return (
    <Frame navigation={navigationMarkup}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/stores/oauth" element={<StoresOAuth />} />
        <Route path="/sheets" element={<Sheets />} />
        <Route path="/products" element={<Products />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Frame>
  );
}
