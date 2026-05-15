import React, {useState, useEffect, useMemo} from 'react';
import {Page, Layout, Select, InlineStack} from '@shopify/polaris';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import AnalyticsBalancePanel from './analytics/analytics-balance-panel';
import StoreSelector from '../components/store-selector';

export default function Balance() {
  const {stores, groups, isAdmin} = usePermittedStores();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [balanceData, setBalanceData] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const filteredStores = useMemo(
    () => (selectedGroupId ? stores.filter(s => s.groupId === selectedGroupId) : stores),
    [stores, selectedGroupId]
  );

  // Auto-select first store when filtered list changes
  useEffect(() => {
    if (filteredStores.length > 0) {
      setSelectedStoreId(filteredStores[0].id);
    } else {
      setSelectedStoreId('');
    }
  }, [filteredStores]);

  useEffect(() => {
    if (selectedStoreId) fetchBalance(selectedStoreId);
  }, [selectedStoreId]);

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

  const groupOptions = useMemo(
    () => [{label: 'All groups', value: ''}, ...groups.map(g => ({label: g.name, value: g.id}))],
    [groups]
  );

  const storeOptions = filteredStores.map(s => ({label: s.name || s.shopDomain, value: s.id}));

  return (
    <Page title="Balance" subtitle="Shopify Payments account balance & payouts">
      <Layout>
        <Layout.Section>
          <InlineStack gap="400" align="start" wrap>
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
              <StoreSelector
                label="Store"
                options={storeOptions}
                value={selectedStoreId}
                onChange={setSelectedStoreId}
                pinnedValues={[]}
              />
            </div>
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <AnalyticsBalancePanel balance={balanceData} loading={balanceLoading} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
