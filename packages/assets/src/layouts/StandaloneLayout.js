import React from 'react';
import PropTypes from 'prop-types';
import {Frame, Navigation} from '@shopify/polaris';
import {useLocation} from 'react-router-dom';
import {
  HomeIcon,
  StoreIcon,
  NoteIcon,
  ProductIcon,
  OrderIcon,
  DeliveryIcon,
  ChartVerticalFilledIcon,
  ThemeIcon,
  SettingsIcon,
  ExitIcon,
  PersonIcon
} from '@shopify/polaris-icons';
import {useAuth} from '../context/AuthContext';

StandaloneLayout.propTypes = {
  children: PropTypes.node.isRequired
};

const NAV_FEATURE_MAP = {
  '/stores': 'stores',
  '/sheets': 'sheets',
  '/products': 'products',
  '/orders': 'orders',
  '/tracking': 'tracking',
  '/analytics': 'analytics',
  '/themes': 'themes',
  '/setup': 'setup'
};

export default function StandaloneLayout({children}) {
  const location = useLocation();
  const {logout, user} = useAuth();
  const isAdmin = user?.role === 'admin';

  const allNavItems = [
    {label: 'Dashboard', icon: HomeIcon, url: '/', exactMatch: true},
    {label: 'Stores', icon: StoreIcon, url: '/stores'},
    {label: 'Google Sheets (Beta)', icon: NoteIcon, url: '/sheets'},
    {label: 'Products', icon: ProductIcon, url: '/products'},
    {label: 'Orders', icon: OrderIcon, url: '/orders'},
    {label: 'Tracking', icon: DeliveryIcon, url: '/tracking'},
    {label: 'Analytics', icon: ChartVerticalFilledIcon, url: '/analytics'},
    {label: 'Themes', icon: ThemeIcon, url: '/themes'},
    {label: 'Setup Store', icon: SettingsIcon, url: '/setup'}
  ];

  const filterNavItems = items => {
    if (isAdmin) return items;
    const allowed = user?.allowedFeatures; // null/undefined = all allowed; [] = only dashboard (no nav items)
    if (allowed === null || allowed === undefined) return items;
    return items.filter(item => {
      const feature = NAV_FEATURE_MAP[item.url];
      if (!feature) return true; // unmapped items always visible
      return allowed.includes(feature);
    });
  };

  const mainNavItems = [
    ...filterNavItems(allNavItems),
    ...(isAdmin ? [{label: 'Users', icon: PersonIcon, url: '/users'}] : [])
  ];

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section items={mainNavItems} />
      <Navigation.Section
        separator
        items={[
          {
            label: `Logout (${user?.displayName || user?.username || ''})`,
            icon: ExitIcon,
            onClick: logout
          }
        ]}
      />
    </Navigation>
  );

  return <Frame navigation={navigationMarkup}>{children}</Frame>;
}
