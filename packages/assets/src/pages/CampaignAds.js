import React, {useState, useEffect} from 'react';
import {Page, Layout, Card} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import CampaignAdsPanel from './analytics/campaign-ads-panel';

export default function CampaignAds() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stores, setStores] = useState([]);

  useEffect(() => {
    fetchStores();
  }, []);

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

  return (
    <Page title="Campaign Ads" subtitle="Shop campaign ad spend via ShopifyQL">
      <Layout>
        <Layout.Section>
          <Card>
            <CampaignAdsPanel stores={stores} />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
