import React from 'react';
import PropTypes from 'prop-types';
import {Frame} from '@shopify/polaris';
import AppBridgeProvider from '../components/AppBridgeProvider';

export default function EmbeddedLayout({children}) {
  return (
    <AppBridgeProvider>
      <Frame>{children}</Frame>
    </AppBridgeProvider>
  );
}

EmbeddedLayout.propTypes = {
  children: PropTypes.node.isRequired
};
