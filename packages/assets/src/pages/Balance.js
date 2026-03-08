import React, {useState, useEffect} from 'react';
import {Page, Layout, Select, InlineStack} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import AnalyticsBalancePanel from './analytics/analytics-balance-panel';

export default function Balance() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [balanceData, setBalanceData] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');

  useEffect(() => {
    fetchStores();
    api('/api/store-groups')
      .then(r => r.json())
      .then(d => {
        if (d.success) setGroups(d.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const filtered = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
    if (filtered.length > 0) setSelectedStoreId(filtered[0].id);
    else if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores, groupFilter]);

  useEffect(() => {
    if (selectedStoreId) fetchBalance(selectedStoreId);
  }, [selectedStoreId]);

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

  const fetchBalance = async storeId => {
    setBalanceLoading(true);
    setBalanceData(null);
    try {
      const res = await api(`/api/stores/balance?storeId=${storeId}`);
      const result = await res.json();
      if (result.success) {
        setBalanceData({balance: result.balance, payouts: result.payouts, reason: result.reason});
      } else {
        setBalanceData({balance: null, payouts: [], reason: result.error});
      }
    } catch (err) {
      setBalanceData({balance: null, payouts: [], reason: err.message});
    } finally {
      setBalanceLoading(false);
    }
  };

  const visibleStores = groupFilter ? stores.filter(s => s.groupId === groupFilter) : stores;
  const storeOptions = visibleStores.map(s => ({label: s.name || s.shopDomain, value: s.id}));
  const groupOptions = [
    {label: 'All groups', value: ''},
    ...groups.map(g => ({label: g.name, value: g.id}))
  ];

  return (
    <Page title="Balance" subtitle="Shopify Payments account balance & payouts">
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
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <AnalyticsBalancePanel
            balance={balanceData}
            loading={balanceLoading}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
