import React, {useState, useEffect} from 'react';
import {Page, Layout, Card, Tabs, Select, InlineStack} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import AnalyticsOrderPanel from './analytics/analytics-order-panel';
import AnalyticsBalancePanel from './analytics/analytics-balance-panel';
import AnalyticsSheetStatusPanel from './analytics/analytics-sheet-status-panel';
import CampaignAdsPanel from './analytics/campaign-ads-panel';

const TABS = [
  {id: 'orders', content: 'Orders'},
  {id: 'balance', content: 'Balance'},
  {id: 'campaign-ads', content: 'Campaign Ads'},
  {id: 'sheets', content: 'Sheets'}
];

export default function Analytics() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [storeData, setStoreData] = useState(null);
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');

  useEffect(() => {
    fetchStores();
    fetchBalances();
    api('/api/store-groups').then(r => r.json()).then(d => {
      if (d.success) setGroups(d.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedStoreId) fetchStoreAnalytics(selectedStoreId);
  }, [selectedStoreId]);

  // Auto-select first store when group filter changes
  useEffect(() => {
    const filtered = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
    if (filtered.length > 0) setSelectedStoreId(filtered[0].id);
    else if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores, groupFilter]);

  const fetchStores = async () => {
    try {
      const res = await api('/api/stores?limit=100');
      const result = await res.json();
      if (result.success) {
        const all = result.data || [];
        const visible = isAdmin
          ? all
          : all.filter(s => (user?.assignedStores || []).includes(s.id));
        setStores(visible);
      }
    } catch {
      // non-critical
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await api('/api/stores/balances');
      const result = await res.json();
      if (result.success) setBalances(result.data || {});
    } catch {
      // non-critical
    }
  };

  const fetchStoreAnalytics = async storeId => {
    setLoading(true);
    setStoreData(null);
    try {
      const res = await api(`/api/analytics/store-stats?storeId=${storeId}`);
      const result = await res.json();
      if (result.success) setStoreData(result.data);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  };

  const handleStoreChange = id => {
    setSelectedStoreId(id);
    setSelectedTab(0);
  };

  const visibleStores = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
  const storeOptions = visibleStores.map(s => ({label: s.name || s.shopDomain, value: s.id}));
  const groupOptions = [{label: 'All groups', value: ''}, ...groups.map(g => ({label: g.name, value: g.id}))];

  return (
    <Page title="Analytics" subtitle="Per-store performance metrics">
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
                onChange={handleStoreChange}
              />
            </div>
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Tabs tabs={TABS} selected={selectedTab} onSelect={setSelectedTab}>
              <div style={{marginTop: 16}}>
                {selectedTab === 0 && (
                  <AnalyticsOrderPanel
                    orderSummary={storeData?.orderSummary}
                    orderTrend={storeData?.orderTrend}
                    loading={loading}
                  />
                )}
                {selectedTab === 1 && (
                  <AnalyticsBalancePanel
                    balance={balances[selectedStoreId]}
                    loading={!Object.keys(balances).length}
                  />
                )}
                {selectedTab === 2 && (
                  <CampaignAdsPanel stores={stores.filter(s => s.id === selectedStoreId)} />
                )}
                {selectedTab === 3 && (
                  <AnalyticsSheetStatusPanel
                    sheetConfigs={storeData?.sheetConfigs}
                    loading={loading}
                  />
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
