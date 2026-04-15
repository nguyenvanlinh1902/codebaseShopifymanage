/* eslint-disable react/prop-types */
import React, {useState, useEffect, useMemo} from 'react';
import {
  Modal,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Badge,
  Thumbnail,
  Icon,
  Banner,
  Select,
  Collapsible,
  Checkbox
} from '@shopify/polaris';
import {
  SearchIcon,
  ImageIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  QuestionCircleIcon
} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

export default function ProductAddVariantModal({open, onClose, product, productId, storeId, onSaved}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [imageUrl, setImageUrl] = useState('');
  const [optionValues, setOptionValues] = useState({});
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [chargeTax, setChargeTax] = useState(true);
  const [costPerItem, setCostPerItem] = useState('');
  const [inventoryTracked, setInventoryTracked] = useState(true);
  const [inventory, setInventory] = useState({});
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sellOutOfStock, setSellOutOfStock] = useState(false);
  const [physical, setPhysical] = useState(true);
  const [weight, setWeight] = useState('0.0');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [showPricingExtra, setShowPricingExtra] = useState(false);
  const [showInventoryExtra, setShowInventoryExtra] = useState(false);
  const [showShippingExtra, setShowShippingExtra] = useState(false);
  const [variantSearch, setVariantSearch] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      const firstVariant = product?.variants?.[0];
      if (firstVariant?.price) setPrice(firstVariant.price);
      if (firstVariant?.cost) setCostPerItem(firstVariant.cost);
    }
  }, [open, product]);

  const options = product?.options || [];
  const variantList = product?.variants || [];
  const locations = useMemo(() => {
    const seen = new Map();
    variantList.forEach(v => {
      v.inventoryItem?.inventoryLevels?.nodes?.forEach(n => {
        if (n.location?.id && !seen.has(n.location.id)) seen.set(n.location.id, n.location.name);
      });
    });
    return Array.from(seen.entries()).map(([id, name]) => ({id, name}));
  }, [variantList]);

  const filteredVariants = variantList.filter(v => {
    if (!variantSearch) return true;
    const label = (v.selectedOptions || []).map(o => o.value).join(' / ').toLowerCase();
    return label.includes(variantSearch.toLowerCase()) || (v.sku || '').toLowerCase().includes(variantSearch.toLowerCase());
  });

  const priceNum = parseFloat(price) || 0;
  const costNum = parseFloat(costPerItem) || 0;
  const profit = Math.max(priceNum - costNum, 0);
  const margin = priceNum > 0 ? Math.round(((priceNum - costNum) / priceNum) * 100) : 0;

  const handleSave = async () => {
    setError('');
    const missing = options.find(o => !optionValues[o.name]);
    if (missing) { setError(`Please provide a value for ${missing.name}`); return; }
    if (!price) { setError('Price is required'); return; }

    try {
      setSaving(true);
      const body = {
        storeId,
        variant: {
          optionValues: options.map(o => ({optionName: o.name, name: optionValues[o.name]})),
          price: String(price),
          compareAtPrice: compareAtPrice ? String(compareAtPrice) : undefined,
          sku,
          barcode,
          inventoryPolicy: sellOutOfStock ? 'CONTINUE' : 'DENY',
          inventoryItem: {tracked: inventoryTracked, sku, cost: costPerItem ? String(costPerItem) : undefined},
          taxable: chargeTax,
          requiresShipping: physical,
          weight: parseFloat(weight) || 0,
          weightUnit: weightUnit.toUpperCase(),
          imageSrc: imageUrl || undefined,
          inventoryQuantities: Object.entries(inventory).map(([locationId, available]) => ({
            locationId,
            availableQuantity: parseInt(available, 10) || 0
          }))
        }
      };
      const res = await api(`/api/shopify-products/${productId}/variants`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const result = await res.json().catch(() => ({success: false, error: `Request failed (${res.status})`}));
      if (!result.success) throw new Error(result.error || 'Failed to add variant');
      onSaved?.(result.data);
      onClose?.();
    } catch (e) {
      setError(e.message || 'Failed to add variant');
    } finally {
      setSaving(false);
    }
  };

  const variantCount = variantList.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add variant"
      size="large"
      primaryAction={{content: 'Save variant', onAction: handleSave, loading: saving}}
      secondaryActions={[{content: 'Cancel', onAction: onClose}]}
    >
      <Modal.Section>
        {error && <div style={{marginBottom: 12}}><Banner tone="critical" onDismiss={() => setError('')}>{error}</Banner></div>}
        <div className="pav-grid">
          {/* LEFT — product + variant list */}
          <div className="pav-left">
            <Card>
              <InlineStack gap="300" blockAlign="start" wrap={false}>
                <Thumbnail source={product?.media?.[0]?.url || product?.media?.[0]?.image?.url || ImageIcon} alt={product?.title || ''} size="small" />
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="semibold">{product?.title}</Text>
                  <InlineStack gap="150" blockAlign="center">
                    <Badge tone={product?.status === 'ACTIVE' ? 'success' : 'info'}>
                      {product?.status === 'ACTIVE' ? 'Active' : product?.status || 'Draft'}
                    </Badge>
                    <Text variant="bodySm" tone="subdued">{variantCount} variants</Text>
                  </InlineStack>
                </BlockStack>
              </InlineStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <TextField
                  label="Search variants"
                  labelHidden
                  placeholder="Search variants"
                  prefix={<Icon source={SearchIcon} />}
                  value={variantSearch}
                  onChange={setVariantSearch}
                  autoComplete="off"
                />
                <InlineStack gap="150">
                  {options.map(o => (
                    <Button key={o.name} disclosure size="slim" variant="tertiary">{o.name}</Button>
                  ))}
                </InlineStack>
                <Text variant="bodySm" tone="subdued">{variantCount} variants</Text>
                <div className="pav-variant-list">
                  {filteredVariants.map(v => {
                    const label = (v.selectedOptions || []).map(o => o.value).join(' / ');
                    return (
                      <div key={v.id} className="pav-variant-item">
                        <Thumbnail source={v.image?.url || ImageIcon} alt={label} size="small" />
                        <Text variant="bodySm">{label}</Text>
                      </div>
                    );
                  })}
                </div>
              </BlockStack>
            </Card>
          </div>

          {/* RIGHT — form */}
          <div className="pav-right">
            <Card>
              <BlockStack gap="300">
                <div className="pav-image-slot">
                  <button type="button" className="pav-image-btn" onClick={() => {
                    const url = window.prompt('Image URL');
                    if (url) setImageUrl(url);
                  }}>
                    {imageUrl ? <img src={imageUrl} alt="" /> : <PlusIcon />}
                  </button>
                </div>
                {options.map(o => (
                  <TextField
                    key={o.name}
                    label={o.name}
                    value={optionValues[o.name] || ''}
                    onChange={v => setOptionValues(prev => ({...prev, [o.name]: v}))}
                    autoComplete="off"
                  />
                ))}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">Price</Text>
                <TextField
                  label="Price"
                  labelHidden
                  type="number"
                  prefix="$"
                  value={price}
                  onChange={setPrice}
                  autoComplete="off"
                />
                {showPricingExtra ? (
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodyMd" fontWeight="medium">Additional display prices</Text>
                      <Button variant="tertiary" icon={ChevronUpIcon} accessibilityLabel="Hide pricing details" onClick={() => setShowPricingExtra(false)} />
                    </InlineStack>
                    <InlineStack gap="300" wrap={false}>
                      <div style={{flex: 1}}>
                        <TextField
                          label={
                            <InlineStack gap="100" blockAlign="center">
                              <span>Compare-at price</span>
                              <Icon source={QuestionCircleIcon} tone="subdued" />
                            </InlineStack>
                          }
                          type="number"
                          prefix="$"
                          value={compareAtPrice}
                          onChange={setCompareAtPrice}
                          placeholder="0.00"
                          autoComplete="off"
                        />
                      </div>
                      <div style={{flex: 1}}>
                        <Select
                          label="Unit price"
                          options={[
                            {label: '--', value: ''},
                            {label: 'per each', value: 'each'},
                            {label: 'per 100 g', value: '100g'}
                          ]}
                          value={unitPrice}
                          onChange={setUnitPrice}
                        />
                      </div>
                    </InlineStack>
                    <Checkbox label="Charge tax on this variant" checked={chargeTax} onChange={setChargeTax} />
                    <InlineStack gap="200" wrap>
                      <Badge>Cost <strong>${costPerItem || '0.00'}</strong></Badge>
                      <Badge>Profit <strong>${profit.toFixed(2)}</strong></Badge>
                      <Badge>Margin <strong>{margin}%</strong></Badge>
                    </InlineStack>
                  </BlockStack>
                ) : (
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="150" wrap>
                      <button type="button" className="pav-badge-btn" onClick={() => setShowPricingExtra(true)}>Compare-at</button>
                      <button type="button" className="pav-badge-btn" onClick={() => setShowPricingExtra(true)}>Unit price</button>
                      <button type="button" className="pav-badge-btn" onClick={() => setShowPricingExtra(true)}>Charge tax <strong>{chargeTax ? 'Yes' : 'No'}</strong></button>
                      <button type="button" className="pav-badge-btn" onClick={() => setShowPricingExtra(true)}>Cost per item <strong>${costPerItem || price || '0.00'}</strong></button>
                    </InlineStack>
                    <Button variant="tertiary" icon={ChevronDownIcon} accessibilityLabel="Show pricing details" onClick={() => setShowPricingExtra(true)} />
                  </InlineStack>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">Inventory</Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm" tone="subdued">Inventory tracked</Text>
                    <button
                      type="button"
                      className={`pav-switch ${inventoryTracked ? 'on' : ''}`}
                      onClick={() => setInventoryTracked(v => !v)}
                      aria-label="Inventory tracked"
                    ><span /></button>
                  </InlineStack>
                </InlineStack>
                <div className="pav-inv-table">
                  <div className="pav-inv-head">
                    <span>Quantity</span>
                    <span style={{justifySelf: 'end'}}>Quantity</span>
                  </div>
                  {locations.length === 0 ? (
                    <Text variant="bodySm" tone="subdued">No locations configured.</Text>
                  ) : locations.map(loc => (
                    <div key={loc.id} className="pav-inv-row">
                      <span>{loc.name}</span>
                      <TextField
                        label={loc.name}
                        labelHidden
                        type="number"
                        value={String(inventory[loc.id] ?? '0')}
                        onChange={val => setInventory(prev => ({...prev, [loc.id]: val}))}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>
                <InlineStack gap="200" blockAlign="center" align="space-between">
                  <InlineStack gap="150" wrap>
                    <button type="button" className="pav-badge-btn" onClick={() => setShowInventoryExtra(v => !v)}>SKU</button>
                    <button type="button" className="pav-badge-btn" onClick={() => setShowInventoryExtra(v => !v)}>Barcode</button>
                    <button type="button" className="pav-badge-btn" onClick={() => setShowInventoryExtra(v => !v)}>Sell when out of stock <strong>{sellOutOfStock ? 'On' : 'Off'}</strong></button>
                  </InlineStack>
                  <Button variant="tertiary" icon={showInventoryExtra ? ChevronUpIcon : ChevronDownIcon} accessibilityLabel="Toggle inventory details" onClick={() => setShowInventoryExtra(v => !v)} />
                </InlineStack>
                <Collapsible open={showInventoryExtra} id="pav-inv-extra">
                  <BlockStack gap="200">
                    <TextField label="SKU" value={sku} onChange={setSku} autoComplete="off" />
                    <TextField label="Barcode" value={barcode} onChange={setBarcode} autoComplete="off" />
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="bodySm">Sell when out of stock</Text>
                      <button type="button" className={`pav-switch ${sellOutOfStock ? 'on' : ''}`} onClick={() => setSellOutOfStock(v => !v)} aria-label="Sell when out of stock"><span /></button>
                    </InlineStack>
                  </BlockStack>
                </Collapsible>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingSm" as="h3">Shipping</Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="bodySm" tone="subdued">Physical product</Text>
                    <button type="button" className={`pav-switch ${physical ? 'on' : ''}`} onClick={() => setPhysical(v => !v)} aria-label="Physical product"><span /></button>
                  </InlineStack>
                </InlineStack>
                <InlineStack gap="300" wrap={false}>
                  <div style={{flex: 2}}>
                    <Select
                      label="Package"
                      options={[{label: 'Store default · Sample box — 8.6 × 5.4 × 1.6 in, 0 lb', value: 'default'}]}
                      value="default"
                      onChange={() => {}}
                    />
                  </div>
                  <div style={{flex: 1}}>
                    <InlineStack gap="100" blockAlign="end" wrap={false}>
                      <TextField
                        label="Product weight"
                        type="number"
                        value={weight}
                        onChange={setWeight}
                        autoComplete="off"
                      />
                      <div style={{minWidth: 60}}>
                        <Select
                          label="Unit"
                          labelHidden
                          options={[{label: 'lb', value: 'lb'}, {label: 'kg', value: 'kg'}, {label: 'g', value: 'g'}, {label: 'oz', value: 'oz'}]}
                          value={weightUnit}
                          onChange={setWeightUnit}
                        />
                      </div>
                    </InlineStack>
                  </div>
                </InlineStack>
                <InlineStack gap="200" blockAlign="center" align="space-between">
                  <InlineStack gap="150" wrap>
                    <button type="button" className="pav-badge-btn" onClick={() => setShowShippingExtra(v => !v)}>Country of origin</button>
                    <button type="button" className="pav-badge-btn" onClick={() => setShowShippingExtra(v => !v)}>HS Code</button>
                  </InlineStack>
                  <Button variant="tertiary" icon={showShippingExtra ? ChevronUpIcon : ChevronDownIcon} accessibilityLabel="Toggle shipping details" onClick={() => setShowShippingExtra(v => !v)} />
                </InlineStack>
              </BlockStack>
            </Card>
          </div>
        </div>

        <style>{`
          .pav-grid {
            display: grid;
            grid-template-columns: minmax(220px, 280px) 1fr;
            gap: 16px;
          }
          .pav-left { display: flex; flex-direction: column; gap: 12px; }
          .pav-right { display: flex; flex-direction: column; gap: 12px; }
          .pav-variant-list { display: flex; flex-direction: column; max-height: 360px; overflow-y: auto; }
          .pav-variant-item {
            display: flex; gap: 10px; align-items: center;
            padding: 6px; border-radius: 6px; cursor: pointer;
          }
          .pav-variant-item:hover { background: var(--p-color-bg-surface-hover); }
          .pav-image-slot { width: 80px; height: 80px; }
          .pav-image-btn {
            width: 100%; height: 100%;
            border: 1.5px dashed var(--p-color-border);
            border-radius: 10px;
            background: transparent;
            display: flex; align-items: center; justify-content: center;
            color: var(--p-color-icon-subdued);
            cursor: pointer; overflow: hidden;
          }
          .pav-image-btn:hover { border-color: var(--p-color-border-hover); }
          .pav-image-btn svg { width: 20px; height: 20px; }
          .pav-image-btn img { width: 100%; height: 100%; object-fit: cover; }
          .pav-switch {
            width: 36px; height: 20px;
            background: #bdbec0;
            border: 0; border-radius: 999px;
            position: relative; cursor: pointer;
            transition: background .15s;
          }
          .pav-switch.on { background: #008060; }
          .pav-switch span {
            position: absolute; top: 2px; left: 2px;
            width: 16px; height: 16px;
            background: #fff; border-radius: 50%;
            transition: left .15s;
          }
          .pav-switch.on span { left: 18px; }
          .pav-inv-table { display: flex; flex-direction: column; gap: 6px; }
          .pav-inv-head {
            display: grid; grid-template-columns: 1fr 140px; gap: 12px;
            background: var(--p-color-bg-surface-secondary);
            padding: 8px 12px; border-radius: 6px;
            font-size: 12px; color: var(--p-color-text-subdued);
          }
          .pav-inv-row {
            display: grid; grid-template-columns: 1fr 140px; gap: 12px;
            align-items: center; padding: 4px 12px;
          }
          .pav-badge-btn {
            all: unset;
            display: inline-flex; align-items: center; gap: 4px;
            background: var(--p-color-bg-fill-tertiary, #e3e5e7);
            border-radius: 6px;
            padding: 3px 10px;
            font-size: 12px;
            color: var(--p-color-text);
            cursor: pointer;
            transition: background .12s;
          }
          .pav-badge-btn:hover { background: #d7d9dc; }
          .pav-badge-btn strong {
            background: var(--p-color-bg-surface);
            padding: 1px 6px; border-radius: 4px; font-weight: 500;
          }
        `}</style>
      </Modal.Section>
    </Modal>
  );
}
