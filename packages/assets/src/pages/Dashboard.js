import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, InlineStack, Card, Text, Badge, BlockStack} from '@shopify/polaris';
import {StoreIcon, NoteIcon, OrderIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import StatCard from './dashboard/StatCard';
import DashboardFinanceSummary from './dashboard/dashboard-finance-summary';

export default function Dashboard() {
  const {user} = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

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

  const overview = data?.overview || {};

  const hasStores = (overview.totalStores || 0) > 0;
  const hasSheets = (overview.totalSheets || 0) > 0;
  const hasOrderSync = (overview.activeSyncConfigs || 0) > 0;

  const roleBadgeTone = user?.role === 'admin' ? 'info' : user?.role === 'manager' ? 'attention' : 'new';

  const canAccess = feature => {
    if (!user || user.role === 'admin') return true;
    if (!user.allowedFeatures) return true;
    if (user.allowedFeatures.length === 0) return false;
    return user.allowedFeatures.includes(feature);
  };

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

        {/* Finance Overview — scoped to user's permitted stores, requires 'dashboard-finance' sub-permission */}
        {canAccess('dashboard-finance') && (
          <Layout.Section>
            <DashboardFinanceSummary />
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
