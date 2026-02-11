import React, {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {Frame, Page, Layout, Card, Spinner, Text, BlockStack} from '@shopify/polaris';
import AppBridgeProvider from '../components/AppBridgeProvider';
import {api} from '../helpers/api';

export default function EmbeddedLayout({children}) {
  const [storeStatus, setStoreStatus] = useState('loading');
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    api('/api/embed/store')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStoreStatus('ready');
        } else {
          setStoreStatus('not_found');
          triggerInstall();
        }
      })
      .catch(() => {
        setStoreStatus('not_found');
        triggerInstall();
      });
  }, []);

  function triggerInstall() {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop') || '';
    if (shop) {
      const installUrl = `/api/auth/shopify?shop=${encodeURIComponent(shop)}`;
      window.open(installUrl, '_top');
    }
  }

  if (storeStatus === 'loading') {
    return (
      <AppBridgeProvider>
        <Frame>
          <Page>
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400" inlineAlign="center">
                    <Spinner size="large" />
                    <Text as="p">Connecting to store...</Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </Page>
        </Frame>
      </AppBridgeProvider>
    );
  }

  if (storeStatus === 'not_found') {
    return (
      <AppBridgeProvider>
        <Frame>
          <Page>
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400" inlineAlign="center">
                    <Spinner size="large" />
                    <Text as="p">Setting up your store... Redirecting to authorization.</Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </Page>
        </Frame>
      </AppBridgeProvider>
    );
  }

  return (
    <AppBridgeProvider>
      <Frame>{children}</Frame>
    </AppBridgeProvider>
  );
}

EmbeddedLayout.propTypes = {
  children: PropTypes.node.isRequired
};
