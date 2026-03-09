import React from 'react';
import {Page, Layout, Card} from '@shopify/polaris';
import {useAuth} from '../context/AuthContext';
import {useStores} from '../context/store-context';
import CampaignAdsPanel from './analytics/campaign-ads-panel';

export default function CampaignAds() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const {stores: allStores} = useStores();
  const stores = isAdmin ? allStores : allStores.filter(s => (user?.assignedStores || []).includes(s.id));

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
