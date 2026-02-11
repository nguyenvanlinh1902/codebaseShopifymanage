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
  ExitIcon
} from '@shopify/polaris-icons';
import {useAuth} from '../context/AuthContext';

StandaloneLayout.propTypes = {
  children: PropTypes.node.isRequired
};

export default function StandaloneLayout({children}) {
  const location = useLocation();
  const {logout} = useAuth();

  const navigationMarkup = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {label: 'Dashboard', icon: HomeIcon, url: '/', exactMatch: true},
          {label: 'Stores', icon: StoreIcon, url: '/stores'},
          {label: 'Google Sheets (Beta)', icon: NoteIcon, url: '/sheets'},
          {label: 'Products', icon: ProductIcon, url: '/products'},
          {label: 'Orders', icon: OrderIcon, url: '/orders'},
          {label: 'Tracking', icon: DeliveryIcon, url: '/tracking'},
          {label: 'Analytics', icon: ChartVerticalFilledIcon, url: '/analytics'},
          {label: 'Themes', icon: ThemeIcon, url: '/themes'},
          {label: 'Setup Store', icon: SettingsIcon, url: '/setup'}
        ]}
      />
      <Navigation.Section
        separator
        items={[{label: 'Logout', icon: ExitIcon, onClick: logout}]}
      />
    </Navigation>
  );

  return <Frame navigation={navigationMarkup}>{children}</Frame>;
}
