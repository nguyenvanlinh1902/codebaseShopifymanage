import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, InlineStack} from '@shopify/polaris';
import {StoreIcon, NoteIcon, OrderIcon, ProductIcon, DeliveryIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
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
  const [data, setData] = useState(null);
  const [openGuide, setOpenGuide] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/dashboard/stats?userId=default-user');
      const json = await res.json();
      if (json.success) setData(json.data);
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

  const overview = data?.overview || {};
  const stores = data?.stores || [];
  const productImports = data?.productImports || {};
  const trackingImports = data?.trackingImports || {};

  // Extract sync configs from store details for OrdersGuideContent
  const syncConfigs = stores
    .filter(s => s.syncConfig)
    .map(s => ({
      id: s.id,
      storeName: s.name,
      status: s.syncConfig.status,
      sheetName: s.syncConfig.sheetName,
      targetSheet: s.syncConfig.targetSheet,
      totalOrdersSynced: s.syncConfig.totalOrdersSynced,
      lastSyncAt: s.syncConfig.lastSyncAt
    }));

  // Compute setup progress for all 5 steps
  const hasStores = (overview.totalStores || 0) > 0;
  const hasSheets = (overview.totalSheets || 0) > 0;
  const hasOrderSync = (overview.activeSyncConfigs || 0) > 0;
  const hasProductImports = (productImports.completed || 0) > 0;
  const hasTrackingImports = (trackingImports.completed || 0) > 0;

  const steps = [hasStores, hasSheets, hasOrderSync, hasProductImports, hasTrackingImports];
  const completedSteps = steps.filter(Boolean).length;
  const totalSteps = 5;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  return (
    <Page title="Dashboard" subtitle="Shopify - Google Sheets Integration">
      <Layout>
        {/* Overview Stats */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <StatCard
              title="Connected Stores"
              value={overview.totalStores || 0}
              icon={StoreIcon}
              color="#5c6ac4"
              done={hasStores}
              loading={loading}
            />
            <StatCard
              title="Google Sheets"
              value={overview.totalSheets || 0}
              icon={NoteIcon}
              color="#00a0ac"
              done={hasSheets}
              loading={loading}
            />
            <StatCard
              title="Order Sync"
              value={overview.activeSyncConfigs || 0}
              icon={OrderIcon}
              color="#9c6ade"
              done={hasOrderSync}
              label="active configs"
              loading={loading}
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
            description="Stores are auto-created when you install the app. Manage them on the Stores page."
            icon={StoreIcon}
            color="#5c6ac4"
            done={hasStores}
            doneText={`${overview.totalStores || 0} store(s) connected`}
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
            doneText={`${overview.totalSheets || 0} sheet(s) connected`}
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
            doneText={`${overview.activeSyncConfigs || 0} active sync config(s)`}
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
            done={hasProductImports}
            doneText={`${productImports.totalProducts || 0} products imported`}
            pendingText="No imports yet"
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
            done={hasTrackingImports}
            doneText={`${trackingImports.totalUpdated || 0} orders updated`}
            pendingText="No tracking updates yet"
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
