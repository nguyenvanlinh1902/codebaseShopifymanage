import React from 'react';
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
      </NavMenu>
      <Frame>
        {children}
      </Frame>
    </>
  );
}
