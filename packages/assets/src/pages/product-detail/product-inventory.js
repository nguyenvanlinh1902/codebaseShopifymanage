/* eslint-disable react/prop-types */
import React, {useState, useEffect} from 'react';
import {Card, BlockStack, InlineStack, TextField, Text, Checkbox, Collapsible, Button, Link} from '@shopify/polaris';
import {ChevronDownIcon, ChevronRightIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

export default function ProductInventory({formData, onChange, storeId}) {
  const [locations, setLocations] = useState([]);
  const [open, setOpen] = useState(false);
  const v = formData.variants?.[0] || {};
  const tracked = (v.inventoryTracker ?? 'shopify') === 'shopify';
  const details = v.inventoryDetails || {};

  useEffect(() => {
    if (!storeId) return;
    api(`/api/shopify-products/locations?storeId=${storeId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setLocations(res.data || []);
      })
      .catch(() => {});
  }, [storeId]);

  const updateVariant = (field, value) => {
    const variants = [...(formData.variants || [{}])];
    variants[0] = {...variants[0], [field]: value};
    onChange('variants', variants);
  };

  const updateInventoryQty = (locationId, qty) => {
    const variants = [...(formData.variants || [{}])];
    const inv = {...(variants[0].inventory || {})};
    inv[locationId] = qty === '' ? '' : (parseInt(qty, 10) || 0);
    variants[0] = {...variants[0], inventory: inv};
    onChange('variants', variants);
  };

  // Locations where this variant has an inventory level on Shopify.
  const stockedLocationIds = new Set(Object.keys(details));
  // Sort: stocked first, then unstocked.
  const sortedLocations = [...locations].sort((a, b) => {
    const aStocked = stockedLocationIds.has(a.id) ? 0 : 1;
    const bStocked = stockedLocationIds.has(b.id) ? 0 : 1;
    return aStocked - bStocked;
  });

  const totals = sortedLocations.reduce(
    (acc, loc) => {
      const d = details[loc.id] || {};
      const avail = parseInt(v.inventory?.[loc.id] ?? d.available ?? 0, 10) || 0;
      const onHand = (d.on_hand ?? 0) + (avail - (d.available ?? 0));
      acc.unavailable += d.unavailable || 0;
      acc.committed += d.committed || 0;
      acc.available += avail;
      acc.on_hand += onHand;
      return acc;
    },
    {unavailable: 0, committed: 0, available: 0, on_hand: 0}
  );

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">Inventory</Text>
          <InlineStack gap="200" blockAlign="center">
            <Text as="span" variant="bodySm">Inventory tracked</Text>
            <label className="pi-switch">
              <input
                type="checkbox"
                checked={tracked}
                onChange={e => updateVariant('inventoryTracker', e.target.checked ? 'shopify' : 'not_managed')}
                aria-label="Inventory tracked"
              />
              <span className="pi-switch-track" />
            </label>
          </InlineStack>
        </InlineStack>

        {tracked && locations.length > 0 && (
          <div className="pi-inv-table">
            <table>
              <thead>
                <tr>
                  <th className="pi-col-loc">Locations</th>
                  <th className="pi-col-num">Unavailable</th>
                  <th className="pi-col-num">Committed</th>
                  <th className="pi-col-num">Available</th>
                  <th className="pi-col-num">On hand</th>
                </tr>
              </thead>
              <tbody>
                {sortedLocations.map(loc => {
                  const d = details[loc.id] || {};
                  const availVal = v.inventory?.[loc.id] ?? d.available ?? 0;
                  const availNum = parseInt(availVal, 10) || 0;
                  // On hand visual = current on_hand + (new available - current available).
                  // For unstocked locations, on_hand starts at 0 → on_hand = availNum.
                  const onHand = (d.on_hand ?? 0) + (availNum - (d.available ?? 0));
                  return (
                    <tr key={loc.id}>
                      <td className="pi-col-loc">{loc.name}</td>
                      <td className="pi-col-num">{d.unavailable ?? 0}</td>
                      <td className="pi-col-num">{d.committed ?? 0}</td>
                      <td className="pi-col-num pi-col-input">
                        <TextField
                          label={`Available at ${loc.name}`}
                          labelHidden
                          type="number"
                          value={String(availVal)}
                          onChange={val => updateInventoryQty(loc.id, val)}
                          autoComplete="off"
                          align="right"
                        />
                      </td>
                      <td className="pi-col-num">{onHand}</td>
                    </tr>
                  );
                })}
                <tr className="pi-row-total">
                  <td className="pi-col-loc"><strong>Total</strong></td>
                  <td className="pi-col-num">{totals.unavailable}</td>
                  <td className="pi-col-num">{totals.committed}</td>
                  <td className="pi-col-num">{totals.available}</td>
                  <td className="pi-col-num">{totals.on_hand}</td>
                </tr>
              </tbody>
            </table>
            <div style={{marginTop: 8}}>
              <Link removeUnderline url="#" onClick={e => e.preventDefault()}>
                View adjustment history
              </Link>
            </div>
          </div>
        )}

        <Button
          icon={open ? ChevronDownIcon : ChevronRightIcon}
          variant="plain"
          onClick={() => setOpen(o => !o)}
          textAlign="left"
        >
          {open ? 'Hide details' : 'SKU, Barcode, Sell when out of stock'}
        </Button>
        <Collapsible open={open} id="inventory-more">
          <BlockStack gap="300">
            <InlineStack gap="300" wrap={false}>
              <div style={{flex: 1}}>
                <TextField
                  label="SKU"
                  value={String(v.sku ?? '')}
                  onChange={val => updateVariant('sku', val)}
                  autoComplete="off"
                />
              </div>
              <div style={{flex: 1}}>
                <TextField
                  label="Barcode"
                  value={String(v.barcode ?? '')}
                  onChange={val => updateVariant('barcode', val)}
                  autoComplete="off"
                />
              </div>
            </InlineStack>
            <Checkbox
              label="Continue selling when out of stock"
              checked={(v.inventoryPolicy || '').toUpperCase() === 'CONTINUE'}
              onChange={val => updateVariant('inventoryPolicy', val ? 'CONTINUE' : 'DENY')}
            />
          </BlockStack>
        </Collapsible>
      </BlockStack>
      <style>{`
        .pi-switch { position: relative; display: inline-block; width: 34px; height: 20px; flex-shrink: 0; }
        .pi-switch input { opacity: 0; width: 0; height: 0; }
        .pi-switch-track {
          position: absolute; cursor: pointer; inset: 0;
          background: #d2d5d8; border-radius: 999px;
          transition: background 150ms ease;
        }
        .pi-switch-track::before {
          content: ""; position: absolute; height: 16px; width: 16px;
          left: 2px; top: 2px; background: #fff; border-radius: 50%;
          transition: transform 150ms ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.25);
        }
        .pi-switch input:checked + .pi-switch-track { background: #303030; }
        .pi-switch input:checked + .pi-switch-track::before { transform: translateX(14px); }

        .pi-inv-table { border: 1px solid #e1e3e5; border-radius: 8px; overflow: hidden; }
        .pi-inv-table table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .pi-inv-table th {
          background: #f6f6f7; text-align: right; font-weight: 500;
          padding: 10px 12px; border-bottom: 1px solid #e1e3e5; color: #616161;
        }
        .pi-inv-table th.pi-col-loc { text-align: left; }
        .pi-inv-table td { padding: 10px 12px; border-bottom: 1px solid #f1f2f3; text-align: right; vertical-align: middle; }
        .pi-inv-table td.pi-col-loc { text-align: left; }
        .pi-inv-table td.pi-col-input { padding: 6px 12px; width: 90px; }
        .pi-inv-table tbody tr:last-child td { border-bottom: none; }
        .pi-inv-table .pi-row-total td { background: #fafbfb; font-weight: 500; }
      `}</style>
    </Card>
  );
}
