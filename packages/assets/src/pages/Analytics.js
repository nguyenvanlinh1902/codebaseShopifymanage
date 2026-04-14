import React, {useState, useEffect, useMemo} from 'react';
import {Page, Layout, Select, InlineStack} from '@shopify/polaris';
import {api} from '../helpers/api';
import {resolvePeriodDates} from '../helpers/timezone-date';
import {usePermittedStores} from '../hooks/usePermittedStores';
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

export default function Analytics() {
  const {stores, groups, isAdmin, user} = usePermittedStores();

  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState('-30d');
  const userTimezone = user?.timezone || '';

  // Filter stores by selected group
  const filteredStores = useMemo(
    () => (selectedGroupId ? stores.filter(s => s.groupId === selectedGroupId) : stores),
    [stores, selectedGroupId]
  );

  // Stable list of store IDs for the "All stores" fetch
  const storeIds = useMemo(() => filteredStores.map(s => s.id).join(','), [filteredStores]);

  const groupOptions = useMemo(
    () => [{label: 'All groups', value: ''}, ...groups.map(g => ({label: g.name, value: g.id}))],
    [groups]
  );

  const storeOptions = [
    ...(filteredStores.length > 1
      ? [{label: `All stores (${filteredStores.length})`, value: ALL_STORES_VALUE}]
      : []),
    ...filteredStores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];

  // Auto-select when filtered stores list changes
  useEffect(() => {
    if (filteredStores.length > 1) {
      setSelectedStoreId(ALL_STORES_VALUE);
    } else if (filteredStores.length === 1) {
      setSelectedStoreId(filteredStores[0].id);
    } else {
      setSelectedStoreId('');
    }
  }, [filteredStores]);

  // Fetch analytics whenever selection changes
  useEffect(() => {
    if (!selectedStoreId || stores.length === 0) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setAnalyticsData(null);
      try {
        // Resolve period to explicit date range in user's timezone
        // so dates match Dashboard's client-side calculations
        const {from, to} = resolvePeriodDates(timePeriod, userTimezone);

        if (selectedStoreId === ALL_STORES_VALUE) {
          // Single batch request instead of N individual requests
          const params = new URLSearchParams({storeIds, from, to});
          if (userTimezone) params.set('timezone', userTimezone);
          const res = await api(`/api/analytics/order-analytics-batch?${params}`);
          const result = await res.json();
          if (!cancelled && result.success) setAnalyticsData(result.data);
        } else {
          const params = new URLSearchParams({storeId: selectedStoreId, from, to});
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
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, timePeriod, storeIds, userTimezone]);

  return (
    <Page title="Analytics" subtitle="Real-time Shopify order metrics">
      <Layout>
        <Layout.Section>
          <InlineStack align="start" gap="400" wrap>
            {isAdmin && groups.length > 0 && (
              <div className="filter-item filter-item--md">
                <Select
                  label="Group"
                  options={groupOptions}
                  value={selectedGroupId}
                  onChange={setSelectedGroupId}
                />
              </div>
            )}
            <div className="filter-item filter-item--lg">
              <Select
                label="Store"
                options={storeOptions}
                value={selectedStoreId}
                onChange={setSelectedStoreId}
              />
            </div>
            <div className="filter-item filter-item--sm">
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
