import React, {useState, useEffect} from 'react';
import {Page, Layout, Select, InlineStack} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import {useStores} from '../context/store-context';
import AnalyticsOrderStats from './analytics/analytics-order-stats';
import AnalyticsOrderChart from './analytics/analytics-order-chart';

const TIME_OPTIONS = [
  {label: 'Today', value: '-1d'},
  {label: 'Last 7 days', value: '-7d'},
  {label: 'Last 30 days', value: '-30d'},
  {label: 'Last 90 days', value: '-90d'},
  {label: 'This month', value: 'startOfMonth(0m)'},
  {label: 'This year', value: 'startOfYear(0y)'}
];

export default function Analytics() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const {stores: allStores, groups} = useStores();
  const stores = isAdmin ? allStores : allStores.filter(s => (user?.assignedStores || []).includes(s.id));
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [timePeriod, setTimePeriod] = useState('-30d');

  useEffect(() => {
    if (selectedStoreId) fetchAnalytics(selectedStoreId, timePeriod);
  }, [selectedStoreId, timePeriod]);

  useEffect(() => {
    const filtered = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
    if (filtered.length > 0) setSelectedStoreId(filtered[0].id);
    else if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores, groupFilter]);

  const fetchAnalytics = async (storeId, since) => {
    setLoading(true);
    setAnalyticsData(null);
    try {
      const res = await api(`/api/analytics/order-analytics?storeId=${storeId}&since=${since}`);
      const result = await res.json();
      if (result.success) setAnalyticsData(result.data);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  };

  const visibleStores = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
  const storeOptions = visibleStores.map(s => ({label: s.name || s.shopDomain, value: s.id}));
  const groupOptions = [{label: 'All groups', value: ''}, ...groups.map(g => ({label: g.name, value: g.id}))];

  return (
    <Page title="Analytics" subtitle="Real-time Shopify order metrics">
      <Layout>
        <Layout.Section>
          <InlineStack align="start" gap="400">
            {groups.length > 0 && (
              <div style={{minWidth: 200}}>
                <Select label="Group" options={groupOptions} value={groupFilter} onChange={setGroupFilter} />
              </div>
            )}
            <div style={{minWidth: 280}}>
              <Select label="Store" options={storeOptions} value={selectedStoreId} onChange={setSelectedStoreId} />
            </div>
            <div style={{minWidth: 180}}>
              <Select label="Period" options={TIME_OPTIONS} value={timePeriod} onChange={setTimePeriod} />
            </div>
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <AnalyticsOrderStats summary={analyticsData?.summary} byStatus={analyticsData?.byStatus} loading={loading} />
        </Layout.Section>
        <Layout.Section>
          <AnalyticsOrderChart timeSeries={analyticsData?.timeSeries} loading={loading} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
