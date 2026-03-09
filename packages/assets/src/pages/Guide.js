import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, SkeletonBodyText} from '@shopify/polaris';
import {StoreIcon, NoteIcon, OrderIcon, ProductIcon, DeliveryIcon, AppsIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import GuideCard from './dashboard/GuideCard';
import StoresGuideContent from './dashboard/StoresGuideContent';
import SheetsGuideContent from './dashboard/SheetsGuideContent';
import OrdersGuideContent from './dashboard/OrdersGuideContent';
import ProductsGuideContent from './dashboard/ProductsGuideContent';
import TrackingGuideContent from './dashboard/TrackingGuideContent';
import MultiAppGuideContent from './dashboard/MultiAppGuideContent';

export default function Guide() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [openGuide, setOpenGuide] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/dashboard/stats');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (error) {
      console.error('Error fetching guide data:', error);
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

  if (loading) {
    return (
      <Page title="Setup Guide">
        <Layout>
          <Layout.Section><SkeletonBodyText lines={6} /></Layout.Section>
        </Layout>
      </Page>
    );
  }

  const overview = data?.overview || {};
  const productImports = data?.productImports || {};
  const trackingImports = data?.trackingImports || {};

  const hasStores = (overview.totalStores || 0) > 0;
  const hasSheets = (overview.totalSheets || 0) > 0;
  const hasOrderSync = (overview.activeSyncConfigs || 0) > 0;
  const hasProductImports = (productImports.completed || 0) > 0;
  const hasTrackingImports = (trackingImports.completed || 0) > 0;

  const guides = [
    {
      id: 'stores', title: 'Connect Shopify Stores',
      description: 'Manage your connected Shopify stores.',
      icon: StoreIcon, color: '#5c6ac4', done: hasStores,
      doneText: `${overview.totalStores || 0} store(s) connected`, pendingText: 'No stores connected',
      actionLabel: 'Go to Stores', actionUrl: '/stores',
      children: <StoresGuideContent />
    },
    {
      id: 'multi-app', title: 'Install via Multi-App OAuth',
      description: 'Connect stores using your own Shopify Partner App credentials.',
      icon: AppsIcon, color: '#2c6ecb', done: hasStores,
      doneText: 'Stores connected via partner app', pendingText: 'No stores installed yet',
      actionLabel: 'Go to Stores', actionUrl: '/stores',
      children: <MultiAppGuideContent />
    },
    {
      id: 'sheets', title: 'Connect Google Sheets',
      description: 'Authorize your Google account and link spreadsheets for data sync.',
      icon: NoteIcon, color: '#00a0ac', done: hasSheets,
      doneText: `${overview.totalSheets || 0} sheet(s) connected`, pendingText: 'No sheets connected',
      actionLabel: 'Go to Sheets', actionUrl: '/sheets',
      children: <SheetsGuideContent />
    },
    {
      id: 'orders', title: 'Setup Order Sync',
      description: 'Export orders from Shopify to Google Sheets automatically via webhooks.',
      icon: OrderIcon, color: '#9c6ade', done: hasOrderSync,
      doneText: `${overview.activeSyncConfigs || 0} active sync config(s)`, pendingText: 'Not configured',
      actionLabel: 'Go to Orders', actionUrl: '/orders',
      children: <OrdersGuideContent />
    },
    {
      id: 'products', title: 'Import Products',
      description: 'Import products from CSV files into your Shopify stores.',
      icon: ProductIcon, color: '#47c1bf', done: hasProductImports,
      doneText: `${productImports.totalProducts || 0} products imported`, pendingText: 'No imports yet',
      actionLabel: 'Go to Products', actionUrl: '/products',
      children: <ProductsGuideContent />
    },
    {
      id: 'tracking', title: 'Update Tracking',
      description: 'Upload Excel files with tracking numbers to update fulfillment on Shopify orders.',
      icon: DeliveryIcon, color: '#f49342', done: hasTrackingImports,
      doneText: `${trackingImports.totalUpdated || 0} orders updated`, pendingText: 'No tracking updates yet',
      actionLabel: 'Go to Tracking', actionUrl: '/tracking',
      children: <TrackingGuideContent />
    }
  ];

  return (
    <Page title="Setup Guide" subtitle="Step-by-step guide to configure your workspace">
      <Layout>
        {guides.map(guide => (
          <Layout.Section key={guide.id}>
            <GuideCard
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
