import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  Page, Layout, Card, Select, TextField, Button, Text, Badge, Toast,
  Banner, InlineStack, BlockStack, Thumbnail, SkeletonBodyText,
  Spinner, Divider, Box, Scrollable, Icon, Modal, Checkbox
} from '@shopify/polaris';
import {
  SearchIcon, DeleteIcon, ExternalIcon, ImageIcon, EditIcon, PlusIcon,
  ShareIcon, ClipboardIcon, DiscountIcon, DeliveryIcon, TaxIcon
} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

const fmtMoney = v => `$${parseFloat(v || 0).toFixed(2)}`;

export default function DraftOrderForm({storeId, storeOptions, onStoreChange, onBack, editOrderId = null, onOrderCreated}) {
  const [lineItems, setLineItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [orderName, setOrderName] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const isEdit = !!editOrderId;
  const [editingNotes, setEditingNotes] = useState(false);

  // Discount, Shipping, Tax
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState('FIXED_AMOUNT');
  const [discountTitle, setDiscountTitle] = useState('Custom discount');
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [shippingPrice, setShippingPrice] = useState('');
  const [shippingTitle, setShippingTitle] = useState('Custom');
  const [editingShipping, setEditingShipping] = useState(false);
  const [taxExempt, setTaxExempt] = useState(false);

  // Share
  const [shareUrl, setShareUrl] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // New customer form
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerFirst, setNewCustomerFirst] = useState('');
  const [newCustomerLast, setNewCustomerLast] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCompany, setNewCustomerCompany] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState({
    address1: '', city: '', province: '', country: '', zip: '', phone: ''
  });

  // Custom field definitions
  const [fieldDefinitions, setFieldDefinitions] = useState([]);

  useEffect(() => {
    api('/api/custom-fields').then(r => r.json()).then(data => {
      if (data.success && data.data?.length) setFieldDefinitions(data.data);
    }).catch(() => {});
  }, []);

  // Product modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const productDebounce = useRef(null);

  // Customer modal
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const customerDebounce = useRef(null);

  // Load existing draft order for edit
  useEffect(() => {
    if (!isEdit || !storeId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await api(`/api/draft-orders/${editOrderId}?storeId=${storeId}`);
        const result = await res.json();
        if (result.success) {
          const d = result.data;
          setOrderName(d.name);
          setNote(d.note || '');
          setTags(
            Array.isArray(d.tags)
              ? d.tags
              : d.tags
              ? d.tags.split(',').map(t => t.trim()).filter(Boolean)
              : []
          );
          if (d.invoiceUrl) setShareUrl(d.invoiceUrl);
          if (d.adminUrl) setAdminUrl(d.adminUrl);
          if (d.taxExempt) setTaxExempt(true);
          if (d.appliedDiscount) {
            setDiscountValue(String(d.appliedDiscount.value || ''));
            setDiscountType(d.appliedDiscount.valueType || 'FIXED_AMOUNT');
            setDiscountTitle(d.appliedDiscount.title || 'Custom discount');
          }
          if (d.shippingLine) {
            setShippingPrice(String(d.shippingLine.price || ''));
            setShippingTitle(d.shippingLine.title || 'Custom');
          }
          if (d.customer?.email) {
            const addr = d.shippingAddress;
            setSelectedCustomer({
              name: d.customer.name,
              email: d.customer.email,
              phone: d.customer.phone || '',
              shippingAddress: addr || null,
              shippingAddressFormatted: addr
                ? [addr.address1, addr.city, addr.province, addr.zip, addr.country].filter(Boolean).join(', ')
                : ''
            });
          }
          setLineItems(
            d.lineItems.map(item => ({
              variantId: item.variantId || '',
              title: item.title,
              variantTitle: item.variantTitle || '',
              sku: item.sku || '',
              price: item.price,
              quantity: item.quantity,
              image: item.image || null,
              isCustom: item.isCustom
            }))
          );
        } else {
          setErrorMsg(result.error || 'Failed to load draft order');
        }
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, editOrderId, storeId]);

  // ── Product modal search ──
  const fetchProducts = useCallback(query => {
    setProductQuery(query);
    if (productDebounce.current) clearTimeout(productDebounce.current);
    productDebounce.current = setTimeout(async () => {
      if (!storeId) return;
      setSearchingProducts(true);
      try {
        const params = new URLSearchParams({storeId});
        if (query.trim()) params.set('query', query.trim());
        const res = await api(`/api/draft-orders/products?${params}`);
        const result = await res.json();
        if (result.success) setProductResults(result.data.products);
      } catch (err) {
        console.warn('Search products failed:', err);
      } finally {
        setSearchingProducts(false);
      }
    }, query ? 400 : 0);
  }, [storeId]);

  const openProductModal = useCallback(() => {
    setProductModalOpen(true);
    setSelectedVariants({});
    if (productResults.length === 0) fetchProducts('');
  }, [productResults, fetchProducts]);

  const toggleVariant = (product, variant) => {
    setSelectedVariants(prev => {
      const copy = {...prev};
      if (copy[variant.id]) delete copy[variant.id];
      else copy[variant.id] = {product, variant};
      return copy;
    });
  };

  const toggleProduct = product => {
    setSelectedVariants(prev => {
      const copy = {...prev};
      const allSelected = product.variants.every(v => copy[v.id]);
      product.variants.forEach(v => {
        if (allSelected) delete copy[v.id];
        else copy[v.id] = {product, variant: v};
      });
      return copy;
    });
  };

  const addSelectedVariants = () => {
    Object.values(selectedVariants).forEach(({product, variant}) => addVariant(product, variant));
    setProductModalOpen(false);
    setSelectedVariants({});
    setProductQuery('');
  };

  const selectedCount = Object.keys(selectedVariants).length;

  // ── Customer modal search ──
  const fetchCustomers = useCallback(query => {
    setCustomerQuery(query);
    if (customerDebounce.current) clearTimeout(customerDebounce.current);
    customerDebounce.current = setTimeout(async () => {
      if (!storeId) return;
      setSearchingCustomers(true);
      try {
        const params = new URLSearchParams({storeId});
        if (query.trim()) params.set('query', query.trim());
        const res = await api(`/api/draft-orders/customers?${params}`);
        const result = await res.json();
        if (result.success) setCustomerResults(result.data.customers);
      } catch (err) {
        console.warn('Search customers failed:', err);
      } finally {
        setSearchingCustomers(false);
      }
    }, query ? 400 : 0);
  }, [storeId]);

  const openCustomerModal = useCallback(() => {
    setCustomerModalOpen(true);
    setShowNewCustomer(false);
    if (customerResults.length === 0) fetchCustomers('');
  }, [customerResults, fetchCustomers]);

  const selectCustomer = c => {
    setSelectedCustomer(c);
    setCustomerQuery('');
    setCustomerModalOpen(false);
    setShowNewCustomer(false);
  };
  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
  };

  // ── Line items ──
  const addVariant = (product, variant) => {
    const existing = lineItems.findIndex(i => i.variantId === variant.id);
    if (existing >= 0) {
      const updated = [...lineItems];
      updated[existing].quantity += 1;
      setLineItems(updated);
    } else {
      setLineItems(prev => [...prev, {
        variantId: variant.id,
        title: product.title,
        variantTitle: variant.title !== 'Default Title' ? variant.title : '',
        sku: variant.sku || '',
        price: variant.price,
        quantity: 1,
        image: variant.image || product.image || null
      }]);
    }
  };

  const addCustomItem = () => {
    setLineItems(prev => [...prev, {
      variantId: '', title: 'Custom item', variantTitle: '', sku: '',
      price: '0.00', quantity: 1, image: null, isCustom: true
    }]);
  };

  const updateItem = (idx, field, value) => {
    const updated = [...lineItems];
    updated[idx] = {...updated[idx], [field]: value};
    setLineItems(updated);
  };

  const removeItem = idx => setLineItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = lineItems.reduce(
    (sum, item) => sum + (parseFloat(item.price) || 0) * (item.quantity || 0), 0
  );
  const discountAmount = discountValue
    ? discountType === 'PERCENTAGE'
      ? subtotal * (parseFloat(discountValue) || 0) / 100
      : parseFloat(discountValue) || 0
    : 0;
  const shippingAmount = parseFloat(shippingPrice) || 0;
  const total = Math.max(0, subtotal - discountAmount + shippingAmount);

  // ── Save ──
  const handleSave = async () => {
    if (lineItems.length === 0) {
      setErrorMsg('Add at least one product or custom item');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const body = {
        storeId,
        lineItems: lineItems.map(item => {
          const li = item.variantId
            ? {variantId: item.variantId, quantity: item.quantity}
            : {title: item.title, originalUnitPrice: item.price, quantity: item.quantity};
          if (item.customAttributes?.length) {
            li.customAttributes = item.customAttributes.filter(a => a.value);
          }
          return li;
        }),
        note: note || undefined,
        tags: tags.length > 0 ? tags : undefined,
        customer: selectedCustomer?.email
          ? {email: selectedCustomer.email}
          : undefined,
        shippingAddress: selectedCustomer?.shippingAddress || undefined,
        appliedDiscount: discountValue ? {value: parseFloat(discountValue), valueType: discountType, title: discountTitle} : undefined,
        shippingLine: shippingPrice ? {price: shippingPrice, title: shippingTitle} : undefined,
        taxExempt
      };
      const url = isEdit ? `/api/draft-orders/${editOrderId}` : '/api/draft-orders';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await api(url, {method, body: JSON.stringify(body)});
      const result = await res.json();
      if (result.success) {
        if (result.data.invoiceUrl) setShareUrl(result.data.invoiceUrl);
        if (result.data.adminUrl) setAdminUrl(result.data.adminUrl);
        if (result.data.name) setOrderName(result.data.name);
        // After create, navigate to edit URL so F5 stays on this order
        if (!isEdit && result.data.id && onOrderCreated) {
          const numId = result.data.id.split('/').pop();
          onOrderCreated(numId, storeId);
        }
        setToastMsg(isEdit ? 'Draft order saved' : `${result.data.name} created`);
      } else {
        setErrorMsg(result.error || `Failed to ${isEdit ? 'update' : 'create'} draft order`);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const resetNewCustomerForm = () => {
    setShowNewCustomer(false);
    setNewCustomerEmail('');
    setNewCustomerFirst('');
    setNewCustomerLast('');
    setNewCustomerPhone('');
    setNewCustomerCompany('');
    setNewCustomerAddress({address1: '', city: '', province: '', country: '', zip: '', phone: ''});
  };

  // ── Loading ──
  if (loading) {
    return (
      <Page
        title={isEdit ? `Edit ${orderName}` : 'Create order'}
        backAction={{content: 'Draft orders', onAction: onBack}}
      >
        <Layout>
          <Layout.Section>
            <Card><SkeletonBodyText lines={12} /></Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const pageTitle = isEdit ? `Edit ${orderName || 'draft order'}` : 'Create order';

  return (
    <Page
      title={pageTitle}
      backAction={{content: 'Draft orders', onAction: onBack}}
      primaryAction={{
        content: isEdit ? 'Save' : 'Create order',
        onAction: handleSave,
        loading: saving,
        disabled: lineItems.length === 0
      }}
      secondaryActions={[
        ...(isEdit && shareUrl ? [{content: 'Share', icon: ShareIcon, onAction: () => setShareModalOpen(true)}] : []),
        ...(adminUrl ? [{content: 'View in Shopify', icon: ExternalIcon, url: adminUrl, external: true}] : [])
      ]}
    >
      {toastMsg && <Toast content={toastMsg} onDismiss={() => setToastMsg('')} />}
      {errorMsg && (
        <div style={{marginBottom: 16}}>
          <Banner tone="critical" onDismiss={() => setErrorMsg('')}>{errorMsg}</Banner>
        </div>
      )}

      <Layout>
        {/* ─── LEFT COLUMN ─── */}
        <Layout.Section>
          <Card>
            <Select label="Store" options={storeOptions} value={storeId} onChange={onStoreChange} />
          </Card>

          {/* Products */}
          <div style={{marginTop: 16}}>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h2">Products</Text>
                <InlineStack gap="200" blockAlign="end">
                  <div style={{flex: 1}}>
                    <TextField
                      placeholder="Search products"
                      prefix={<Icon source={SearchIcon} />}
                      autoComplete="off"
                      onFocus={openProductModal}
                      readOnly
                    />
                  </div>
                  <Button onClick={openProductModal}>Browse</Button>
                  <Button onClick={addCustomItem}>Add custom item</Button>
                </InlineStack>

                {lineItems.length > 0 && (
                  <>
                    <Divider />
                    {lineItems.map((item, idx) => (
                      <React.Fragment key={idx}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0',
                        borderBottom: idx < lineItems.length - 1 ? '1px solid var(--p-color-border-secondary)' : 'none'
                      }}>
                        <Thumbnail source={item.image || ImageIcon} alt={item.title} size="small" />
                        <div style={{flex: 1, minWidth: 0}}>
                          {item.isCustom ? (
                            <TextField value={item.title} onChange={val => updateItem(idx, 'title', val)}
                              autoComplete="off" labelHidden label="Name" placeholder="Item name" />
                          ) : (
                            <>
                              <Text variant="bodyMd" fontWeight="semibold" truncate>{item.title}</Text>
                              {item.variantTitle && <Text variant="bodySm" tone="subdued">{item.variantTitle}</Text>}
                              {item.sku && <Text variant="bodySm" tone="subdued">SKU: {item.sku}</Text>}
                            </>
                          )}
                        </div>
                        {item.isCustom ? (
                          <div style={{width: 100}}>
                            <TextField type="number" value={item.price}
                              onChange={val => updateItem(idx, 'price', val)}
                              prefix="$" autoComplete="off" labelHidden label="Price" />
                          </div>
                        ) : (
                          <Text variant="bodyMd" tone="subdued">{fmtMoney(item.price)}</Text>
                        )}
                        <div style={{width: 70}}>
                          <TextField type="number" min={1} value={String(item.quantity)}
                            onChange={val => updateItem(idx, 'quantity', Math.max(1, parseInt(val, 10) || 1))}
                            autoComplete="off" labelHidden label="Qty" />
                        </div>
                        <div style={{width: 70, textAlign: 'right'}}>
                          <Text variant="bodyMd" fontWeight="semibold">
                            {fmtMoney((parseFloat(item.price) || 0) * item.quantity)}
                          </Text>
                        </div>
                        <Button icon={DeleteIcon} variant="plain" tone="critical"
                          onClick={() => removeItem(idx)} accessibilityLabel="Remove" />
                      </div>
                      {fieldDefinitions.length > 0 && (
                        <div style={{paddingLeft: 52, paddingBottom: 8}}>
                          <InlineStack gap="200" wrap>
                            {fieldDefinitions.map(fd => {
                              const attrs = item.customAttributes || [];
                              const attr = attrs.find(a => a.key === fd.label);
                              const val = attr?.value || '';
                              return (
                                <div key={fd.key} style={{width: 180}}>
                                  <TextField
                                    label={fd.label}
                                    type={fd.inputType === 'number' ? 'number' : 'text'}
                                    multiline={fd.inputType === 'textarea' ? 2 : undefined}
                                    value={val}
                                    requiredIndicator={fd.required}
                                    onChange={v => {
                                      const updated = [...lineItems];
                                      const existing = updated[idx].customAttributes || fieldDefinitions.map(f => ({key: f.label, value: ''}));
                                      const ai = existing.findIndex(a => a.key === fd.label);
                                      if (ai >= 0) existing[ai] = {...existing[ai], value: v};
                                      else existing.push({key: fd.label, value: v});
                                      updated[idx] = {...updated[idx], customAttributes: existing};
                                      setLineItems(updated);
                                    }}
                                    autoComplete="off"
                                  />
                                </div>
                              );
                            })}
                          </InlineStack>
                        </div>
                      )}
                    </React.Fragment>
                    ))}
                  </>
                )}
              </BlockStack>
            </Card>
          </div>

          {/* Payment */}
          <div style={{marginTop: 16}}>
            <Card>
              <BlockStack gap="0">
                <Text variant="headingSm" as="h2">Payment</Text>
                <Box paddingBlockStart="300">
                  {/* Subtotal */}
                  <div style={{display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--p-color-border-secondary)'}}>
                    <Text variant="bodyMd">Subtotal</Text>
                    <InlineStack gap="800">
                      <Text variant="bodyMd" tone="subdued">
                        {lineItems.length > 0 ? `${lineItems.length} item${lineItems.length > 1 ? 's' : ''}` : ''}
                      </Text>
                      <Text variant="bodyMd">{fmtMoney(subtotal)}</Text>
                    </InlineStack>
                  </div>

                  {/* Discount */}
                  <div style={{padding: '8px 0', borderBottom: '1px solid var(--p-color-border-secondary)'}}>
                    {editingDiscount ? (
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="end">
                          <div style={{flex: 1}}>
                            <TextField label="Discount" type="number" value={discountValue}
                              onChange={setDiscountValue} autoComplete="off" prefix={discountType === 'FIXED_AMOUNT' ? '$' : undefined}
                              suffix={discountType === 'PERCENTAGE' ? '%' : undefined} />
                          </div>
                          <Select label="Type" options={[
                            {label: 'Fixed ($)', value: 'FIXED_AMOUNT'},
                            {label: 'Percentage (%)', value: 'PERCENTAGE'}
                          ]} value={discountType} onChange={setDiscountType} />
                        </InlineStack>
                        <TextField label="Reason" value={discountTitle} onChange={setDiscountTitle}
                          autoComplete="off" placeholder="Discount reason" />
                        <InlineStack gap="200">
                          <Button size="slim" variant="primary" onClick={() => setEditingDiscount(false)}>Done</Button>
                          <Button size="slim" onClick={() => { setDiscountValue(''); setEditingDiscount(false); }}>Remove</Button>
                        </InlineStack>
                      </BlockStack>
                    ) : (
                      <div style={{display: 'flex', justifyContent: 'space-between', cursor: 'pointer'}}
                        onClick={() => setEditingDiscount(true)}>
                        <InlineStack gap="100" blockAlign="center">
                          <Icon source={DiscountIcon} tone={discountAmount > 0 ? 'success' : 'subdued'} />
                          <Text variant="bodyMd" tone={discountAmount > 0 ? 'success' : 'subdued'}>
                            {discountAmount > 0 ? 'Edit discount' : 'Add discount'}
                          </Text>
                        </InlineStack>
                        <InlineStack gap="800">
                          <Text variant="bodyMd" tone="subdued">{discountAmount > 0 ? discountTitle : '\u2014'}</Text>
                          <Text variant="bodyMd">{discountAmount > 0 ? `-${fmtMoney(discountAmount)}` : fmtMoney(0)}</Text>
                        </InlineStack>
                      </div>
                    )}
                  </div>

                  {/* Shipping */}
                  <div style={{padding: '8px 0', borderBottom: '1px solid var(--p-color-border-secondary)'}}>
                    {editingShipping ? (
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="end">
                          <div style={{flex: 1}}>
                            <TextField label="Shipping rate name" value={shippingTitle}
                              onChange={setShippingTitle} autoComplete="off" placeholder="e.g. Standard Shipping" />
                          </div>
                          <div style={{width: 120}}>
                            <TextField label="Price" type="number" value={shippingPrice}
                              onChange={setShippingPrice} autoComplete="off" prefix="$" />
                          </div>
                        </InlineStack>
                        <InlineStack gap="200">
                          <Button size="slim" variant="primary" onClick={() => setEditingShipping(false)}>Done</Button>
                          <Button size="slim" onClick={() => { setShippingPrice(''); setEditingShipping(false); }}>Remove</Button>
                        </InlineStack>
                      </BlockStack>
                    ) : (
                      <div style={{display: 'flex', justifyContent: 'space-between', cursor: 'pointer'}}
                        onClick={() => setEditingShipping(true)}>
                        <InlineStack gap="100" blockAlign="center">
                          <Icon source={DeliveryIcon} tone={shippingAmount > 0 ? undefined : 'subdued'} />
                          <Text variant="bodyMd" tone={shippingAmount > 0 ? undefined : 'subdued'}>
                            {shippingAmount > 0 ? 'Edit shipping or delivery' : 'Add shipping or delivery'}
                          </Text>
                        </InlineStack>
                        <InlineStack gap="800">
                          <Text variant="bodyMd" tone="subdued">{shippingAmount > 0 ? shippingTitle : '\u2014'}</Text>
                          <Text variant="bodyMd">{fmtMoney(shippingAmount)}</Text>
                        </InlineStack>
                      </div>
                    )}
                  </div>

                  {/* Tax */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--p-color-border-secondary)'}}>
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={TaxIcon} tone="subdued" />
                      <Text variant="bodyMd">Estimated tax</Text>
                      <Checkbox label="Tax exempt" labelHidden checked={taxExempt}
                        onChange={setTaxExempt} />
                      {taxExempt && <Text variant="bodySm" tone="subdued">(exempt)</Text>}
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">{taxExempt ? '$0.00' : 'Not calculated'}</Text>
                  </div>

                  {/* Total */}
                  <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px'}}>
                    <Text variant="headingSm">Total</Text>
                    <Text variant="headingSm">{fmtMoney(total)}</Text>
                  </div>
                </Box>
                {lineItems.length === 0 && (
                  <Box paddingBlockStart="300" borderBlockStartWidth="025" borderColor="border">
                    <Text variant="bodySm" tone="subdued">
                      Add a product to calculate total and view payment options
                    </Text>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>

        {/* ─── RIGHT COLUMN ─── */}
        <Layout.Section variant="oneThird">
          {/* Notes */}
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingSm" as="h2">Notes</Text>
                {!editingNotes && (
                  <Button variant="plain" icon={EditIcon}
                    onClick={() => setEditingNotes(true)} accessibilityLabel="Edit notes" />
                )}
              </InlineStack>
              {editingNotes ? (
                <BlockStack gap="200">
                  <TextField label="Note" labelHidden value={note} onChange={setNote}
                    multiline={3} autoComplete="off" placeholder="Add a note" />
                  <InlineStack gap="200">
                    <Button size="slim" variant="primary" onClick={() => setEditingNotes(false)}>Done</Button>
                    <Button size="slim" onClick={() => setEditingNotes(false)}>Cancel</Button>
                  </InlineStack>
                </BlockStack>
              ) : (
                <Text variant="bodyMd" tone={note ? undefined : 'subdued'}>{note || 'No notes'}</Text>
              )}
            </BlockStack>
          </Card>

          {/* Customer */}
          <div style={{marginTop: 16}}>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h2">Customer</Text>
                {selectedCustomer ? (
                  <BlockStack gap="300">
                    <BlockStack gap="100">
                      <Button variant="plain" onClick={openCustomerModal} textAlign="left">
                        {selectedCustomer.name}
                      </Button>
                      <Text variant="bodySm" tone="subdued">
                        {selectedCustomer.ordersCount
                          ? `${selectedCustomer.ordersCount} order${selectedCustomer.ordersCount !== 1 ? 's' : ''}`
                          : 'No orders'}
                      </Text>
                    </BlockStack>
                    <Divider />
                    <BlockStack gap="100">
                      <Text variant="headingSm" as="h3">Contact information</Text>
                      <Text variant="bodySm">{selectedCustomer.email || 'No email'}</Text>
                      <Text variant="bodySm" tone="subdued">{selectedCustomer.phone || 'No phone number'}</Text>
                    </BlockStack>
                    {selectedCustomer.company && (
                      <>
                        <Divider />
                        <BlockStack gap="100">
                          <Text variant="headingSm" as="h3">Company</Text>
                          <Text variant="bodySm">{selectedCustomer.company}</Text>
                        </BlockStack>
                      </>
                    )}
                    {(selectedCustomer.shippingAddressFormatted || selectedCustomer.address) && (
                      <>
                        <Divider />
                        <BlockStack gap="100">
                          <Text variant="headingSm" as="h3">Shipping address</Text>
                          {selectedCustomer.shippingAddress ? (
                            <BlockStack gap="050">
                              {selectedCustomer.shippingAddress.address1 && (
                                <Text variant="bodySm">{selectedCustomer.shippingAddress.address1}</Text>
                              )}
                              <Text variant="bodySm">
                                {[selectedCustomer.shippingAddress.city, selectedCustomer.shippingAddress.province,
                                  selectedCustomer.shippingAddress.zip].filter(Boolean).join(' ')}
                              </Text>
                              {selectedCustomer.shippingAddress.country && (
                                <Text variant="bodySm">{selectedCustomer.shippingAddress.country}</Text>
                              )}
                              {selectedCustomer.shippingAddress.phone && (
                                <Text variant="bodySm">{selectedCustomer.shippingAddress.phone}</Text>
                              )}
                            </BlockStack>
                          ) : (
                            <Text variant="bodySm">{selectedCustomer.address}</Text>
                          )}
                        </BlockStack>
                      </>
                    )}
                    <Divider />
                    <Button variant="plain" tone="critical" onClick={clearCustomer} size="slim">
                      Remove customer
                    </Button>
                  </BlockStack>
                ) : (
                  <TextField label="Customer" labelHidden placeholder="Search or create a customer"
                    prefix={<Icon source={SearchIcon} />} autoComplete="off" readOnly onFocus={openCustomerModal} />
                )}
              </BlockStack>
            </Card>
          </div>

          {/* Tags */}
          <div style={{marginTop: 16}}>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h2">Tags</Text>
                {tags.length > 0 && (
                  <InlineStack gap="200" wrap>
                    {tags.map((tag, idx) => (
                      <Badge key={idx}>
                        <InlineStack gap="100" blockAlign="center">
                          <span>{tag}</span>
                          <span style={{cursor: 'pointer', marginLeft: 2}}
                            onClick={() => setTags(prev => prev.filter((_, i) => i !== idx))}>&times;</span>
                        </InlineStack>
                      </Badge>
                    ))}
                  </InlineStack>
                )}
                <TextField label="Tags" labelHidden value={tagInput} onChange={setTagInput}
                  autoComplete="off" placeholder="Add tags"
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                      e.preventDefault();
                      const newTag = tagInput.trim().replace(/,+$/, '');
                      if (newTag && !tags.includes(newTag)) setTags(prev => [...prev, newTag]);
                      setTagInput('');
                    }
                  }}
                  helpText="Press Enter or comma to add a tag"
                />
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>
      </Layout>

      {/* ─── Select Products Modal ─── */}
      <Modal
        open={productModalOpen}
        onClose={() => { setProductModalOpen(false); setSelectedVariants({}); setProductQuery(''); }}
        title="Select products"
        primaryAction={{content: 'Add', onAction: addSelectedVariants, disabled: selectedCount === 0}}
        secondaryActions={[{content: 'Cancel', onAction: () => { setProductModalOpen(false); setSelectedVariants({}); setProductQuery(''); }}]}
        large
      >
        <Modal.Section flush>
          <Box padding="300">
            <TextField placeholder="Search products" value={productQuery} onChange={fetchProducts}
              prefix={<Icon source={SearchIcon} />} autoComplete="off" clearButton
              onClearButtonClick={() => { setProductQuery(''); fetchProducts(''); }} />
          </Box>
          {searchingProducts && (
            <Box padding="400"><InlineStack align="center"><Spinner size="small" /></InlineStack></Box>
          )}
          <div style={{display: 'flex', padding: '8px 16px', borderBottom: '1px solid var(--p-color-border)', background: 'var(--p-color-bg-surface-secondary)'}}>
            <div style={{width: 36}} />
            <div style={{flex: 1}}><Text variant="bodySm" fontWeight="semibold">Product</Text></div>
            <div style={{width: 90, textAlign: 'right'}}><Text variant="bodySm" fontWeight="semibold">Available</Text></div>
            <div style={{width: 110, textAlign: 'right'}}><Text variant="bodySm" fontWeight="semibold">Price</Text></div>
          </div>
          <Scrollable style={{maxHeight: 400}}>
            {productResults.map(product => {
              const allSelected = product.variants.every(v => selectedVariants[v.id]);
              const someSelected = product.variants.some(v => selectedVariants[v.id]);
              return (
                <div key={product.id}>
                  <div style={{display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--p-color-border-secondary)', cursor: 'pointer'}}
                    onClick={() => toggleProduct(product)}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--p-color-bg-surface-hover)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{width: 36}}>
                      <Checkbox label="" labelHidden checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onChange={() => toggleProduct(product)} />
                    </div>
                    <Thumbnail source={product.image || ImageIcon} alt={product.title} size="small" />
                    <div style={{flex: 1, marginLeft: 12}}>
                      <Text variant="bodyMd" fontWeight="semibold">{product.title}</Text>
                    </div>
                  </div>
                  {product.variants.map(variant => (
                    <div key={variant.id} style={{display: 'flex', alignItems: 'center', padding: '8px 16px 8px 52px', borderBottom: '1px solid var(--p-color-border-secondary)', cursor: 'pointer'}}
                      onClick={() => toggleVariant(product, variant)}
                      onMouseOver={e => (e.currentTarget.style.background = 'var(--p-color-bg-surface-hover)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{width: 36}}>
                        <Checkbox label="" labelHidden checked={!!selectedVariants[variant.id]}
                          onChange={() => toggleVariant(product, variant)} />
                      </div>
                      <div style={{flex: 1}}>
                        <Text variant="bodyMd">{variant.title !== 'Default Title' ? variant.title : product.title}</Text>
                      </div>
                      <div style={{width: 90, textAlign: 'right'}}>
                        <Text variant="bodyMd" tone={variant.inventoryQuantity > 0 ? undefined : 'caution'}>
                          {variant.inventoryQuantity ?? '\u2014'}
                        </Text>
                      </div>
                      <div style={{width: 110, textAlign: 'right'}}>
                        <Text variant="bodyMd">{fmtMoney(variant.price)}</Text>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {!searchingProducts && productResults.length === 0 && productQuery && (
              <Box padding="400"><Text variant="bodyMd" tone="subdued" alignment="center">No products found</Text></Box>
            )}
          </Scrollable>
          <div style={{padding: '12px 16px', borderTop: '1px solid var(--p-color-border)'}}>
            <Text variant="bodySm" tone="subdued">{selectedCount}/500 variants selected</Text>
          </div>
        </Modal.Section>
      </Modal>

      {/* ─── Select Customer Modal ─── */}
      <Modal
        open={customerModalOpen}
        onClose={() => { setCustomerModalOpen(false); setShowNewCustomer(false); setCustomerQuery(''); }}
        title={showNewCustomer ? 'Create a new customer' : 'Select customer'}
        primaryAction={showNewCustomer ? {
          content: 'Add customer',
          disabled: !newCustomerEmail.trim() || !newCustomerEmail.includes('@'),
          onAction: () => {
            const addr = newCustomerAddress;
            const shippingAddr = [addr.address1, addr.city, addr.province, addr.zip, addr.country].filter(Boolean).join(', ');
            selectCustomer({
              name: [newCustomerFirst, newCustomerLast].filter(Boolean).join(' ') || newCustomerEmail,
              email: newCustomerEmail.trim(),
              phone: newCustomerPhone,
              company: newCustomerCompany,
              shippingAddress: shippingAddr ? addr : null,
              shippingAddressFormatted: shippingAddr
            });
            resetNewCustomerForm();
          }
        } : undefined}
        secondaryActions={showNewCustomer
          ? [{content: 'Back', onAction: resetNewCustomerForm}]
          : [{content: 'Cancel', onAction: () => { setCustomerModalOpen(false); setCustomerQuery(''); }}]}
        large
      >
        {showNewCustomer ? (
          <Modal.Section>
            <BlockStack gap="400">
              <TextField label="Email" type="email" value={newCustomerEmail}
                onChange={setNewCustomerEmail} autoComplete="off" placeholder="email@example.com" requiredIndicator />
              <InlineStack gap="300">
                <div style={{flex: 1}}>
                  <TextField label="First name" value={newCustomerFirst} onChange={setNewCustomerFirst} autoComplete="off" />
                </div>
                <div style={{flex: 1}}>
                  <TextField label="Last name" value={newCustomerLast} onChange={setNewCustomerLast} autoComplete="off" />
                </div>
              </InlineStack>
              <TextField label="Phone" type="tel" value={newCustomerPhone} onChange={setNewCustomerPhone}
                autoComplete="off" placeholder="+1 000-000-0000" />
              <TextField label="Company" value={newCustomerCompany} onChange={setNewCustomerCompany} autoComplete="off" />
              <Divider />
              <Text variant="headingSm">Shipping address</Text>
              <TextField label="Address" value={newCustomerAddress.address1}
                onChange={v => setNewCustomerAddress(p => ({...p, address1: v}))} autoComplete="off" />
              <InlineStack gap="300">
                <div style={{flex: 1}}>
                  <TextField label="City" value={newCustomerAddress.city}
                    onChange={v => setNewCustomerAddress(p => ({...p, city: v}))} autoComplete="off" />
                </div>
                <div style={{flex: 1}}>
                  <TextField label="Province / State" value={newCustomerAddress.province}
                    onChange={v => setNewCustomerAddress(p => ({...p, province: v}))} autoComplete="off" />
                </div>
              </InlineStack>
              <InlineStack gap="300">
                <div style={{flex: 1}}>
                  <TextField label="ZIP / Postal code" value={newCustomerAddress.zip}
                    onChange={v => setNewCustomerAddress(p => ({...p, zip: v}))} autoComplete="off" />
                </div>
                <div style={{flex: 1}}>
                  <TextField label="Country" value={newCustomerAddress.country}
                    onChange={v => setNewCustomerAddress(p => ({...p, country: v}))} autoComplete="off" />
                </div>
              </InlineStack>
              <TextField label="Phone (shipping)" type="tel" value={newCustomerAddress.phone}
                onChange={v => setNewCustomerAddress(p => ({...p, phone: v}))} autoComplete="off" />
            </BlockStack>
          </Modal.Section>
        ) : (
          <Modal.Section flush>
            <Box padding="300" borderBlockEndWidth="025" borderColor="border">
              <TextField placeholder="Search customers" value={customerQuery} onChange={fetchCustomers}
                prefix={<Icon source={SearchIcon} />} autoComplete="off" clearButton
                onClearButtonClick={() => { setCustomerQuery(''); fetchCustomers(''); }} />
            </Box>
            {searchingCustomers && (
              <Box padding="300"><InlineStack align="center"><Spinner size="small" /></InlineStack></Box>
            )}
            <Scrollable style={{maxHeight: 400}}>
              <div onClick={() => setShowNewCustomer(true)}
                style={{display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--p-color-border)'}}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--p-color-bg-surface-hover)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={PlusIcon} />
                  <Text variant="bodyMd">Create a new customer</Text>
                </InlineStack>
              </div>
              {customerResults.map(customer => (
                <div key={customer.email || customer.id} onClick={() => selectCustomer(customer)}
                  style={{display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--p-color-border-secondary)'}}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--p-color-bg-surface-hover)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{flex: 1}}>
                    <Text variant="bodyMd" fontWeight="semibold">{customer.name}</Text>
                    <Text variant="bodySm" tone="subdued">{customer.email}</Text>
                  </div>
                  {customer.ordersCount > 0 && (
                    <Text variant="bodySm" tone="subdued">
                      {customer.ordersCount} order{customer.ordersCount !== 1 ? 's' : ''}
                    </Text>
                  )}
                </div>
              ))}
              {!searchingCustomers && customerResults.length === 0 && customerQuery && (
                <Box padding="400">
                  <Text variant="bodyMd" tone="subdued" alignment="center">No customers found for "{customerQuery}"</Text>
                </Box>
              )}
            </Scrollable>
          </Modal.Section>
        )}
      </Modal>

      {/* ─── Share Modal ─── */}
      <Modal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share draft order"
        primaryAction={{content: 'Done', onAction: () => setShareModalOpen(false)}}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text variant="bodySm" tone="subdued">
              Share this link with your customer so they can complete checkout and pay for their order.
            </Text>
            <InlineStack gap="200" blockAlign="end">
              <div style={{flex: 1}}>
                <TextField label="Invoice link" value={shareUrl} readOnly autoComplete="off" selectTextOnFocus />
              </div>
              <Button icon={ClipboardIcon} onClick={handleCopyShareUrl}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
