import React, {useState, useEffect} from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  TextField,
  Button,
  Banner,
  ProgressBar,
  Text,
  DataTable,
  Badge,
  SkeletonBodyText
} from '@shopify/polaris';

const USER_ID = 'demo-user'; // TODO: Replace with real auth

/**
 * Products Import Page
 */
export default function Products() {
  const [stores, setStores] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [range, setRange] = useState('Products!A1:Z1000');
  const [mode, setMode] = useState('upsert');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [jobs, setJobs] = useState([]);
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [storesRes, sheetsRes, jobsRes] = await Promise.all([
        fetch(`/api/stores?userId=${USER_ID}`),
        fetch(`/api/sheets?userId=${USER_ID}`),
        fetch(`/api/products/jobs?userId=${USER_ID}`)
      ]);

      const [storesData, sheetsData, jobsData] = await Promise.all([
        storesRes.json(),
        sheetsRes.json(),
        jobsRes.json()
      ]);

      if (storesData.success) setStores(storesData.data);
      if (sheetsData.success) setSheets(sheetsData.data);
      if (jobsData.success) setJobs(jobsData.data.slice(0, 10));
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const checkJobStatus = async jobId => {
    try {
      const response = await fetch(`/api/products/jobs/${jobId}`);
      const result = await response.json();

      if (result.success) {
        setCurrentJob(result.data);

        if (result.data.status === 'completed' || result.data.status === 'failed') {
          await fetchData(); // Refresh jobs list
        }
      }
    } catch (err) {
      console.error('Error checking job status:', err);
    }
  };

  const handleImport = async () => {
    if (!selectedStore || !selectedSheet || !range) {
      setError('Please select a store, sheet, and range');
      return;
    }

    try {
      setImporting(true);
      setError(null);

      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: USER_ID,
          storeId: selectedStore,
          sheetId: selectedSheet,
          range,
          mode
        })
      });

      const result = await response.json();

      if (result.success) {
        setCurrentJob({id: result.data.jobId, status: 'processing'});
      } else {
        setError(result.error || 'Failed to start import');
      }
    } catch (err) {
      console.error('Error starting import:', err);
      setError('Failed to start import');
    } finally {
      setImporting(false);
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

  const modeOptions = [
    {label: 'Create only (skip existing)', value: 'create'},
    {label: 'Update only (skip new)', value: 'update'},
    {label: 'Create or Update (upsert)', value: 'upsert'}
  ];

  const jobRows = jobs.map(job => [
    new Date(job.createdAt).toLocaleString(),
    <Badge
      tone={
        job.status === 'completed'
          ? 'success'
          : job.status === 'failed'
          ? 'critical'
          : 'info'
      }
    >
      {job.status}
    </Badge>,
    job.result
      ? `${job.result.created || 0} created, ${job.result.updated || 0} updated, ${
          job.result.errors?.length || 0
        } errors`
      : '-'
  ]);

  return (
    <Page
      title="Products Import"
      subtitle="Import products from Google Sheets to Shopify"
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
                  Import Progress
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
                      Processing products...
                    </Text>
                  </div>
                )}

                {currentJob.status === 'completed' && currentJob.result && (
                  <div style={{marginTop: '16px'}}>
                    <Text variant="bodyMd" as="p">
                      ✅ Import completed successfully!
                    </Text>
                    <ul style={{marginTop: '8px', marginLeft: '20px'}}>
                      <li>Created: {currentJob.result.created}</li>
                      <li>Updated: {currentJob.result.updated}</li>
                      <li>Skipped: {currentJob.result.skipped || 0}</li>
                      <li>Errors: {currentJob.result.errors?.length || 0}</li>
                    </ul>
                  </div>
                )}

                {currentJob.status === 'failed' && (
                  <div style={{marginTop: '16px'}}>
                    <Text variant="bodyMd" as="p" tone="critical">
                      ❌ Import failed: {currentJob.result?.error || 'Unknown error'}
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
              Import Settings
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
                    placeholder="Products!A1:Z1000"
                    helpText="A1 notation range (e.g., Products!A1:Z1000)"
                  />
                </div>

                <div style={{marginBottom: '16px'}}>
                  <Select
                    label="Import Mode"
                    options={modeOptions}
                    value={mode}
                    onChange={setMode}
                  />
                </div>

                <Button
                  primary
                  fullWidth
                  onClick={handleImport}
                  loading={importing}
                  disabled={!selectedStore || !selectedSheet || !range}
                >
                  Start Import
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
                Your Google Sheet should have these columns:
              </Text>
              <ul style={{marginTop: '8px', marginLeft: '20px', fontSize: '14px'}}>
                <li>Title *</li>
                <li>Description</li>
                <li>Vendor</li>
                <li>Product Type</li>
                <li>Tags</li>
                <li>Price *</li>
                <li>Compare At Price</li>
                <li>SKU</li>
                <li>Barcode</li>
                <li>Inventory Quantity</li>
                <li>Image URL</li>
                <li>Status (draft/active)</li>
              </ul>
              <Text variant="bodySm" as="p" tone="subdued" style={{marginTop: '8px'}}>
                * Required fields
              </Text>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{padding: '16px'}}>
              <Text variant="headingMd" as="h2">
                Recent Import Jobs
              </Text>
            </div>
            {loading ? (
              <SkeletonBodyText lines={5} />
            ) : jobs.length === 0 ? (
              <div style={{padding: '40px', textAlign: 'center'}}>
                <Text variant="bodySm" as="p" tone="subdued">
                  No import jobs yet
                </Text>
              </div>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text']}
                headings={['Date', 'Status', 'Results']}
                rows={jobRows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
