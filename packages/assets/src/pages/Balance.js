import React, {useState, useEffect} from 'react';
import {Page, Layout, Select} from '@shopify/polaris';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import AnalyticsBalancePanel from './analytics/analytics-balance-panel';

export default function Balance() {
  const {stores} = usePermittedStores();
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [balanceData, setBalanceData] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores]);

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

  const storeOptions = stores.map(s => ({label: s.name || s.shopDomain, value: s.id}));

  return (
    <Page title="Balance" subtitle="Shopify Payments account balance & payouts">
      <Layout>
        <Layout.Section>
          <div style={{minWidth: 280}}>
            <Select
              label="Store"
              options={storeOptions}
              value={selectedStoreId}
              onChange={setSelectedStoreId}
            />
          </div>
        </Layout.Section>
        <Layout.Section>
          <AnalyticsBalancePanel balance={balanceData} loading={balanceLoading} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
