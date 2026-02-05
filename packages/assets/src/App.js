import React from 'react';
import {BrowserRouter, Routes, Route, useNavigate} from 'react-router-dom';
import {AppProvider, Frame, Navigation} from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import enTranslations from '@shopify/polaris/locales/en.json';
import {
  HomeIcon,
  StoreIcon,
  NoteIcon,
  ProductIcon,
  OrderIcon,
  DeliveryIcon
} from '@shopify/polaris-icons';

// Import loadables (code-split pages)
import Dashboard from './loadables/Dashboard';
import Stores from './loadables/Stores';
import Sheets from './loadables/Sheets';
import Products from './loadables/Products';
import Orders from './loadables/Orders';
import Tracking from './loadables/Tracking';
import NotFound from './loadables/NotFound';

/**
 * Main App Component
 */
export default function App() {
  return (
    <AppProvider i18n={enTranslations}>
      <BrowserRouter>
        <AppFrame />
      </BrowserRouter>
    </AppProvider>
  );
}

function AppFrame() {
  const navigate = useNavigate();

  const navigationMarkup = (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            label: 'Dashboard',
            icon: HomeIcon,
            onClick: () => navigate('/')
          },
          {
            label: 'Stores',
            icon: StoreIcon,
            onClick: () => navigate('/stores')
          },
          {
            label: 'Google Sheets',
            icon: NoteIcon,
            onClick: () => navigate('/sheets')
          },
          {
            label: 'Products',
            icon: ProductIcon,
            onClick: () => navigate('/products')
          },
          {
            label: 'Orders',
            icon: OrderIcon,
            onClick: () => navigate('/orders')
          },
          {
            label: 'Tracking',
            icon: DeliveryIcon,
            onClick: () => navigate('/tracking')
          }
        ]}
      />
    </Navigation>
  );

  return (
    <Frame navigation={navigationMarkup}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/sheets" element={<Sheets />} />
        <Route path="/products" element={<Products />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Frame>
  );
}
