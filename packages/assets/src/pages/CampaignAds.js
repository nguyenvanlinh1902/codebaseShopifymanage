import React from 'react';
import {Page, Layout, Card} from '@shopify/polaris';
import {usePermittedStores} from '../hooks/usePermittedStores';
import CampaignAdsPanel from './analytics/campaign-ads-panel';

export default function CampaignAds() {
  const {stores} = usePermittedStores();

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
