import React from 'react';
import PropTypes from 'prop-types';
import {NavMenu} from '@shopify/app-bridge-react';
import {NavLink, useLocation} from 'react-router-dom';

/**
 * AppBridgeProvider - Renders NavMenu for embedded app
 * NavMenu integrates with Shopify Admin navigation
 */
export default function AppBridgeProvider({children}) {
  const location = useLocation();

  return (
    <>
      <NavMenu>
        <NavLink to="/" rel="home">
          Dashboard
        </NavLink>
        <NavLink to="/products" isActive={() => location.pathname === '/products'}>
          Products Import
        </NavLink>
        <NavLink to="/orders" isActive={() => location.pathname === '/orders'}>
          Orders & Sheets
        </NavLink>
        <NavLink to="/settings" isActive={() => location.pathname === '/settings'}>
          Settings
        </NavLink>
      </NavMenu>
      {children}
    </>
  );
}

AppBridgeProvider.propTypes = {
  children: PropTypes.node
};
