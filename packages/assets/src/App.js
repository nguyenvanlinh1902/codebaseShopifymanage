import React, {forwardRef} from 'react';
import PropTypes from 'prop-types';
import {BrowserRouter, Routes, Route, Link as RouterLink} from 'react-router-dom';
import {AppProvider} from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';

import {isEmbeddedApp, routePrefix} from './config/app';

// Layouts
import EmbeddedLayout from './layouts/EmbeddedLayout';
import StandaloneLayout from './layouts/StandaloneLayout';

// Context (standalone only)
import {AuthProvider} from './context/AuthContext';

// Pages - Embedded
import EmbedDashboard from './pages/EmbedDashboard';
import EmbedProducts from './pages/EmbedProducts';
import EmbedOrders from './pages/EmbedOrders';

// Pages - Standalone
import Dashboard from './pages/Dashboard';
import Stores from './pages/Stores';
import StoresOAuth from './pages/StoresOAuth';
import OAuthCallback from './pages/OAuthCallback';
import Sheets from './pages/Sheets';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Tracking from './pages/Tracking';
import Analytics from './pages/Analytics';
import Themes from './pages/Themes';
import SetupStore from './pages/SetupStore';
import NotFound from './pages/NotFound';

// Polaris link component for standalone (React Router integration)
const PolarisLink = forwardRef(({url, external, ...rest}, ref) => {
  if (external) {
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
 * Main App - single component, conditional layout based on embedded/standalone mode.
 * Following shopable pattern: same App.js, different layouts.
 */
export default function App() {
  return (
    <BrowserRouter basename={routePrefix}>
      <AppProvider
        i18n={enTranslations}
        linkComponent={isEmbeddedApp ? undefined : PolarisLink}
      >
        {isEmbeddedApp ? <EmbeddedRoutes /> : <StandaloneRoutes />}
      </AppProvider>
    </BrowserRouter>
  );
}

function EmbeddedRoutes() {
  return (
    <EmbeddedLayout>
      <Routes>
        <Route path="/" element={<EmbedDashboard />} />
        <Route path="/products" element={<EmbedProducts />} />
        <Route path="/orders" element={<EmbedOrders />} />
        <Route path="*" element={<EmbedDashboard />} />
      </Routes>
    </EmbeddedLayout>
  );
}

function StandaloneRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="*" element={<StandaloneFrame />} />
      </Routes>
    </AuthProvider>
  );
}

function StandaloneFrame() {
  return (
    <StandaloneLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/stores/oauth" element={<StoresOAuth />} />
        <Route path="/sheets" element={<Sheets />} />
        <Route path="/products" element={<Products />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/themes" element={<Themes />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/setup" element={<SetupStore />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StandaloneLayout>
  );
}
