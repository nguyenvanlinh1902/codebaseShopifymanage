import React, {useState, useEffect} from 'react';
import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  SkeletonBodyText,
  EmptyState
} from '@shopify/polaris';

/**
 * Dashboard Page
 */
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    stores: 0,
    sheets: 0,
    recentJobs: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // TODO: Replace with real user ID from auth
      const userId = 'demo-user';

      // Fetch stores and sheets
      const [storesRes, sheetsRes] = await Promise.all([
        fetch(`/api/stores?userId=${userId}`),
        fetch(`/api/sheets?userId=${userId}`)
      ]);

      const storesData = await storesRes.json();
      const sheetsData = await sheetsRes.json();

      setStats({
        stores: storesData.data?.length || 0,
        sheets: sheetsData.data?.length || 0,
        recentJobs: []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <Card>
              <SkeletonBodyText lines={5} />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Shopify - Google Sheets Integration"
      subtitle="Manage your products, orders, and tracking across multiple stores"
    >
      <Layout>
        <Layout.Section>
          <Banner title="Welcome!" tone="info">
            <p>
              Connect your Shopify stores and Google Sheets to automate product imports,
              order syncing, and tracking updates.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section oneHalf>
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Connected Stores
            </Text>
            <div style={{marginTop: '16px'}}>
              <Text variant="heading2xl" as="h3">
                {stats.stores}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Shopify stores connected
              </Text>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section oneHalf>
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Connected Sheets
            </Text>
            <div style={{marginTop: '16px'}}>
              <Text variant="heading2xl" as="h3">
                {stats.sheets}
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Google Sheets connected
              </Text>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Quick Start Guide
            </Text>
            <div style={{marginTop: '16px'}}>
              <ol style={{marginLeft: '20px'}}>
                <li style={{marginBottom: '8px'}}>
                  <strong>Connect Stores:</strong> Add your Shopify stores with API credentials
                </li>
                <li style={{marginBottom: '8px'}}>
                  <strong>Connect Sheets:</strong> Authorize Google Sheets and link your spreadsheets
                </li>
                <li style={{marginBottom: '8px'}}>
                  <strong>Import Products:</strong> Import products from Google Sheets to Shopify
                </li>
                <li style={{marginBottom: '8px'}}>
                  <strong>Sync Orders:</strong> Export orders from Shopify to Google Sheets
                </li>
                <li style={{marginBottom: '8px'}}>
                  <strong>Update Tracking:</strong> Update fulfillment tracking from Google Sheets
                </li>
              </ol>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
