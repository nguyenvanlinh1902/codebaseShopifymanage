import React, {useState, useEffect, useMemo} from 'react';
import {Page, Layout, Select, InlineStack} from '@shopify/polaris';
import {usePermittedStores} from '../hooks/usePermittedStores';
import {TIME_OPTIONS} from './analytics/campaign-ads-time-options';
import CampaignAdsPanel from './analytics/campaign-ads-panel';
import CampaignAllStoresPanel from './analytics/campaign-all-stores-panel';
import StoreSelector from '../components/store-selector';

const ALL_STORES_VALUE = '__all__';

export default function CampaignAds() {
  const {stores, groups, isAdmin} = usePermittedStores();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [timePeriod, setTimePeriod] = useState('this_month');

  // Filter stores by selected group (admin only)
  const filteredStores = useMemo(
    () => (selectedGroupId ? stores.filter(s => s.groupId === selectedGroupId) : stores),
    [stores, selectedGroupId]
  );

  const groupOptions = useMemo(
    () => [{label: 'All groups', value: ''}, ...groups.map(g => ({label: g.name, value: g.id}))],
    [groups]
  );

  const storeOptions = useMemo(() => {
    const opts = [];
    if (filteredStores.length > 1) {
      opts.push({label: `All stores (${filteredStores.length})`, value: ALL_STORES_VALUE});
    }
    filteredStores.forEach(s => opts.push({label: s.name || s.shopDomain, value: s.id}));
    return opts;
  }, [filteredStores]);

  // Auto-select when filtered stores changes
  useEffect(() => {
    if (filteredStores.length > 1) setSelectedStoreId(ALL_STORES_VALUE);
    else if (filteredStores.length === 1) setSelectedStoreId(filteredStores[0].id);
    else setSelectedStoreId('');
  }, [filteredStores]);

  const showAllStores = selectedStoreId === ALL_STORES_VALUE;

  return (
    <Page title="Campaign Ads" subtitle="Shop campaign ad spend via ShopifyQL">
      <Layout>
        {/* Selectors */}
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
            {storeOptions.length > 0 && (
              <div className="filter-item filter-item--lg">
                <StoreSelector
                  label="Store"
                  options={storeOptions}
                  value={selectedStoreId}
                  onChange={setSelectedStoreId}
                  pinnedValues={[ALL_STORES_VALUE]}
                />
              </div>
            )}
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

        {/* Content */}
        <Layout.Section>
          {showAllStores ? (
            <CampaignAllStoresPanel
              timePeriod={timePeriod}
              filterStoreIds={selectedGroupId ? filteredStores.map(s => s.id) : null}
            />
          ) : (
            <CampaignAdsPanel storeId={selectedStoreId} timePeriod={timePeriod} />
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
