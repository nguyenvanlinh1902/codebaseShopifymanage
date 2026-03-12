import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, Tabs, Banner} from '@shopify/polaris';
import {api} from '../helpers/api';
import {useStores} from '../context/store-context';
import TemplatesTab from './shipping-management/TemplatesTab';
import StoreRatesTab from './shipping-management/StoreRatesTab';
import BulkApplyTab from './shipping-management/BulkApplyTab';

/**
 * Shipping Rate Management — Templates, Store Rates, Bulk Apply
 */
export default function ShippingManagement() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const {stores, groups} = useStores();

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const tabs = [
    {id: 'templates', content: 'Templates'},
    {id: 'store-rates', content: 'Store Rates'},
    {id: 'bulk-apply', content: 'Bulk Apply'}
  ];

  const fetchTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const res = await api('/api/shipping/templates');
      const data = await res.json();
      if (data.success) setTemplates(data.data);
      else setError(data.error);
    } catch {
      setError('Failed to fetch templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateTemplate = async ({name, description, sourceStore}) => {
    try {
      setError(null);
      const res = await api('/api/shipping/templates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, description, sourceStore})
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Template created successfully');
        fetchTemplates();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to create template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      setError(null);
      const res = await api(`/api/shipping/templates/${id}`, {method: 'DELETE'});
      const data = await res.json();
      if (data.success) {
        setSuccess('Template deleted');
        fetchTemplates();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to delete template');
    }
  };

  const handleRecaptureTemplate = async (id, sourceStore) => {
    try {
      setError(null);
      const res = await api(`/api/shipping/templates/${id}/recapture`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sourceStore})
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Template recaptured from store');
        fetchTemplates();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to recapture template');
    }
  };

  return (
    <Page title="Shipping Rate Management" subtitle="Manage shipping rates across stores">
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>
          </Layout.Section>
        )}
        {success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={i => {
            setSelectedTab(i);
            setError(null);
            setSuccess(null);
          }}>
            {selectedTab === 0 && (
              <TemplatesTab
                templates={templates}
                loading={templatesLoading}
                stores={stores}
                onCreate={handleCreateTemplate}
                onDelete={handleDeleteTemplate}
                onRecapture={handleRecaptureTemplate}
                onRefresh={fetchTemplates}
              />
            )}
            {selectedTab === 1 && (
              <StoreRatesTab
                stores={stores}
                groups={groups}
                onError={setError}
                onSuccess={setSuccess}
              />
            )}
            {selectedTab === 2 && (
              <BulkApplyTab
                templates={templates}
                stores={stores}
                groups={groups}
                onError={setError}
                onSuccess={setSuccess}
              />
            )}
          </Tabs>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
