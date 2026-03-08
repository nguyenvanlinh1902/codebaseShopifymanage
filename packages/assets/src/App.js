import React, {forwardRef, useEffect} from 'react';
import PropTypes from 'prop-types';
import {BrowserRouter, Routes, Route, Link as RouterLink} from 'react-router-dom';
import {AppProvider} from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';

import {isEmbeddedApp, routePrefix, initAppBridge} from './config/app';

// Layouts
import EmbeddedLayout from './layouts/EmbeddedLayout';
import StandaloneLayout from './layouts/StandaloneLayout';

// Context (standalone only)
import {AuthProvider, useAuth} from './context/AuthContext';

// Pages - Embedded
import EmbedDashboard from './pages/EmbedDashboard';
import EmbedProducts from './pages/EmbedProducts';
import EmbedOrders from './pages/EmbedOrders';
import EmbedStoreSettings from './pages/embed/EmbedStoreSettings';

// Pages - Standalone
import Dashboard from './pages/Dashboard';
import OAuthCallback from './pages/OAuthCallback';
import Sheets from './pages/Sheets';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Tracking from './pages/Tracking';
import Analytics from './pages/Analytics';
import Themes from './pages/Themes';
import SetupStore from './pages/SetupStore';
import Stores from './pages/Stores';
import Users from './pages/Users';
import NotFound from './pages/NotFound';
import LoginPage from './pages/LoginPage';
import SetupAdminPage from './pages/SetupAdminPage';

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
  const [appBridgeReady, setAppBridgeReady] = React.useState(!isEmbeddedApp);

  // Initialize App Bridge for embedded app
  useEffect(() => {
    if (isEmbeddedApp) {
      initAppBridge()
        .then(() => setAppBridgeReady(true))
        .catch(() => setAppBridgeReady(true));
    }
  }, []);

  // Wait for App Bridge to be ready before rendering embedded routes
  if (isEmbeddedApp && !appBridgeReady) {
    return null; // Or a loading spinner
  }

  return (
    <BrowserRouter basename={routePrefix}>
      <AppProvider i18n={enTranslations} linkComponent={isEmbeddedApp ? undefined : PolarisLink}>
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
        <Route path="/settings" element={<EmbedStoreSettings />} />
        <Route path="*" element={<EmbedDashboard />} />
      </Routes>
    </EmbeddedLayout>
  );
}

function StandaloneRoutes() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const {isAuthenticated, syncing} = useAuth();

  return (
    <Routes>
      {/* OAuth callback must be accessible without login */}
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      {/* First-time setup — accessible without login, disabled after first user exists */}
      <Route path="/setup-admin" element={<SetupAdminPage />} />
      <Route
        path="*"
        element={
          isAuthenticated
            ? syncing
              ? null /* wait for /me sync before rendering — prevents stale-permission flash */
              : <StandaloneFrame />
            : <LoginPage />
        }
      />
    </Routes>
  );
}

/**
 * FeatureGuard — redirects to / if user lacks the required feature slug.
 * Admin always passes. null/undefined allowedFeatures = all features allowed (backward compat).
 */
function FeatureGuard({feature, children}) {
  const {user} = useAuth();
  if (user?.role === 'admin') return children;
  const allowed = user?.allowedFeatures;
  if (allowed === null || allowed === undefined) return children; // null/undefined = all allowed; [] = only dashboard
  if (!allowed.includes(feature)) return <NotFound />;
  return children;
}
FeatureGuard.propTypes = {feature: PropTypes.string.isRequired, children: PropTypes.node.isRequired};

function StandaloneFrame() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <StandaloneLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stores" element={<FeatureGuard feature="stores"><Stores /></FeatureGuard>} />
        <Route path="/sheets" element={<FeatureGuard feature="sheets"><Sheets /></FeatureGuard>} />
        <Route path="/products" element={<FeatureGuard feature="products"><Products /></FeatureGuard>} />
        <Route path="/orders" element={<FeatureGuard feature="orders"><Orders /></FeatureGuard>} />
        <Route path="/tracking" element={<FeatureGuard feature="tracking"><Tracking /></FeatureGuard>} />
        <Route path="/themes" element={<FeatureGuard feature="themes"><Themes /></FeatureGuard>} />
        <Route path="/analytics" element={<FeatureGuard feature="analytics"><Analytics /></FeatureGuard>} />
        <Route path="/setup" element={<FeatureGuard feature="setup"><SetupStore /></FeatureGuard>} />
        <Route path="/users" element={isAdmin ? <Users /> : <NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StandaloneLayout>
  );
}
