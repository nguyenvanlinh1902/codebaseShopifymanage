import React from 'react';
import PropTypes from 'prop-types';
import {Frame} from '@shopify/polaris';

export default function EmbeddedLayout({children}) {
  return <Frame>{children}</Frame>;
}

EmbeddedLayout.propTypes = {
  children: PropTypes.node.isRequired
};
