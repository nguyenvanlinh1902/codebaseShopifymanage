import React from 'react';
import PropTypes from 'prop-types';
import {Frame} from '@shopify/polaris';
import {NavMenu} from '@shopify/app-bridge-react';
import {NavLink} from 'react-router-dom';

export default function EmbeddedLayout({children}) {
  return (
    <>
      <NavMenu>
        <NavLink to="/" rel="home">Dashboard</NavLink>
        <NavLink to="/products">Products Import</NavLink>
        <NavLink to="/orders">Orders & Sheets</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </NavMenu>
      <Frame>
        {children}
      </Frame>
    </>
  );
}

EmbeddedLayout.propTypes = {
  children: PropTypes.node.isRequired
};
