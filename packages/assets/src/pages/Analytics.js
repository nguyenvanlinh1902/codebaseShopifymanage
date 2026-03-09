import React, {useState, useEffect, useMemo} from 'react';
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

const ALL_STORES_VALUE = '__all__';

/** Aggregate multiple analytics results into one */
function aggregateResults(results) {
  const summary = {totalOrders: 0, totalRevenue: 0, totalSales: 0, avgOrderValue: 0};
  const statusMap = {};
  const timeMap = {};

  for (const r of results) {
    if (r.summary) {
      summary.totalOrders += r.summary.totalOrders || 0;
      summary.totalRevenue += r.summary.totalRevenue || 0;
      summary.totalSales += r.summary.totalSales || 0;
    }
    if (r.byStatus) {
      for (const [k, v] of Object.entries(r.byStatus)) {
        statusMap[k] = (statusMap[k] || 0) + v;
      }
    }
    if (r.timeSeries) {
      for (const row of r.timeSeries) {
        if (!timeMap[row.date]) {
          timeMap[row.date] = {date: row.date, orders: 0, revenue: 0, totalSales: 0};
        }
        timeMap[row.date].orders += row.orders || 0;
        timeMap[row.date].revenue += row.revenue || 0;
        timeMap[row.date].totalSales += row.totalSales || 0;
      }
    }
  }

  summary.avgOrderValue = summary.totalOrders > 0
    ? Math.round((summary.totalRevenue / summary.totalOrders) * 100) / 100
    : 0;

  const timeSeries = Object.values(timeMap).sort((a, b) => a.date.localeCompare(b.date));
  return {summary, byStatus: statusMap, timeSeries};
}

export default function Analytics() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const {stores: allStores, groups} = useStores();
  const stores = isAdmin
    ? allStores
    : allStores.filter(s => (user?.assignedStores || []).includes(s.id));

  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [timePeriod, setTimePeriod] = useState('-30d');
  const userTimezone = user?.timezone || '';

  const visibleStores = useMemo(
    () => (groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores),
    [groupFilter, stores]
  );

  // Stable list of store IDs for the "All stores" fetch
  const visibleStoreIds = useMemo(
    () => visibleStores.map(s => s.id).join(','),
    [visibleStores]
  );

  const storeOptions = [
    ...(visibleStores.length > 1
      ? [{label: `All stores (${visibleStores.length})`, value: ALL_STORES_VALUE}]
      : []),
    ...visibleStores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];

  const groupOptions = [
    {label: 'All groups', value: ''},
    ...groups.map(g => ({label: g.name, value: g.id}))
  ];

  // Auto-select when group or stores list changes
  useEffect(() => {
    if (visibleStores.length > 1) {
      setSelectedStoreId(ALL_STORES_VALUE);
    } else if (visibleStores.length === 1) {
      setSelectedStoreId(visibleStores[0].id);
    } else {
      setSelectedStoreId('');
    }
  }, [visibleStores]);

  // Fetch analytics whenever selection changes
  useEffect(() => {
    if (!selectedStoreId || visibleStores.length === 0) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setAnalyticsData(null);
      try {
        if (selectedStoreId === ALL_STORES_VALUE) {
          const ids = visibleStoreIds.split(',').filter(Boolean);
          const results = await Promise.all(
            ids.map(id => {
              const params = new URLSearchParams({storeId: id, since: timePeriod});
              if (userTimezone) params.set('timezone', userTimezone);
              return api(`/api/analytics/order-analytics?${params}`)
                .then(r => r.json())
                .then(r => (r.success ? r.data : null));
            })
          );
          if (!cancelled) setAnalyticsData(aggregateResults(results.filter(Boolean)));
        } else {
          const params = new URLSearchParams({storeId: selectedStoreId, since: timePeriod});
          if (userTimezone) params.set('timezone', userTimezone);
          const res = await api(`/api/analytics/order-analytics?${params}`);
          const result = await res.json();
          if (!cancelled && result.success) setAnalyticsData(result.data);
        }
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [selectedStoreId, timePeriod, visibleStoreIds, userTimezone]);

  return (
    <Page title="Analytics" subtitle="Real-time Shopify order metrics">
      <Layout>
        <Layout.Section>
          <InlineStack align="start" gap="400">
            {groups.length > 0 && (
              <div style={{minWidth: 200}}>
                <Select
                  label="Group"
                  options={groupOptions}
                  value={groupFilter}
                  onChange={setGroupFilter}
                />
              </div>
            )}
            <div style={{minWidth: 280}}>
              <Select
                label="Store"
                options={storeOptions}
                value={selectedStoreId}
                onChange={setSelectedStoreId}
              />
            </div>
            <div style={{minWidth: 180}}>
              <Select
                label="Period"
                options={TIME_OPTIONS}
                value={timePeriod}
                onChange={setTimePeriod}
              />
            </div>
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <AnalyticsOrderStats
            summary={analyticsData?.summary}
            byStatus={analyticsData?.byStatus}
            loading={loading}
          />
        </Layout.Section>
        <Layout.Section>
          <AnalyticsOrderChart
            timeSeries={analyticsData?.timeSeries}
            loading={loading}
            timezone={userTimezone}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
