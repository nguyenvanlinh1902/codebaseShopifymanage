import React, {useState, useEffect} from 'react';
import {BlockStack, Text, Banner, SkeletonBodyText, Badge, InlineStack, Link, Divider} from '@shopify/polaris';
import {api} from '../../helpers/api';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
}

/**
 * Alerts & Events Panel — fetches shop alerts + recent events from Shopify for all stores.
 */
export default function AnalyticsAlertsPanel() {
  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await api('/api/analytics/alerts');
      const result = await res.json();
      if (result.success) {
        setStoreData(result.data || []);
      } else {
        setError(result.error || 'Failed to load alerts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <SkeletonBodyText lines={4} />;
  if (error) return <Banner tone="critical">{error}</Banner>;

  const totalAlerts = storeData.reduce((sum, s) => sum + s.alerts.length, 0);
  const totalEvents = storeData.reduce((sum, s) => sum + (s.events?.length || 0), 0);

  return (
    <BlockStack gap="400">
      <InlineStack gap="200" blockAlign="center">
        <Text variant="headingMd">Store Alerts & Events</Text>
        {totalAlerts > 0 && <Badge tone="warning">{totalAlerts} alert{totalAlerts > 1 ? 's' : ''}</Badge>}
        {totalEvents > 0 && <Badge tone="info">{totalEvents} event{totalEvents > 1 ? 's' : ''}</Badge>}
        {totalAlerts === 0 && totalEvents === 0 && <Badge tone="success">All clear</Badge>}
      </InlineStack>

      {storeData.map((store, idx) => {
        const alertCount = store.alerts.length;
        const eventCount = store.events?.length || 0;
        const total = alertCount + eventCount;

        return (
          <BlockStack key={store.storeId} gap="200">
            {idx > 0 && <Divider />}
            <InlineStack gap="200" blockAlign="center">
              <Text variant="headingSm">{store.name || store.shopDomain}</Text>
              {total > 0 ? (
                <Badge tone={alertCount > 0 ? 'warning' : 'info'}>{total}</Badge>
              ) : (
                <Badge tone="success">OK</Badge>
              )}
            </InlineStack>

            {/* Shop-level alerts */}
            {store.alerts.map((alert, i) => (
              <Banner key={`alert-${i}`} tone="warning">
                <p>{alert.description}</p>
                {alert.action && (
                  <Link url={alert.action.url} external>{alert.action.title}</Link>
                )}
              </Banner>
            ))}

            {/* Recent events */}
            {store.events?.map((evt, i) => (
              <Banner key={`evt-${i}`} tone={evt.critical ? 'critical' : 'info'}>
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Badge tone={evt.critical ? 'critical' : undefined}>{evt.action}</Badge>
                  <Text variant="bodySm">{evt.message}</Text>
                  <Text variant="bodySm" tone="subdued">{formatDate(evt.createdAt)}</Text>
                </InlineStack>
              </Banner>
            ))}

            {total === 0 && <Text tone="subdued" variant="bodySm">No alerts or events</Text>}
          </BlockStack>
        );
      })}
    </BlockStack>
  );
}
