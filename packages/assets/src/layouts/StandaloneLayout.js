import React, {useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import {Frame, Navigation, TopBar} from '@shopify/polaris';
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
  PersonIcon,
  CodeIcon,
  CashDollarIcon,
  TargetIcon,
  SearchIcon,
  AlertDiamondIcon
} from '@shopify/polaris-icons';
import {useAuth} from '../context/AuthContext';
import TimezonePicker from '../components/timezone-picker';
import {api} from '../helpers/api';

StandaloneLayout.propTypes = {
  children: PropTypes.node.isRequired
};

const NAV_FEATURE_MAP = {
  '/': 'dashboard',
  '/stores': 'stores',
  '/sheets': 'sheets',
  '/products': 'products',
  '/orders': 'orders',
  '/tracking': 'tracking',
  '/tracking-orders-check': 'tracking',
  '/tracking-api-keys': 'tracking',
  '/analytics': 'analytics',
  '/balance': 'finance',
  '/campaign-ads': 'finance',
  '/order-search': 'order-search',
  '/draft-orders': 'draft-orders',
  '/customer-search': 'customer-search',
  '/customer-search/': 'customer-search',
  '/disputes': 'dispute',
  '/shipping-management': 'shipping',
  '/themes': 'themes',
  '/my-email': 'my-email',
  '/setup': 'setup',
  '/policies': 'policies',
  '/custom-fields': 'custom-fields',
  '/collections': 'products'
};

export default function StandaloneLayout({children}) {
  const location = useLocation();
  const {logout, user, updateUser} = useAuth();
  const isAdmin = user?.role === 'admin';
  const [userMenuActive, setUserMenuActive] = useState(false);

  const toggleUserMenu = useCallback(() => setUserMenuActive(v => !v), []);

  const handleTimezoneChange = useCallback(
    async tz => {
      updateUser({timezone: tz});
      try {
        await api('/api/users/me/preferences', {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({timezone: tz})
        });
      } catch {
        /* silent — already saved locally */
      }
    },
    [updateUser]
  );

  const allNavItems = [
    {label: 'Dashboard', icon: HomeIcon, url: '/', exactMatch: true},
    {label: 'Stores', icon: StoreIcon, url: '/stores'},
    {label: 'Google Sheets (Beta)', icon: NoteIcon, url: '/sheets'},
    {
      label: 'Products',
      icon: ProductIcon,
      url: '/products',
      subNavigationItems: [
        {label: 'All Products', url: '/products'},
        {label: 'Collections', url: '/collections'}
      ]
    },
    {label: 'Orders', icon: OrderIcon, url: '/orders'},
    {label: 'Order Search', icon: SearchIcon, url: '/order-search'},
    {label: 'Draft Orders', icon: OrderIcon, url: '/draft-orders'},
    {label: 'Customer Search', icon: SearchIcon, url: '/customer-search'},
    {
      label: 'Tracking',
      icon: DeliveryIcon,
      url: '/tracking',
      subNavigationItems: [
        {label: 'Dashboard', url: '/tracking'},
        {label: 'Orders Check', url: '/tracking-orders-check'},
        {label: 'API Keys', url: '/tracking-api-keys'}
      ]
    },
    {label: 'Analytics', icon: ChartVerticalFilledIcon, url: '/analytics'},
    {label: 'Balance', icon: CashDollarIcon, url: '/balance'},
    {label: 'Campaign Ads', icon: TargetIcon, url: '/campaign-ads'},
    {label: 'Disputes', icon: AlertDiamondIcon, url: '/disputes'},
    {label: 'Shipping', icon: DeliveryIcon, url: '/shipping-management'},
    {label: 'Themes', icon: ThemeIcon, url: '/themes'},
    {label: 'Setup Store', icon: SettingsIcon, url: '/setup'},
    {label: 'Policies', icon: NoteIcon, url: '/policies'},
    {label: 'Setup Product Custom Name', icon: SettingsIcon, url: '/custom-fields'},
    {label: 'My Email', icon: NoteIcon, url: '/my-email'}
  ];

  const filterNavItems = items => {
    if (isAdmin) return items;
    const allowed = user?.allowedFeatures;
    if (allowed === null || allowed === undefined) return items;
    return items.filter(item => {
      const feature = NAV_FEATURE_MAP[item.url];
      if (!feature) return true;
      return allowed.includes(feature);
    });
  };

  const mainNavItems = [
    ...filterNavItems(allNavItems),
    ...(isAdmin
      ? [
          {label: 'Users', icon: PersonIcon, url: '/users'},
          {
            label: 'Email Management',
            icon: NoteIcon,
            url: '/emails',
            subNavigationItems: [
              {label: 'Accounts', url: '/email-accounts'},
              {label: 'Emails', url: '/emails'},
              {label: 'Discord Settings', url: '/discord-settings'}
            ]
          }
        ]
      : [])
  ];

  const devNavItems = isAdmin
    ? [
        {label: 'Webhook Checker', icon: CodeIcon, url: '/dev/webhooks'},
        {label: 'Test Import', icon: ProductIcon, url: '/dev/test-import'},
        {label: 'Setup Guide', icon: SettingsIcon, url: '/dev/guide'}
      ]
    : [];

  const userMenuMarkup = (
    <TopBar.UserMenu
      actions={[{items: [{content: 'Logout', onAction: logout, icon: ExitIcon}]}]}
      name={user?.displayName || user?.username || ''}
      initials={(user?.displayName || user?.username || '?')[0].toUpperCase()}
      open={userMenuActive}
      onToggle={toggleUserMenu}
    />
  );

  const searchFieldMarkup = (
    <TimezonePicker timezone={user?.timezone || ''} onChange={handleTimezoneChange} />
  );

  const topBarMarkup = (
    <TopBar showNavigationToggle userMenu={userMenuMarkup} searchField={searchFieldMarkup} />
  );

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section items={mainNavItems} />
      {devNavItems.length > 0 && (
        <Navigation.Section title="Dev Tools" separator items={devNavItems} />
      )}
    </Navigation>
  );

  return (
    <Frame topBar={topBarMarkup} navigation={navigationMarkup}>
      {children}
    </Frame>
  );
}
