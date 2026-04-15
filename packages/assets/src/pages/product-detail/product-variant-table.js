/* eslint-disable react/prop-types */
import React, {useState, useEffect, useRef} from 'react';
import {BlockStack, InlineStack, TextField, Text, Button, Thumbnail, Popover, ActionList, Checkbox, Modal, EmptyState} from '@shopify/polaris';
import {ChevronDownIcon, ChevronRightIcon, ImageIcon, EditIcon, MenuHorizontalIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

function priceRange(variants) {
  const prices = variants.map(v => parseFloat(v.price) || 0).filter(p => !isNaN(p));
  if (!prices.length) return '0.00';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? min.toFixed(2) : `${min.toFixed(2)} – ${max.toFixed(2)}`;
}

function totalAvailable(variants, locationId) {
  return variants.reduce((sum, v) => {
    if (locationId) {
      const q = parseInt(v.inventory?.[locationId], 10);
      return sum + (isNaN(q) ? 0 : q);
    }
    const all = Object.values(v.inventory || {}).reduce((s, qty) => {
      const n = parseInt(qty, 10);
      return s + (isNaN(n) ? 0 : n);
    }, 0);
    return sum + all;
  }, 0);
}

function isStockedAt(variants, locationId) {
  if (!locationId) return true;
  return variants.some(v => v.inventory && Object.prototype.hasOwnProperty.call(v.inventory, locationId));
}

export default function ProductVariantTable({variants, options, media = [], onVariantChange, storeId, productId}) {
  const [locations, setLocations] = useState([]);
  const [activeLocationId, setActiveLocationId] = useState(null);
  const [locationPopoverOpen, setLocationPopoverOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);
  const [groupByKey, setGroupByKey] = useState(null);
  const [groupByPopoverOpen, setGroupByPopoverOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [morePopoverOpen, setMorePopoverOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkField, setBulkField] = useState(null); // {field, label, type, prefix, suffix}
  const [bulkValues, setBulkValues] = useState({}); // {variantIndex: value}
  const [bulkApplyAll, setBulkApplyAll] = useState('');
  const [bulkSearch, setBulkSearch] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerSearch, setImagePickerSearch] = useState('');
  const [imagePickerSelected, setImagePickerSelected] = useState(null);
  const locationsRef = useRef(null);

  useEffect(() => {
    if (!storeId || locationsRef.current) return;
    api(`/api/shopify-products/locations?storeId=${storeId}`)
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          const locs = result.data || [];
          locationsRef.current = locs;
          setLocations(locs);
          if (locs[0]) setActiveLocationId(locs[0].id);
        }
      })
      .catch(() => {});
  }, [storeId]);

  const handleInventoryBlur = async (variant, locationId, qty) => {
    if (!variant.id || !locationId || !variant.inventoryItemId) return;
    try {
      await api(`/api/shopify-products/${productId}/inventory`, {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          inventoryItemId: variant.inventoryItemId,
          locationId,
          quantity: parseInt(qty, 10) || 0
        })
      });
    } catch { /* silent */ }
  };

  const effectiveGroupKey = groupByKey === '__none__' ? null : (groupByKey || options[0]?.name);
  const groupKey = effectiveGroupKey;
  const groups = {};
  variants.forEach((v, i) => {
    const key = groupKey ? v.optionValues?.[groupKey] || 'Default' : 'All';
    if (!groups[key]) groups[key] = [];
    groups[key].push({...v, _index: i});
  });
  const hasGroups = !!groupKey && Object.keys(groups).length > 1;

  const toggleGroup = k => setExpanded(prev => ({...prev, [k]: !prev[k]}));

  const variantLabel = v =>
    options.map(o => v.optionValues?.[o.name]).filter(Boolean).join(' / ') || '—';

  const activeLocation = locations.find(l => l.id === activeLocationId);
  const stockedHere = isStockedAt(variants, activeLocationId);

  const handleLocationChange = locId => {
    setLocationLoading(true);
    setActiveLocationId(locId);
    setLocationPopoverOpen(false);
    // Brief loading state for UX feedback; inventory data is already in variants from initial fetch
    setTimeout(() => setLocationLoading(false), 250);
  };

  const toggleOne = idx => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(idx)) n.delete(idx); else n.add(idx);
    return n;
  });
  const toggleGroupSelect = gVariants => setSelected(prev => {
    const n = new Set(prev);
    const allIn = gVariants.every(v => n.has(v._index));
    gVariants.forEach(v => { allIn ? n.delete(v._index) : n.add(v._index); });
    return n;
  });
  const toggleAll = () => setSelected(prev => {
    if (prev.size === variants.length) return new Set();
    return new Set(variants.map((_, i) => i));
  });
  const clearSelection = () => setSelected(new Set());

  const getFieldValue = (variant, field) => {
    if (!variant) return '';
    if (field.startsWith('inventory.')) {
      const locId = field.split('.')[1];
      return String(variant.inventory?.[locId] ?? '');
    }
    return String(variant[field] ?? '');
  };

  const openBulkField = preset => {
    setBulkField(preset);
    const field = typeof preset.field === 'function' ? preset.field() : preset.field;
    const initial = {};
    selected.forEach(idx => {
      initial[idx] = getFieldValue(variants[idx], field);
    });
    setBulkValues(initial);
    setBulkApplyAll('');
    setBulkSearch('');
    setBulkEditOpen(true);
    setMorePopoverOpen(false);
  };

  const applyBulkEdit = () => {
    if (!bulkField) return;
    const field = typeof bulkField.field === 'function' ? bulkField.field() : bulkField.field;
    if (!field) return;
    Object.entries(bulkValues).forEach(([idx, val]) => {
      onVariantChange(Number(idx), field, val);
    });
    setBulkEditOpen(false);
    setBulkField(null);
    setBulkValues({});
    setBulkApplyAll('');
  };

  const applyBulkToAll = () => {
    const next = {};
    Object.keys(bulkValues).forEach(idx => { next[idx] = bulkApplyAll; });
    setBulkValues(next);
  };

  const applyDirect = (field, value) => {
    selected.forEach(idx => onVariantChange(idx, field, value));
    setMorePopoverOpen(false);
  };

  // Detect current bulk state across selected variants
  const selectedVariants = Array.from(selected).map(i => variants[i]).filter(Boolean);
  const allHaveImage = selectedVariants.length > 0 && selectedVariants.every(v => v.image?.url);
  const allContinueSelling = selectedVariants.length > 0 && selectedVariants.every(v => v.inventoryPolicy === 'CONTINUE');
  const allStopSelling = selectedVariants.length > 0 && selectedVariants.every(v => !v.inventoryPolicy || v.inventoryPolicy === 'DENY');

  const deleteSelected = () => {
    if (!window.confirm(`Delete ${selected.size} variant(s)?`)) return;
    Array.from(selected)
      .sort((a, b) => b - a)
      .forEach(idx => onVariantChange(idx, '_delete', true));
    clearSelection();
    setMorePopoverOpen(false);
  };

  const bulkMenuItems = [
    {content: 'Edit prices', onAction: () => openBulkField({field: 'price', label: 'Price', type: 'number', prefix: '$'})},
    {content: 'Edit quantities', disabled: !activeLocationId, onAction: () => openBulkField({field: `inventory.${activeLocationId}`, label: `Quantity${activeLocation ? ` · ${activeLocation.name}` : ''}`, type: 'number'})},
    {content: 'Edit SKUs', onAction: () => openBulkField({field: 'sku', label: 'SKU', type: 'text'})},
    {content: 'Edit barcodes', onAction: () => openBulkField({field: 'barcode', label: 'Barcode', type: 'text'})},
    {content: 'Edit package', onAction: () => openBulkField({field: 'weight', label: 'Package weight', type: 'number', suffix: 'kg'})},
    {content: 'Edit weight', onAction: () => openBulkField({field: 'weight', label: 'Weight', type: 'number', suffix: 'kg'})},
    {content: 'Edit country/region of origin', onAction: () => openBulkField({field: 'countryOfOrigin', label: 'Country/region of origin', type: 'text'})},
    {content: 'Edit images', onAction: () => { setImagePickerSelected(null); setImagePickerSearch(''); setImagePickerOpen(true); setMorePopoverOpen(false); }},
    {content: 'Remove images', disabled: !allHaveImage, onAction: () => applyDirect('image', null)},
    {content: 'Delete variants', destructive: true, onAction: deleteSelected},
    {content: 'Continue selling when out of stock', disabled: allContinueSelling, onAction: () => applyDirect('inventoryPolicy', 'CONTINUE')},
    {content: 'Stop selling when out of stock', disabled: allStopSelling, onAction: () => applyDirect('inventoryPolicy', 'DENY')}
  ];

  const hasSelection = selected.size > 0;
  const allSelected = selected.size === variants.length && variants.length > 0;

  return (
    <BlockStack gap="200">
      <InlineStack align="space-between" blockAlign="center">
        <InlineStack gap="200" blockAlign="center">
          <Text variant="bodyMd" tone="subdued" as="span">Group by</Text>
          <Popover
            active={groupByPopoverOpen}
            onClose={() => setGroupByPopoverOpen(false)}
            activator={
              <Button
                disclosure
                onClick={() => setGroupByPopoverOpen(o => !o)}
                disabled={options.length === 0}
              >
                {groupKey || 'None'}
              </Button>
            }
          >
            <ActionList
              items={[
                ...options.map(o => ({
                  content: o.name || '(unnamed)',
                  onAction: () => {
                    setGroupByKey(o.name);
                    setGroupByPopoverOpen(false);
                    setExpanded({});
                  }
                })),
                {
                  content: 'None',
                  onAction: () => {
                    setGroupByKey('__none__');
                    setGroupByPopoverOpen(false);
                  }
                }
              ]}
            />
          </Popover>
        </InlineStack>
        <Popover
          active={locationPopoverOpen}
          onClose={() => setLocationPopoverOpen(false)}
          activator={
            <Button
              disclosure
              onClick={() => setLocationPopoverOpen(o => !o)}
              disabled={locations.length === 0}
            >
              {activeLocation?.name || 'All locations'}
            </Button>
          }
        >
          <ActionList
            items={[
              {content: 'All locations', onAction: () => handleLocationChange(null)},
              ...locations.map(loc => ({
                content: loc.name,
                onAction: () => handleLocationChange(loc.id)
              }))
            ]}
          />
        </Popover>
      </InlineStack>

      <Modal
        open={bulkEditOpen && !!bulkField}
        onClose={() => { setBulkEditOpen(false); setBulkField(null); }}
        title={bulkField ? `Edit ${bulkField.label.toLowerCase()}` : 'Bulk edit'}
        primaryAction={{content: `Apply to ${Object.keys(bulkValues).length}`, onAction: applyBulkEdit}}
        secondaryActions={[{content: 'Cancel', onAction: () => { setBulkEditOpen(false); setBulkField(null); }}]}
      >
        {bulkField && (
          <>
            <Modal.Section>
              <BlockStack gap="300">
                <Text variant="bodyMd" tone="subdued" as="p">
                  Apply the same value to all {Object.keys(bulkValues).length} selected variants, or edit each individually below.
                </Text>
                <InlineStack gap="300" blockAlign="end" wrap={false}>
                  <div style={{flex: 1}}>
                    <TextField
                      label={`Set all ${bulkField.label.toLowerCase()}`}
                      type={bulkField.type || 'text'}
                      prefix={bulkField.prefix}
                      suffix={bulkField.suffix}
                      value={bulkApplyAll}
                      onChange={setBulkApplyAll}
                      autoComplete="off"
                    />
                  </div>
                  <Button onClick={applyBulkToAll}>Apply to all</Button>
                </InlineStack>
                <TextField
                  label="Search variants"
                  labelHidden
                  placeholder="Search variants"
                  value={bulkSearch}
                  onChange={setBulkSearch}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setBulkSearch('')}
                />
              </BlockStack>
            </Modal.Section>
            <Modal.Section flush>
              <div className="pv-bulk-list">
                {Object.keys(bulkValues)
                  .map(idx => ({idx: Number(idx), v: variants[Number(idx)]}))
                  .filter(({v}) => {
                    if (!v) return false;
                    if (!bulkSearch) return true;
                    const label = options.map(o => v.optionValues?.[o.name]).filter(Boolean).join(' / ');
                    return label.toLowerCase().includes(bulkSearch.toLowerCase())
                      || (v.sku || '').toLowerCase().includes(bulkSearch.toLowerCase());
                  })
                  .map(({idx, v}) => {
                    const label = options.map(o => v.optionValues?.[o.name]).filter(Boolean).join(' / ') || '—';
                    return (
                      <div key={idx} className="pv-bulk-row">
                        <div className="pv-bulk-info">
                          <Thumbnail source={v.image?.url || ImageIcon} alt={label} size="small" />
                          <BlockStack gap="050">
                            <Text variant="bodyMd">{label}</Text>
                            {v.sku && <Text variant="bodySm" tone="subdued">{v.sku}</Text>}
                          </BlockStack>
                        </div>
                        <div className="pv-bulk-input">
                          <TextField
                            label={bulkField.label}
                            labelHidden
                            type={bulkField.type || 'text'}
                            prefix={bulkField.prefix}
                            suffix={bulkField.suffix}
                            value={bulkValues[idx] ?? ''}
                            onChange={val => setBulkValues(prev => ({...prev, [idx]: val}))}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Modal.Section>
          </>
        )}
      </Modal>

      <Modal
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        title="Select image"
        primaryAction={{
          content: 'Save',
          disabled: !imagePickerSelected,
          onAction: () => {
            const picked = media.find(m => m.id === imagePickerSelected);
            if (picked) {
              selected.forEach(idx =>
                onVariantChange(idx, 'image', {id: picked.id, url: picked.url})
              );
            }
            setImagePickerOpen(false);
          }
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setImagePickerOpen(false)}]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Search files"
              labelHidden
              placeholder="Search files"
              value={imagePickerSearch}
              onChange={setImagePickerSearch}
              autoComplete="off"
            />
            {media.length === 0 ? (
              <EmptyState heading="No images" image="">
                <p>Upload product images first, then use Edit images to apply one to selected variants.</p>
              </EmptyState>
            ) : (
              <div className="pv-image-grid">
                {media
                  .filter(m =>
                    !imagePickerSearch ||
                    (m.alt || '').toLowerCase().includes(imagePickerSearch.toLowerCase())
                  )
                  .map(m => {
                    const isSel = imagePickerSelected === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`pv-image-cell ${isSel ? 'pv-image-selected' : ''}`}
                        onClick={() => setImagePickerSelected(m.id)}
                      >
                        <img src={m.url} alt={m.alt || ''} />
                      </div>
                    );
                  })}
              </div>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      <div className="pv-table">
        {hasSelection ? (
          <div className="pv-selection-bar">
            <div className="pv-selection-left">
              <Checkbox labelHidden label="Select all" checked={allSelected} onChange={toggleAll} />
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {selected.size} selected
              </Text>
            </div>
            <InlineStack gap="200" blockAlign="center">
              <Popover
                active={morePopoverOpen}
                onClose={() => setMorePopoverOpen(false)}
                activator={
                  <Button
                    icon={MenuHorizontalIcon}
                    variant="tertiary"
                    accessibilityLabel="More actions"
                    onClick={() => setMorePopoverOpen(o => !o)}
                  />
                }
              >
                <ActionList items={bulkMenuItems} />
              </Popover>
            </InlineStack>
          </div>
        ) : (
          <div className="pv-row pv-head">
            <div className="pv-col pv-col-check">
              <Checkbox labelHidden label="Select all" checked={allSelected} onChange={toggleAll} />
            </div>
            <div className="pv-col pv-col-variant">Variant · Expand all</div>
            <div className="pv-col pv-col-price">Price</div>
            <div className="pv-col pv-col-qty">Available</div>
            <div className="pv-col pv-col-action" />
          </div>
        )}

        {Object.entries(groups).map(([groupName, gVariants]) => {
          const isOpen = hasGroups ? !!expanded[groupName] : true;
          const firstImg = gVariants.find(v => v.image?.url)?.image?.url;
          return (
            <React.Fragment key={groupName}>
              {hasGroups && (
                <div
                  className="pv-row pv-group"
                  onClick={() => toggleGroup(groupName)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="pv-col pv-col-check" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      labelHidden
                      label={`Select group ${groupName}`}
                      checked={gVariants.every(v => selected.has(v._index))}
                      onChange={() => toggleGroupSelect(gVariants)}
                    />
                  </div>
                  <div className="pv-col pv-col-variant">
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <Thumbnail source={firstImg || ImageIcon} alt={groupName} size="small" />
                      <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold">{groupName}</Text>
                        <span className="pv-group-meta">
                          <Text variant="bodySm" tone="subdued" as="span">{gVariants.length} variants</Text>
                          <span className="pv-chev-inline">
                            {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                          </span>
                        </span>
                      </BlockStack>
                    </InlineStack>
                  </div>
                  <div className="pv-col pv-col-price">
                    <Text variant="bodySm">$ {priceRange(gVariants)}</Text>
                  </div>
                  <div className="pv-col pv-col-qty">
                    <Text variant="bodySm" tone="subdued">
                      {isStockedAt(gVariants, activeLocationId)
                        ? totalAvailable(gVariants, activeLocationId)
                        : '-'}
                    </Text>
                  </div>
                  <div className="pv-col pv-col-action" />
                </div>
              )}

              {isOpen && gVariants.map(v => {
                const isEditing = editingIndex === v._index;
                const label = hasGroups
                  ? options.slice(1).map(o => v.optionValues?.[o.name]).filter(Boolean).join(' / ') || groupName
                  : variantLabel(v);
                return (
                  <React.Fragment key={v._index}>
                    <div className={`pv-row pv-variant ${hasGroups ? 'pv-indent' : ''} ${selected.has(v._index) ? 'pv-selected' : ''}`}>
                      <div className="pv-col pv-col-check">
                        <Checkbox
                          labelHidden
                          label={`Select ${label}`}
                          checked={selected.has(v._index)}
                          onChange={() => toggleOne(v._index)}
                        />
                      </div>
                      <div className="pv-col pv-col-variant">
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <Thumbnail source={v.image?.url || ImageIcon} alt={label} size="small" />
                          <BlockStack gap="050">
                            <Text variant="bodyMd">{label}</Text>
                            {v.sku && <Text variant="bodySm" tone="subdued">{v.sku}</Text>}
                          </BlockStack>
                        </InlineStack>
                      </div>
                      <div className="pv-col pv-col-price">
                        <TextField
                          label="Price"
                          labelHidden
                          type="number"
                          prefix="$"
                          value={String(v.price || '')}
                          onChange={val => onVariantChange(v._index, 'price', val)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="pv-col pv-col-qty">
                        {(() => {
                          const locId = activeLocationId || '_default';
                          const stocked = !activeLocationId || (v.inventory && Object.prototype.hasOwnProperty.call(v.inventory, locId));
                          return (
                            <TextField
                              label="Qty"
                              labelHidden
                              type="number"
                              disabled={!stocked}
                              value={stocked ? String(v.inventory?.[locId] ?? '0') : ''}
                              placeholder={stocked ? undefined : '-'}
                              onChange={val => onVariantChange(v._index, `inventory.${locId}`, val)}
                              onBlur={() => activeLocationId && handleInventoryBlur(v, activeLocationId, v.inventory?.[activeLocationId])}
                              autoComplete="off"
                            />
                          );
                        })()}
                      </div>
                      <div className="pv-col pv-col-action">
                        <Button
                          icon={EditIcon}
                          variant="tertiary"
                          accessibilityLabel="Edit details"
                          onClick={() => setEditingIndex(isEditing ? null : v._index)}
                        />
                      </div>
                    </div>

                    {isEditing && (
                      <div className="pv-row pv-details">
                        <div className="pv-col pv-col-check" />
                        <div className="pv-details-inner">
                          <InlineStack gap="300" wrap>
                            <div style={{minWidth: 160}}>
                              <TextField
                                label="Compare at price"
                                type="number"
                                prefix="$"
                                value={String(v.compareAtPrice || '')}
                                onChange={val => onVariantChange(v._index, 'compareAtPrice', val)}
                                autoComplete="off"
                              />
                            </div>
                            <div style={{minWidth: 160}}>
                              <TextField
                                label="SKU"
                                value={v.sku || ''}
                                onChange={val => onVariantChange(v._index, 'sku', val)}
                                autoComplete="off"
                              />
                            </div>
                            <div style={{minWidth: 160}}>
                              <TextField
                                label="Barcode"
                                value={v.barcode || ''}
                                onChange={val => onVariantChange(v._index, 'barcode', val)}
                                autoComplete="off"
                              />
                            </div>
                            {locations.filter(l => l.id !== activeLocationId).map(loc => (
                              <div key={loc.id} style={{minWidth: 160}}>
                                <TextField
                                  label={`Available · ${loc.name}`}
                                  type="number"
                                  value={String(v.inventory?.[loc.id] ?? '')}
                                  onChange={val => onVariantChange(v._index, `inventory.${loc.id}`, val)}
                                  onBlur={() => handleInventoryBlur(v, loc.id, v.inventory?.[loc.id])}
                                  autoComplete="off"
                                />
                              </div>
                            ))}
                          </InlineStack>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}

        <div className="pv-row pv-total">
          <div className="pv-total-text">
            <Text variant="bodySm" as="span">
              {locationLoading
                ? 'Loading inventory…'
                : activeLocation && !stockedHere
                ? `Inventory is not stocked at ${activeLocation.name}`
                : `Total inventory${activeLocation ? ` · ${activeLocation.name}` : ' across all locations'}: ${totalAvailable(variants, activeLocationId)} available`}
            </Text>
          </div>
        </div>
      </div>

      <style>{`
        .pv-table {
          border: 1px solid var(--p-color-border);
          border-radius: 8px;
          overflow: hidden;
          background: var(--p-color-bg-surface);
        }
        .pv-row {
          display: grid;
          grid-template-columns: 36px minmax(240px, 1fr) 140px 120px 48px;
          gap: 12px;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 1px solid var(--p-color-border-subdued);
        }
        .pv-col-check { display: flex; align-items: center; justify-content: center; }
        .pv-selection-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--p-color-bg-surface);
          padding: 10px 12px;
          border-bottom: 1px solid var(--p-color-border-subdued);
        }
        .pv-selection-left {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-left: 4px;
        }
        .pv-bulk-list {
          max-height: 420px;
          overflow-y: auto;
          border-top: 1px solid var(--p-color-border-subdued);
        }
        .pv-bulk-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 20px;
          border-bottom: 1px solid var(--p-color-border-subdued);
        }
        .pv-bulk-row:last-child { border-bottom: none; }
        .pv-bulk-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        .pv-bulk-input { width: 180px; flex-shrink: 0; }
        .pv-row:last-child { border-bottom: none; }
        .pv-head {
          background: var(--p-color-bg-surface);
          font-size: 12px;
          font-weight: 500;
          color: var(--p-color-text-subdued);
          text-transform: none;
          padding: 10px 12px;
        }
        .pv-head .pv-col-price,
        .pv-head .pv-col-qty {
          text-decoration: underline;
          text-decoration-style: dotted;
          text-underline-offset: 3px;
        }
        .pv-group {
          background: var(--p-color-bg-surface);
          cursor: pointer;
          user-select: none;
        }
        .pv-group:hover { background: var(--p-color-bg-surface-hover); }
        .pv-variant:hover { background: var(--p-color-bg-surface-hover); }
        .pv-selected { background: var(--p-color-bg-surface-selected) !important; }
        .pv-group-meta {
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
        .pv-chev-inline {
          display: inline-flex;
          color: var(--p-color-icon-subdued);
        }
        .pv-chev-inline svg { width: 14px; height: 14px; }
        .pv-variant.pv-indent {
          grid-template-columns: 76px minmax(240px, 1fr) 140px 120px 48px;
          position: relative;
        }
        .pv-variant.pv-indent .pv-col-check {
          justify-content: flex-end;
          padding-right: 4px;
        }
        .pv-variant.pv-indent .pv-col-variant { padding-left: 0; }
        .pv-chev {
          display: inline-flex;
          width: 16px;
          height: 16px;
          color: var(--p-color-icon);
        }
        .pv-chev svg { width: 16px; height: 16px; }
        .pv-col-qty, .pv-col-price { text-align: left; }
        .pv-details {
          background: var(--p-color-bg-surface-secondary);
          padding: 12px;
        }
        .pv-details-inner { grid-column: 2 / -1; }
        .pv-details-inner { max-width: 100%; }
        .pv-total {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 10px 12px;
          background: var(--p-color-bg-surface-secondary);
          color: var(--p-color-text-subdued);
          border-top: 1px solid var(--p-color-border-subdued);
        }
        .pv-total-text { text-align: center; }
        .pv-image-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }
        .pv-image-cell {
          aspect-ratio: 1;
          border: 2px solid var(--p-color-border);
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          background: var(--p-color-bg-surface-secondary);
          transition: border-color 150ms ease;
        }
        .pv-image-cell:hover { border-color: var(--p-color-border-hover); }
        .pv-image-cell.pv-image-selected { border-color: var(--p-color-border-emphasis); }
        .pv-image-cell img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
      `}</style>
    </BlockStack>
  );
}
