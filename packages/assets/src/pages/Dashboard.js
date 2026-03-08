import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, InlineStack, Card, Text, Badge, BlockStack} from '@shopify/polaris';
import {StoreIcon, NoteIcon, OrderIcon, ProductIcon, DeliveryIcon, AppsIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import StatCard from './dashboard/StatCard';
import SetupProgressCard from './dashboard/SetupProgressCard';
import GuideCard from './dashboard/GuideCard';
import StoresGuideContent from './dashboard/StoresGuideContent';
import SheetsGuideContent from './dashboard/SheetsGuideContent';
import OrdersGuideContent from './dashboard/OrdersGuideContent';
import ProductsGuideContent from './dashboard/ProductsGuideContent';
import TrackingGuideContent from './dashboard/TrackingGuideContent';
import MultiAppGuideContent from './dashboard/MultiAppGuideContent';

export default function Dashboard() {
  const {user} = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [openGuide, setOpenGuide] = useState(null);

  const canAccess = feature => {
    if (!user || user.role === 'admin') return true;
    if (!user.allowedFeatures) return true;
    if (user.allowedFeatures.length === 0) return false;
    return user.allowedFeatures.includes(feature);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/dashboard/stats');
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
  const productImports = data?.productImports || {};
  const trackingImports = data?.trackingImports || {};

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

  const roleBadgeTone = user?.role === 'admin' ? 'info' : user?.role === 'manager' ? 'attention' : 'new';

  // All guide cards — filtered by feature access, step numbers assigned dynamically
  const allGuides = [
    {
      id: 'stores', feature: 'stores', title: 'Connect Shopify Stores',
      description: 'Manage your connected Shopify stores.',
      icon: StoreIcon, color: '#5c6ac4', done: hasStores,
      doneText: `${overview.totalStores || 0} store(s) connected`, pendingText: 'No stores connected',
      actionLabel: 'Go to Stores', actionUrl: '/stores',
      children: <StoresGuideContent />
    },
    {
      id: 'multi-app', feature: 'stores', title: 'Install via Multi-App OAuth',
      description: 'Connect stores using your own Shopify Partner App credentials.',
      icon: AppsIcon, color: '#2c6ecb', done: hasStores,
      doneText: 'Stores connected via partner app', pendingText: 'No stores installed yet',
      actionLabel: 'Go to Stores', actionUrl: '/stores',
      children: <MultiAppGuideContent />
    },
    {
      id: 'sheets', feature: 'sheets', title: 'Connect Google Sheets',
      description: 'Authorize your Google account and link spreadsheets for data sync.',
      icon: NoteIcon, color: '#00a0ac', done: hasSheets,
      doneText: `${overview.totalSheets || 0} sheet(s) connected`, pendingText: 'No sheets connected',
      actionLabel: 'Go to Sheets', actionUrl: '/sheets',
      children: <SheetsGuideContent />
    },
    {
      id: 'orders', feature: 'orders', title: 'Setup Order Sync',
      description: 'Export orders from Shopify to Google Sheets automatically via webhooks.',
      icon: OrderIcon, color: '#9c6ade', done: hasOrderSync,
      doneText: `${overview.activeSyncConfigs || 0} active sync config(s)`, pendingText: 'Not configured',
      actionLabel: 'Go to Orders', actionUrl: '/orders',
      children: <OrdersGuideContent />
    },
    {
      id: 'products', feature: 'products', title: 'Import Products',
      description: 'Import products from CSV files into your Shopify stores.',
      icon: ProductIcon, color: '#47c1bf', done: hasProductImports,
      doneText: `${productImports.totalProducts || 0} products imported`, pendingText: 'No imports yet',
      actionLabel: 'Go to Products', actionUrl: '/products',
      children: <ProductsGuideContent />
    },
    {
      id: 'tracking', feature: 'tracking', title: 'Update Tracking',
      description: 'Upload Excel files with tracking numbers to update fulfillment on Shopify orders.',
      icon: DeliveryIcon, color: '#f49342', done: hasTrackingImports,
      doneText: `${trackingImports.totalUpdated || 0} orders updated`, pendingText: 'No tracking updates yet',
      actionLabel: 'Go to Tracking', actionUrl: '/tracking',
      children: <TrackingGuideContent />
    }
  ].filter(g => canAccess(g.feature));

  const visibleStats = [
    canAccess('stores') && {title: 'Connected Stores', value: overview.totalStores || 0, icon: StoreIcon, color: '#5c6ac4', done: hasStores},
    canAccess('sheets') && {title: 'Google Sheets', value: overview.totalSheets || 0, icon: NoteIcon, color: '#00a0ac', done: hasSheets},
    canAccess('orders') && {title: 'Order Sync', value: overview.activeSyncConfigs || 0, icon: OrderIcon, color: '#9c6ade', done: hasOrderSync, label: 'active configs'}
  ].filter(Boolean);

  return (
    <Page title="Dashboard" subtitle="Shopify - Google Sheets Integration">
      <Layout>
        {/* Greeting */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingMd">Welcome back, {user?.displayName || user?.username}!</Text>
                <Text variant="bodySm" tone="subdued">Here&apos;s your workspace overview</Text>
              </BlockStack>
              <Badge tone={roleBadgeTone}>{user?.role || 'staff'}</Badge>
            </InlineStack>
          </Card>
        </Layout.Section>

        {/* Overview Stats */}
        {visibleStats.length > 0 && (
          <Layout.Section>
            <InlineStack gap="400" wrap={false}>
              {visibleStats.map(s => (
                <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} color={s.color} done={s.done} label={s.label} loading={loading} />
              ))}
            </InlineStack>
          </Layout.Section>
        )}

        {/* Setup Progress (admin only) */}
        {user?.role === 'admin' && (
          <Layout.Section>
            <SetupProgressCard completedSteps={completedSteps} totalSteps={totalSteps} progressPct={progressPct} />
          </Layout.Section>
        )}

        {/* Guide cards — step numbers reflect only visible cards */}
        {allGuides.map((guide, idx) => (
          <Layout.Section key={guide.id}>
            <GuideCard
              step={idx + 1}
              title={guide.title}
              description={guide.description}
              icon={guide.icon}
              color={guide.color}
              done={guide.done}
              doneText={guide.doneText}
              pendingText={guide.pendingText}
              open={openGuide === guide.id}
              onToggle={() => toggleGuide(guide.id)}
              actionLabel={guide.actionLabel}
              actionUrl={guide.actionUrl}
            >
              {guide.children}
            </GuideCard>
          </Layout.Section>
        ))}
      </Layout>
    </Page>
  );
}
