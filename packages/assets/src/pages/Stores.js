import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  DataTable,
  Button,
  Modal,
  TextField,
  FormLayout,
  Banner,
  SkeletonBodyText,
  EmptyState,
  Badge
} from '@shopify/polaris';

const USER_ID = 'demo-user'; // TODO: Replace with real auth

/**
 * Stores Management Page
 */
export default function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalActive, setModalActive] = useState(false);
  const [formData, setFormData] = useState({
    shopDomain: '',
    accessToken: '',
    name: '',
    niche: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stores?userId=${USER_ID}`);
      const result = await response.json();
      if (result.success) {
        setStores(result.data);
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  const handleModalOpen = useCallback(() => {
    setModalActive(true);
    setError(null);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalActive(false);
    setFormData({shopDomain: '', accessToken: '', name: '', niche: ''});
    setError(null);
  }, []);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: USER_ID,
          ...formData
        })
      });

      const result = await response.json();

      if (result.success) {
        await fetchStores();
        handleModalClose();
      } else {
        setError(result.error || 'Failed to add store');
      }
    } catch (err) {
      console.error('Error adding store:', err);
      setError('Failed to add store');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (storeId) => {
    if (!confirm('Are you sure you want to delete this store?')) return;

    try {
      const response = await fetch(`/api/stores/${storeId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await fetchStores();
      } else {
        alert(result.error || 'Failed to delete store');
      }
    } catch (err) {
      console.error('Error deleting store:', err);
      alert('Failed to delete store');
    }
  };

  const rows = stores.map(store => [
    store.name,
    store.shopDomain,
    store.niche || '-',
    <Badge tone={store.status === 'active' ? 'success' : 'warning'}>
      {store.status}
    </Badge>,
    <Button
      tone="critical"
      size="slim"
      onClick={() => handleDelete(store.id)}
    >
      Delete
    </Button>
  ]);

  return (
    <Page
      title="Shopify Stores"
      subtitle="Manage your connected Shopify stores"
      primaryAction={{
        content: 'Add Store',
        onAction: handleModalOpen
      }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            {loading ? (
              <SkeletonBodyText lines={5} />
            ) : stores.length === 0 ? (
              <EmptyState
                heading="No stores connected"
                action={{content: 'Add Store', onAction: handleModalOpen}}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add your first Shopify store to get started.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Shop Domain', 'Niche', 'Status', 'Actions']}
                rows={rows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalActive}
        onClose={handleModalClose}
        title="Add Shopify Store"
        primaryAction={{
          content: 'Add Store',
          onAction: handleSubmit,
          loading: submitting
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: handleModalClose
          }
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Store Name"
              value={formData.name}
              onChange={value => setFormData({...formData, name: value})}
              placeholder="My Store"
              helpText="A friendly name for your store"
            />
            <TextField
              label="Shop Domain"
              value={formData.shopDomain}
              onChange={value => setFormData({...formData, shopDomain: value})}
              placeholder="mystore.myshopify.com"
              helpText="Your Shopify store domain"
              required
            />
            <TextField
              label="Access Token"
              value={formData.accessToken}
              onChange={value => setFormData({...formData, accessToken: value})}
              placeholder="shpat_..."
              helpText="Your Shopify Admin API access token"
              type="password"
              required
            />
            <TextField
              label="Niche"
              value={formData.niche}
              onChange={value => setFormData({...formData, niche: value})}
              placeholder="Electronics, Fashion, etc."
              helpText="Product niche or category (optional)"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
