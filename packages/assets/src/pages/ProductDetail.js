/* eslint-disable react/prop-types */
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
import ProductForm from './product-detail/product-form';
import ProductSidebar from './product-detail/product-sidebar';

const STORE_HISTORY_KEY = 'products_last_store';

const DEFAULT_FORM = {
  title: '',
  descriptionHtml: '',
  vendor: '',
  productType: '',
  tags: [],
  status: 'DRAFT',
  handle: '',
  templateSuffix: '',
  seo: {title: '', description: ''},
  options: [],
  variants: [{optionValues: {}, price: '0.00', sku: '', compareAtPrice: '', barcode: '', requiresShipping: true, taxable: true}],
  media: [],
  metafields: [],
  collections: [],
  publications: [],
  category: null
};

export default function ProductDetail() {
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
  const [duplicating, setDuplicating] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (stores.length > 0 && !storeId) setStoreId(stores[0].id);
  }, [stores, storeId]);

  useEffect(() => {
    if (!isNew && storeId) fetchProduct();
  }, [id, storeId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await api(`/api/shopify-products/${id}?storeId=${storeId}`);
      const result = await res.json();
      if (result.success && result.data) {
        const p = result.data;
        setFormData({
          title: p.title || '',
          descriptionHtml: p.descriptionHtml || '',
          vendor: p.vendor || '',
          productType: p.productType || '',
          tags: Array.isArray(p.tags) ? p.tags : [],
          status: p.status || 'DRAFT',
          handle: p.handle || '',
          templateSuffix: p.templateSuffix || '',
          seo: {title: p.seo?.title || '', description: p.seo?.description || ''},
          options: (p.options || []).filter(
            o => !(o.name === 'Title' && (o.values || []).length === 1 && o.values[0] === 'Default Title')
          ),
          variants: p.variants?.length
            ? p.variants.map(v => {
                const optionValues = v.optionValues || {};
                if (Array.isArray(v.selectedOptions)) {
                  v.selectedOptions.forEach(o => {
                    if (o?.name) optionValues[o.name] = o.value;
                  });
                }
                // inventory[locId] = number (simple available qty, kept for legacy save logic).
                // inventoryDetails[locId] = {available, on_hand, committed, unavailable} (display only).
                const inventory = v.inventory || {};
                const inventoryDetails = {};
                const UNAVAILABLE_NAMES = ['reserved', 'damaged', 'safety_stock', 'quality_control'];
                if (Array.isArray(v.inventoryItem?.inventoryLevels?.nodes)) {
                  v.inventoryItem.inventoryLevels.nodes.forEach(n => {
                    const locId = n.location?.id;
                    if (locId == null) return;
                    const qmap = {};
                    (n.quantities || []).forEach(q => {
                      qmap[q.name] = q.quantity ?? 0;
                    });
                    const unavailable = UNAVAILABLE_NAMES.reduce((s, name) => s + (qmap[name] || 0), 0);
                    inventory[locId] = qmap.available ?? 0;
                    inventoryDetails[locId] = {
                      available: qmap.available ?? 0,
                      on_hand: qmap.on_hand ?? 0,
                      committed: qmap.committed ?? 0,
                      unavailable
                    };
                  });
                }
                return {
                  ...v,
                  optionValues,
                  inventory,
                  inventoryDetails,
                  inventoryItemId: v.inventoryItemId || v.inventoryItem?.id || null,
                  requiresShipping: v.inventoryItem?.requiresShipping !== false,
                  taxable: v.taxable !== false,
                  cost: v.cost ?? v.inventoryItem?.unitCost?.amount ?? ''
                };
              })
            : DEFAULT_FORM.variants,
          media: (p.media || []).map(m => ({
            id: m.id,
            alt: m.alt || '',
            mediaContentType: m.mediaContentType || 'IMAGE',
            url: m.url || m.image?.url || ''
          })),
          metafields: p.metafields || [],
          collections: p.collections || [],
          publications: p.publications || [],
          category: p.category || null
        });
      } else {
        setError(result.error || 'Failed to load product');
      }
    } catch (err) {
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
  }, []);

  const handleSave = async () => {
    if (!formData.title.trim()) return setError('Title is required');
    if (!storeId) return setError('Please select a store');
    try {
      setSaving(true);
      setError(null);
      const body = {storeId, ...formData};
      const res = isNew
        ? await api('/api/shopify-products/', {method: 'POST', body: JSON.stringify(body)})
        : await api(`/api/shopify-products/${id}`, {method: 'PUT', body: JSON.stringify(body)});
      const result = await res.json().catch(() => ({success: false, error: `Request failed (${res.status})`}));
      if (result.success) {
        localStorage.setItem(STORE_HISTORY_KEY, storeId);
        if (isNew && result.data?.id) {
          const newId = String(result.data.id)
            .split('/')
            .pop();
          navigate(`/products/${newId}?store=${storeId}`, {replace: true});
        } else {
          // Stay on edit page; refresh product data so UI shows server-persisted state
          await fetchProduct();
        }
      } else {
        setError(result.error || 'Failed to save product');
      }
    } catch (err) {
      setError(err?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await api(`/api/shopify-products/${id}?storeId=${storeId}`, {method: 'DELETE'});
      const result = await res.json();
      if (result.success) navigate('/products');
      else {
        setError(result.error || 'Failed to delete');
        setDeleteModalOpen(false);
      }
    } catch (err) {
      setError('Failed to delete');
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      setDuplicating(true);
      const res = await api(`/api/shopify-products/${id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({storeId, newTitle: `Copy of ${formData.title}`})
      });
      const result = await res.json();
      if (result.success && result.data?.newProductId) {
        const newId = String(result.data.newProductId)
          .split('/')
          .pop();
        navigate(`/products/${newId}?store=${storeId}`);
      } else setError(result.error || 'Failed to duplicate');
    } catch (err) {
      setError('Failed to duplicate');
    } finally {
      setDuplicating(false);
    }
  };

  const handleArchive = () => handleChange('status', 'ARCHIVED');

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
              <Card>
                <BlockStack gap="400">
                  <SkeletonDisplayText size="small" />
                  <SkeletonBodyText lines={4} />
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
        {content: 'Duplicate', onAction: handleDuplicate, loading: duplicating},
        {content: 'Archive', onAction: handleArchive},
        {content: 'Delete', destructive: true, onAction: () => setDeleteModalOpen(true)}
      ];

  return (
    <Page
      title={isNew ? 'Create product' : formData.title || 'Edit product'}
      backAction={{content: 'Products', url: '/products'}}
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
            <ProductForm
              formData={formData}
              onChange={handleChange}
              storeId={storeId}
              isNew={isNew}
              productId={id}
            />
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <ProductSidebar
              formData={formData}
              onChange={handleChange}
              stores={stores}
              storeId={storeId}
              onStoreChange={setStoreId}
              isNew={isNew}
              productId={id}
            />
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete product"
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
