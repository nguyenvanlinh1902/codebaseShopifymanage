import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, InlineStack} from '@shopify/polaris';
import {
  StoreIcon,
  NoteIcon,
  OrderIcon,
  ProductIcon,
  DeliveryIcon
} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import DashboardLoadingSkeleton from './dashboard/DashboardLoadingSkeleton';
import StatCard from './dashboard/StatCard';
import SetupProgressCard from './dashboard/SetupProgressCard';
import GuideCard from './dashboard/GuideCard';
import StoresGuideContent from './dashboard/StoresGuideContent';
import SheetsGuideContent from './dashboard/SheetsGuideContent';
import OrdersGuideContent from './dashboard/OrdersGuideContent';
import ProductsGuideContent from './dashboard/ProductsGuideContent';
import TrackingGuideContent from './dashboard/TrackingGuideContent';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [syncConfigs, setSyncConfigs] = useState([]);
  const [openGuide, setOpenGuide] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [storesRes, sheetsRes] = await Promise.all([api('/api/stores'), api('/api/sheets')]);
      const [storesData, sheetsData] = await Promise.all([storesRes.json(), sheetsRes.json()]);

      const storeList = storesData.data || [];
      setStores(storeList);
      setSheets(sheetsData.data || []);

      // Fetch sync configs for all stores
      if (storeList.length > 0) {
        try {
          const configRes = await api('/api/orders/sync-configs');
          const configData = await configRes.json();
          if (configData.success) setSyncConfigs(configData.data || []);
        } catch (e) {
          // ignore
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleGuide = id => {
    setOpenGuide(prev => (prev === id ? null : id));
  };

  // Compute setup progress
  const hasStores = stores.length > 0;
  const hasSheets = sheets.length > 0;
  const hasOrderSync = syncConfigs.some(c => c.status === 'active');
  const steps = [hasStores, hasSheets, hasOrderSync];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = 5; // stores, sheets, orders, products, tracking
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  if (loading) {
    return <DashboardLoadingSkeleton />;
  }

  return (
    <Page title="Dashboard" subtitle="Shopify - Google Sheets Integration">
      <Layout>
        {/* Overview Stats */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <StatCard
              title="Connected Stores"
              value={stores.length}
              icon={StoreIcon}
              color="#5c6ac4"
              done={hasStores}
            />
            <StatCard
              title="Google Sheets"
              value={sheets.length}
              icon={NoteIcon}
              color="#00a0ac"
              done={hasSheets}
            />
            <StatCard
              title="Order Sync"
              value={syncConfigs.filter(c => c.status === 'active').length}
              icon={OrderIcon}
              color="#9c6ade"
              done={hasOrderSync}
              label="active configs"
            />
          </InlineStack>
        </Layout.Section>

        {/* Setup Progress */}
        <Layout.Section>
          <SetupProgressCard
            completedSteps={completedSteps}
            totalSteps={totalSteps}
            progressPct={progressPct}
          />
        </Layout.Section>

        {/* Step 1: Connect Stores */}
        <Layout.Section>
          <GuideCard
            step={1}
            title="Connect Shopify Stores"
            description="Add your Shopify stores with API credentials to manage products, orders and tracking."
            icon={StoreIcon}
            color="#5c6ac4"
            done={hasStores}
            doneText={`${stores.length} store(s) connected`}
            pendingText="No stores connected"
            open={openGuide === 'stores'}
            onToggle={() => toggleGuide('stores')}
            actionLabel="Go to Stores"
            actionUrl="/stores"
          >
            <StoresGuideContent stores={stores} hasStores={hasStores} />
          </GuideCard>
        </Layout.Section>

        {/* Step 2: Google Sheets */}
        <Layout.Section>
          <GuideCard
            step={2}
            title="Connect Google Sheets"
            description="Authorize your Google account and link spreadsheets for data sync."
            icon={NoteIcon}
            color="#00a0ac"
            done={hasSheets}
            doneText={`${sheets.length} sheet(s) connected`}
            pendingText="No sheets connected"
            open={openGuide === 'sheets'}
            onToggle={() => toggleGuide('sheets')}
            actionLabel="Go to Sheets"
            actionUrl="/sheets"
          >
            <SheetsGuideContent />
          </GuideCard>
        </Layout.Section>

        {/* Step 3: Order Sync */}
        <Layout.Section>
          <GuideCard
            step={3}
            title="Setup Order Sync"
            description="Export orders from Shopify to Google Sheets automatically via webhooks, or trigger manual sync."
            icon={OrderIcon}
            color="#9c6ade"
            done={hasOrderSync}
            doneText={`${
              syncConfigs.filter(c => c.status === 'active').length
            } active sync config(s)`}
            pendingText="Not configured"
            open={openGuide === 'orders'}
            onToggle={() => toggleGuide('orders')}
            actionLabel="Go to Orders"
            actionUrl="/orders"
          >
            <OrdersGuideContent syncConfigs={syncConfigs} />
          </GuideCard>
        </Layout.Section>

        {/* Step 4: Product Import */}
        <Layout.Section>
          <GuideCard
            step={4}
            title="Import Products"
            description="Import products from CSV files into your Shopify stores via an async queue."
            icon={ProductIcon}
            color="#47c1bf"
            done={null}
            pendingText="Go to Products to start importing"
            open={openGuide === 'products'}
            onToggle={() => toggleGuide('products')}
            actionLabel="Go to Products"
            actionUrl="/products"
          >
            <ProductsGuideContent />
          </GuideCard>
        </Layout.Section>

        {/* Step 5: Tracking */}
        <Layout.Section>
          <GuideCard
            step={5}
            title="Update Tracking"
            description="Upload Excel files with tracking numbers to update fulfillment info on Shopify orders."
            icon={DeliveryIcon}
            color="#f49342"
            done={null}
            pendingText="Go to Tracking to start updating"
            open={openGuide === 'tracking'}
            onToggle={() => toggleGuide('tracking')}
            actionLabel="Go to Tracking"
            actionUrl="/tracking"
          >
            <TrackingGuideContent />
          </GuideCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
