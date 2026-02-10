import React from 'react';
import PropTypes from 'prop-types';
import {NavMenu} from '@shopify/app-bridge-react';
import {Link, useLocation} from 'react-router-dom';

/**
 * AppBridgeProvider - Renders NavMenu for embedded app
 * NavMenu integrates with Shopify Admin navigation
 */
export default function AppBridgeProvider({children}) {
  const location = useLocation();

  return (
    <>
      <NavMenu>
        <Link to="/" rel="home">
          Dashboard
        </Link>
        <Link to="/products" className={location.pathname === '/products' ? 'active' : ''}>
          Products Import
        </Link>
        <Link to="/orders" className={location.pathname === '/orders' ? 'active' : ''}>
          Orders & Sheets
        </Link>
        <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>
          Settings
        </Link>
      </NavMenu>
      {children}
    </>
  );
}

AppBridgeProvider.propTypes = {
  children: PropTypes.node
};
