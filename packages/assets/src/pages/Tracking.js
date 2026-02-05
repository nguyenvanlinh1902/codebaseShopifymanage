import React, {useState, useEffect} from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  TextField,
  Button,
  Banner,
  Text,
  DataTable,
  Badge,
  SkeletonBodyText,
  ProgressBar
} from '@shopify/polaris';

const USER_ID = 'demo-user'; // TODO: Replace with real auth

/**
 * Tracking Update Page
 */
export default function Tracking() {
  const [stores, setStores] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [range, setRange] = useState('Tracking!A1:Z1000');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [previewTracking, setPreviewTracking] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (currentJob && currentJob.status === 'processing') {
      const interval = setInterval(() => {
        checkJobStatus(currentJob.id);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentJob]);

  useEffect(() => {
    if (selectedSheet && range) {
      fetchPreviewTracking();
    }
  }, [selectedSheet, range]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [storesRes, sheetsRes] = await Promise.all([
        fetch(`/api/stores?userId=${USER_ID}`),
        fetch(`/api/sheets?userId=${USER_ID}`)
      ]);

      const [storesData, sheetsData] = await Promise.all([
        storesRes.json(),
        sheetsRes.json()
      ]);

      if (storesData.success) setStores(storesData.data);
      if (sheetsData.success) setSheets(sheetsData.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviewTracking = async () => {
    try {
      const response = await fetch(
        `/api/tracking/preview?sheetId=${selectedSheet}&range=${encodeURIComponent(range)}`
      );
      const result = await response.json();

      if (result.success) {
        setPreviewTracking(result.data.trackingData || []);
      }
    } catch (err) {
      console.error('Error fetching tracking preview:', err);
    }
  };

  const checkJobStatus = async jobId => {
    try {
      const response = await fetch(`/api/products/jobs/${jobId}`);
      const result = await response.json();

      if (result.success) {
        setCurrentJob(result.data);
      }
    } catch (err) {
      console.error('Error checking job status:', err);
    }
  };

  const handleUpdate = async () => {
    if (!selectedStore || !selectedSheet || !range) {
      setError('Please select a store, sheet, and range');
      return;
    }

    try {
      setUpdating(true);
      setError(null);

      const response = await fetch('/api/tracking/update', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: USER_ID,
          storeId: selectedStore,
          sheetId: selectedSheet,
          range
        })
      });

      const result = await response.json();

      if (result.success) {
        setCurrentJob({id: result.data.jobId, status: 'processing'});
      } else {
        setError(result.error || 'Failed to start tracking update');
      }
    } catch (err) {
      console.error('Error starting tracking update:', err);
      setError('Failed to start tracking update');
    } finally {
      setUpdating(false);
    }
  };

  const storeOptions = stores.map(store => ({
    label: store.name,
    value: store.id
  }));

  const sheetOptions = sheets.map(sheet => ({
    label: sheet.name,
    value: sheet.id
  }));

  const trackingRows = previewTracking.slice(0, 10).map(tracking => [
    tracking.orderId || '-',
    tracking.trackingNumber || '-',
    tracking.trackingCompany || '-',
    tracking.trackingUrl ? '✅' : '-',
    <Badge tone={tracking.status === 'Updated' ? 'success' : 'info'}>
      {tracking.status || 'Pending'}
    </Badge>
  ]);

  return (
    <Page
      title="Tracking Update"
      subtitle="Update fulfillment tracking from Google Sheets to Shopify"
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        {currentJob && (
          <Layout.Section>
            <Card>
              <div style={{padding: '16px'}}>
                <Text variant="headingMd" as="h2">
                  Update Progress
                </Text>
                <div style={{marginTop: '16px'}}>
                  <Badge
                    tone={
                      currentJob.status === 'completed'
                        ? 'success'
                        : currentJob.status === 'failed'
                        ? 'critical'
                        : 'info'
                    }
                  >
                    {currentJob.status}
                  </Badge>
                </div>

                {currentJob.status === 'processing' && (
                  <div style={{marginTop: '16px'}}>
                    <ProgressBar size="small" animated />
                    <Text variant="bodySm" as="p" tone="subdued">
                      Updating tracking information...
                    </Text>
                  </div>
                )}

                {currentJob.status === 'completed' && currentJob.result && (
                  <div style={{marginTop: '16px'}}>
                    <Text variant="bodyMd" as="p">
                      ✅ Tracking update completed!
                    </Text>
                    <ul style={{marginTop: '8px', marginLeft: '20px'}}>
                      <li>Updated: {currentJob.result.updated}</li>
                      <li>Created: {currentJob.result.created}</li>
                      <li>Errors: {currentJob.result.errors?.length || 0}</li>
                    </ul>
                  </div>
                )}

                {currentJob.status === 'failed' && (
                  <div style={{marginTop: '16px'}}>
                    <Text variant="bodyMd" as="p" tone="critical">
                      ❌ Update failed: {currentJob.result?.error || 'Unknown error'}
                    </Text>
                  </div>
                )}

                {currentJob.status !== 'processing' && (
                  <div style={{marginTop: '16px'}}>
                    <Button onClick={() => setCurrentJob(null)}>Close</Button>
                  </div>
                )}
              </div>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section oneHalf>
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Update Settings
            </Text>

            {loading ? (
              <SkeletonBodyText lines={5} />
            ) : (
              <div style={{marginTop: '16px'}}>
                <div style={{marginBottom: '16px'}}>
                  <Select
                    label="Select Store"
                    options={storeOptions}
                    value={selectedStore}
                    onChange={setSelectedStore}
                    placeholder="Choose a store"
                  />
                </div>

                <div style={{marginBottom: '16px'}}>
                  <Select
                    label="Select Sheet"
                    options={sheetOptions}
                    value={selectedSheet}
                    onChange={setSelectedSheet}
                    placeholder="Choose a sheet"
                  />
                </div>

                <div style={{marginBottom: '16px'}}>
                  <TextField
                    label="Sheet Range"
                    value={range}
                    onChange={setRange}
                    placeholder="Tracking!A1:Z1000"
                    helpText="A1 notation range (e.g., Tracking!A1:Z1000)"
                  />
                </div>

                <Button
                  primary
                  fullWidth
                  onClick={handleUpdate}
                  loading={updating}
                  disabled={!selectedStore || !selectedSheet || !range}
                >
                  Update Tracking
                </Button>
              </div>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section oneHalf>
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Sheet Format
            </Text>
            <div style={{marginTop: '16px'}}>
              <Text variant="bodySm" as="p">
                Your tracking sheet should have these columns:
              </Text>
              <ul style={{marginTop: '8px', marginLeft: '20px', fontSize: '14px'}}>
                <li>Order ID * (Shopify order ID)</li>
                <li>Fulfillment ID (if updating existing)</li>
                <li>Tracking Number *</li>
                <li>Tracking Company</li>
                <li>Tracking URL</li>
                <li>Status (leave blank for new updates)</li>
              </ul>
              <Text variant="bodySm" as="p" tone="subdued" style={{marginTop: '8px'}}>
                * Required fields
              </Text>
              <Text variant="bodySm" as="p" tone="subdued" style={{marginTop: '8px'}}>
                Note: Only rows with Status ≠ "Updated" will be processed
              </Text>
            </div>
          </Card>
        </Layout.Section>

        {selectedSheet && range && (
          <Layout.Section>
            <Card>
              <div style={{padding: '16px'}}>
                <Text variant="headingMd" as="h2">
                  Tracking Preview ({previewTracking.length} items)
                </Text>
              </div>
              {previewTracking.length === 0 ? (
                <div style={{padding: '40px', textAlign: 'center'}}>
                  <Text variant="bodySm" as="p" tone="subdued">
                    No tracking data found or all items already updated
                  </Text>
                </div>
              ) : (
                <div>
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                    headings={['Order ID', 'Tracking #', 'Carrier', 'URL', 'Status']}
                    rows={trackingRows}
                  />
                  {previewTracking.length > 10 && (
                    <div style={{padding: '16px', textAlign: 'center'}}>
                      <Text variant="bodySm" as="p" tone="subdued">
                        Showing first 10 items. {previewTracking.length - 10} more will be
                        processed.
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
