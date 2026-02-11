import React, {useState, useEffect, useRef} from 'react';
import PropTypes from 'prop-types';
import {Frame, Spinner} from '@shopify/polaris';
import AppBridgeProvider from '../components/AppBridgeProvider';
import {api} from '../helpers/api';

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

export default function EmbeddedLayout({children}) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    checkStore(0);
  }, []);

  async function checkStore(attempt) {
    try {
      const res = await api('/api/embed/store');
      const data = await res.json();

      if (data.success) {
        setReady(true);
        setLoading(false);
        return;
      }

      // Retry until max retries reached
      if (attempt < MAX_RETRIES) {
        console.warn(`[EmbeddedLayout] Store check failed (attempt ${attempt + 1}), retrying...`);
        setTimeout(() => checkStore(attempt + 1), RETRY_DELAY_MS);
      } else {
        console.error('[EmbeddedLayout] Store check failed after max retries');
        setLoading(false);
      }
    } catch (err) {
      // App Bridge not ready or network error → retry
      if (attempt < MAX_RETRIES) {
        console.warn(`[EmbeddedLayout] Error (attempt ${attempt + 1}):`, err.message);
        setTimeout(() => checkStore(attempt + 1), RETRY_DELAY_MS);
      } else {
        console.error('[EmbeddedLayout] Failed after max retries:', err.message);
        setLoading(false);
      }
    }
  }

  return (
    <AppBridgeProvider>
      <Frame>
        {ready ? (
          children
        ) : loading ? (
          <div style={{display: 'flex', justifyContent: 'center', padding: '80px 0'}}>
            <Spinner size="large" />
          </div>
        ) : null}
      </Frame>
    </AppBridgeProvider>
  );
}

EmbeddedLayout.propTypes = {
  children: PropTypes.node.isRequired
};
