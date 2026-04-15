import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  BlockStack,
  Card,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  Modal,
  Text,
  Banner
} from '@shopify/polaris';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import CollectionForm from './collections/collection-form';
import CollectionSidebar from './collections/collection-sidebar';

const STORE_HISTORY_KEY = 'collections_last_store';

const DEFAULT_FORM = {
  title: '',
  descriptionHtml: '',
  collectionType: 'manual',
  rules: [],
  disjunctive: false,
  products: [],
  sortOrder: 'BEST_SELLING',
  image: '',
  templateSuffix: '',
  seo: {title: '', description: '', handle: ''}
};

export default function CollectionDetail() {
  const navigate = useNavigate();
  const {id} = useParams();
  const [searchParams] = useSearchParams();
  const {stores} = usePermittedStores();
  const isNew = !id;

  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [storeId, setStoreId] = useState(
    () => searchParams.get('store') || localStorage.getItem(STORE_HISTORY_KEY) || ''
  );
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  useEffect(() => {
    if (!isNew && storeId) {
      fetchCollection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, storeId]);

  const fetchCollection = async () => {
    try {
      setLoading(true);
      const res = await api(`/api/collections/${id}?storeId=${storeId}`);
      const result = await res.json();
      if (result.success && result.data) {
        const c = result.data;
        setFormData({
          title: c.title || '',
          descriptionHtml: c.descriptionHtml || '',
          collectionType: c.ruleSet ? 'smart' : 'manual',
          rules: c.ruleSet?.rules || [],
          disjunctive: c.ruleSet?.appliedDisjunctively || false,
          products: c.products || [],
          sortOrder: c.sortOrder || 'BEST_SELLING',
          image: c.image?.url || '',
          templateSuffix: c.templateSuffix || '',
          seo: {
            title: c.seo?.title || '',
            description: c.seo?.description || '',
            handle: c.handle || ''
          }
        });
      } else {
        setError(result.error || 'Failed to load collection');
      }
    } catch (err) {
      setError('Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
  }, []);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!storeId) {
      setError('Please select a store');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const body = {storeId, ...formData};
      const res = isNew
        ? await api('/api/collections/', {method: 'POST', body: JSON.stringify(body)})
        : await api(`/api/collections/${id}`, {
            method: 'PUT',
            body: JSON.stringify(body)
          });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem(STORE_HISTORY_KEY, storeId);
        if (isNew && result.data?.id) {
          const newId = result.data.id?.split('/').pop() || result.data.id;
          navigate(`/collections/${newId}?store=${storeId}`, {replace: true});
        } else {
          navigate(`/collections?store=${storeId}`);
        }
      } else {
        setError(result.error || 'Failed to save collection');
      }
    } catch (err) {
      setError('Failed to save collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await api(`/api/collections/${id}?storeId=${storeId}`, {
        method: 'DELETE'
      });
      const result = await res.json();
      if (result.success) {
        navigate('/collections');
      } else {
        setError(result.error || 'Failed to delete collection');
        setDeleteModalOpen(false);
      }
    } catch (err) {
      setError('Failed to delete collection');
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <SkeletonPage primaryAction backAction title="">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="400">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={5} />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={2} />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="400">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  const secondaryActions = isNew
    ? []
    : [
        {
          content: 'Create new',
          onAction: () => navigate(`/collections/new?store=${storeId}`)
        },
        {
          content: 'Delete collection',
          destructive: true,
          onAction: () => setDeleteModalOpen(true)
        }
      ];

  return (
    <Page
      title={isNew ? 'Create collection' : formData.title || 'Edit collection'}
      backAction={{content: 'Collections', url: '/collections'}}
      primaryAction={{content: 'Save', onAction: handleSave, loading: saving}}
      secondaryActions={secondaryActions}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
        <Layout>
          <Layout.Section>
            <CollectionForm formData={formData} onChange={handleChange} storeId={storeId} isNew={isNew} />
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <CollectionSidebar
              formData={formData}
              onChange={handleChange}
              stores={stores}
              storeId={storeId}
              onStoreChange={setStoreId}
              isNew={isNew}
              collectionId={id}
            />
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete collection"
        primaryAction={{
          content: 'Delete',
          destructive: true,
          onAction: handleDelete,
          loading: deleting
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setDeleteModalOpen(false)}]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete <strong>{formData.title}</strong>? This cannot be
            undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
