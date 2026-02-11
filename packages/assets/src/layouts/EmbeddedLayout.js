import React, {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {Frame} from '@shopify/polaris';
import AppBridgeProvider from '../components/AppBridgeProvider';
import {api} from '../helpers/api';

export default function EmbeddedLayout({children}) {
  const [ready, setReady] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    api('/api/embed/store')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setReady(true);
        } else {
          redirectToInstall();
        }
      })
      .catch(() => {
        redirectToInstall();
      });
  }, []);

  function redirectToInstall() {
    const shop = new URLSearchParams(window.location.search).get('shop');
    if (shop) {
      window.open(`/api/auth/shopify?shop=${encodeURIComponent(shop)}`, '_top');
    }
  }

  return (
    <AppBridgeProvider>
      <Frame>{ready ? children : null}</Frame>
    </AppBridgeProvider>
  );
}

EmbeddedLayout.propTypes = {
  children: PropTypes.node.isRequired
};
