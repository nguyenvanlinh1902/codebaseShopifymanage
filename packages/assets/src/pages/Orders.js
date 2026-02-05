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
 * Orders Sync Page
 */
export default function Orders() {
  const [stores, setStores] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetName, setSheetName] = useState('Orders');
  const [orderStatus, setOrderStatus] = useState('any');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [previewOrders, setPreviewOrders] = useState([]);
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
    if (selectedStore) {
      fetchPreviewOrders();
    }
  }, [selectedStore, orderStatus]);

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

  const fetchPreviewOrders = async () => {
    try {
      const response = await fetch(
        `/api/orders?storeId=${selectedStore}&limit=5&status=${orderStatus}`
      );
      const result = await response.json();

      if (result.success) {
        setPreviewOrders(result.data);
      }
    } catch (err) {
      console.error('Error fetching orders preview:', err);
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

  const handleSync = async () => {
    if (!selectedStore || !selectedSheet) {
      setError('Please select a store and sheet');
      return;
    }

    try {
      setSyncing(true);
      setError(null);

      const response = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: USER_ID,
          storeId: selectedStore,
          sheetId: selectedSheet,
          sheetName,
          params: {
            status: orderStatus,
            limit: 250
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        setCurrentJob({id: result.data.jobId, status: 'processing'});
      } else {
        setError(result.error || 'Failed to start sync');
      }
    } catch (err) {
      console.error('Error starting sync:', err);
      setError('Failed to start sync');
    } finally {
      setSyncing(false);
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

  const statusOptions = [
    {label: 'All Orders', value: 'any'},
    {label: 'Open Orders', value: 'open'},
    {label: 'Closed Orders', value: 'closed'}
  ];

  const orderRows = previewOrders.slice(0, 5).map(order => [
    order.order_number || order.name,
    order.email || '-',
    `${order.currency} ${order.total_price}`,
    <Badge
      tone={
        order.financial_status === 'paid'
          ? 'success'
          : order.financial_status === 'pending'
          ? 'info'
          : 'warning'
      }
    >
      {order.financial_status}
    </Badge>,
    order.fulfillment_status || 'unfulfilled'
  ]);

  return (
    <Page
      title="Orders Sync"
      subtitle="Export orders from Shopify to Google Sheets"
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
                  Sync Progress
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
                      Syncing orders to Google Sheets...
                    </Text>
                  </div>
                )}

                {currentJob.status === 'completed' && currentJob.result && (
                  <div style={{marginTop: '16px'}}>
                    <Text variant="bodyMd" as="p">
                      ✅ Sync completed successfully!
                    </Text>
                    <ul style={{marginTop: '8px', marginLeft: '20px'}}>
                      <li>Orders synced: {currentJob.result.synced}</li>
                      <li>Sheet: {currentJob.result.sheetName}</li>
                      <li>Range: {currentJob.result.range}</li>
                    </ul>
                  </div>
                )}

                {currentJob.status === 'failed' && (
                  <div style={{marginTop: '16px'}}>
                    <Text variant="bodyMd" as="p" tone="critical">
                      ❌ Sync failed: {currentJob.result?.error || 'Unknown error'}
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
              Sync Settings
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
                    label="Sheet Name"
                    value={sheetName}
                    onChange={setSheetName}
                    placeholder="Orders"
                    helpText="Name of the sheet tab where orders will be written"
                  />
                </div>

                <div style={{marginBottom: '16px'}}>
                  <Select
                    label="Order Status"
                    options={statusOptions}
                    value={orderStatus}
                    onChange={setOrderStatus}
                  />
                </div>

                <Button
                  primary
                  fullWidth
                  onClick={handleSync}
                  loading={syncing}
                  disabled={!selectedStore || !selectedSheet}
                >
                  Sync Orders
                </Button>
              </div>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section oneHalf>
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Export Format
            </Text>
            <div style={{marginTop: '16px'}}>
              <Text variant="bodySm" as="p">
                Orders will be exported with these columns:
              </Text>
              <ul style={{marginTop: '8px', marginLeft: '20px', fontSize: '14px'}}>
                <li>Order ID</li>
                <li>Order Number</li>
                <li>Email</li>
                <li>Customer Name</li>
                <li>Phone</li>
                <li>Financial Status</li>
                <li>Fulfillment Status</li>
                <li>Total</li>
                <li>Currency</li>
                <li>Line Items</li>
                <li>Shipping Address</li>
                <li>Created At</li>
                <li>Store ID</li>
              </ul>
            </div>
          </Card>
        </Layout.Section>

        {selectedStore && (
          <Layout.Section>
            <Card>
              <div style={{padding: '16px'}}>
                <Text variant="headingMd" as="h2">
                  Recent Orders Preview
                </Text>
              </div>
              {previewOrders.length === 0 ? (
                <div style={{padding: '40px', textAlign: 'center'}}>
                  <Text variant="bodySm" as="p" tone="subdued">
                    No orders found
                  </Text>
                </div>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Order #', 'Email', 'Total', 'Financial', 'Fulfillment']}
                  rows={orderRows}
                />
              )}
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
