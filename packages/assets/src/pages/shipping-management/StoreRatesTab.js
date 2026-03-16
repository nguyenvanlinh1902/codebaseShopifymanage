import React, {useState, useCallback} from 'react';
import {
  Card, BlockStack, InlineStack, Text, Button, Box,
  Select, IndexTable, TextField, Badge, SkeletonBodyText
} from '@shopify/polaris';
import {api} from '../../helpers/api';

/** Flatten nested profiles into flat rows for table display */
function flattenProfiles(profiles) {
  const rows = [];
  for (const profile of profiles) {
    for (const lg of profile.locationGroups) {
      for (const zone of lg.zones) {
        for (const rate of zone.rates) {
          rows.push({
            profileId: profile.profileId,
            profileName: profile.profileName,
            locationGroupId: lg.locationGroupId,
            zoneId: zone.zoneId,
            zoneName: zone.zoneName,
            ...rate
          });
        }
      }
    }
  }
  return rows;
}

/** Build updates array from edited rates for the API */
function buildUpdates(rows, editedRates) {
  const grouped = {};
  for (const row of rows) {
    const newPrice = editedRates[row.methodDefinitionId];
    if (newPrice === undefined) continue;

    const key = `${row.profileId}|${row.locationGroupId}`;
    if (!grouped[key]) {
      grouped[key] = {profileId: row.profileId, locationGroupId: row.locationGroupId, zones: {}};
    }
    if (!grouped[key].zones[row.zoneId]) {
      grouped[key].zones[row.zoneId] = {zoneId: row.zoneId, rates: []};
    }
    grouped[key].zones[row.zoneId].rates.push({
      methodDefinitionId: row.methodDefinitionId,
      rateDefinitionId: row.rateDefinitionId,
      price: newPrice,
      currencyCode: row.currencyCode || 'USD'
    });
  }

  return Object.values(grouped).map(g => ({
    profileId: g.profileId,
    locationGroupId: g.locationGroupId,
    zones: Object.values(g.zones)
  }));
}

export default function StoreRatesTab({stores, groups, onError, onSuccess}) {
  const [filterType, setFilterType] = useState('store');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editedRates, setEditedRates] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const storeOptions = stores.map(s => ({label: s.name || s.shopDomain, value: s.shopDomain}));
  const groupOptions = groups.map(g => ({label: g.name, value: g.id}));
  const hasEdits = Object.keys(editedRates).length > 0;

  const loadRates = useCallback(async (shopDomain) => {
    if (!shopDomain) return;
    setLoading(true);
    setEditedRates({});
    setEditingId(null);
    try {
      const res = await api(`/api/shipping/stores/${encodeURIComponent(shopDomain)}/rates`);
      const data = await res.json();
      if (data.success) {
        setProfiles(data.data);
        setRows(flattenProfiles(data.data));
      } else {
        onError(data.error);
      }
    } catch {
      onError('Failed to load shipping rates');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const handleSave = async () => {
    if (!hasEdits || !selectedStore) return;
    setSaving(true);
    try {
      const updates = buildUpdates(rows, editedRates);
      const res = await api(`/api/shipping/stores/${encodeURIComponent(selectedStore)}/rates`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({updates})
      });
      const data = await res.json();
      if (data.success) {
        onSuccess('Rates updated successfully');
        setEditedRates({});
        setEditingId(null);
        loadRates(selectedStore);
      } else {
        onError(data.errors?.map(e => e.message).join(', ') || data.error);
      }
    } catch {
      onError('Failed to save rates');
    } finally {
      setSaving(false);
    }
  };

  const handleStoreSelect = (domain) => {
    setSelectedStore(domain);
    if (domain) loadRates(domain);
    else { setRows([]); setProfiles([]); }
  };

  const handleGroupSelect = async (groupId) => {
    setSelectedGroup(groupId);
    // Load rates for first store in group as preview
    if (!groupId) { setRows([]); return; }
    const groupStores = stores.filter(s => s.groupId === groupId);
    if (groupStores.length > 0) {
      setSelectedStore(groupStores[0].shopDomain);
      loadRates(groupStores[0].shopDomain);
    }
  };

  const rowMarkup = rows.map((row, i) => {
    const isEditing = editingId === row.methodDefinitionId;
    const currentPrice = editedRates[row.methodDefinitionId] ?? row.price;

    return (
      <IndexTable.Row id={row.methodDefinitionId} key={row.methodDefinitionId} position={i}>
        <IndexTable.Cell><Text variant="bodySm">{row.profileName}</Text></IndexTable.Cell>
        <IndexTable.Cell><Text variant="bodyMd" fontWeight="semibold">{row.zoneName}</Text></IndexTable.Cell>
        <IndexTable.Cell>{row.name}</IndexTable.Cell>
        <IndexTable.Cell>
          {isEditing ? (
            <InlineStack gap="100" blockAlign="center">
              <div style={{width: 100}}>
                <TextField
                  type="number"
                  value={String(currentPrice)}
                  onChange={v => setEditedRates({...editedRates, [row.methodDefinitionId]: v})}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <Button size="slim" onClick={() => setEditingId(null)}>OK</Button>
            </InlineStack>
          ) : (
            <InlineStack gap="100" blockAlign="center">
              <Button size="slim" variant="plain" onClick={() => setEditingId(row.methodDefinitionId)}>
                {currentPrice ?? '—'} {row.currencyCode || ''}
              </Button>
              {editedRates[row.methodDefinitionId] !== undefined && (
                <Badge tone="info">edited</Badge>
              )}
            </InlineStack>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100">
            {row.conditions?.length > 0 ? row.conditions.map((c, ci) => {
              const op = c.operator === 'LESS_THAN_OR_EQUAL_TO' ? '≤' : '≥';
              return (
                <Badge key={ci} tone="info">
                  {c.field === 'TOTAL_PRICE'
                    ? `Order ${op} ${c.criteria?.amount} ${c.criteria?.currencyCode || ''}`
                    : `Weight ${op} ${c.criteria?.value} ${c.criteria?.unit || ''}`}
                </Badge>
              );
            }) : <Text variant="bodySm" tone="subdued">None</Text>}
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {row.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Box padding="400">
      <BlockStack gap="400">
        {/* Filters */}
        <Card>
          <InlineStack gap="300" blockAlign="end" wrap={false}>
            <div style={{minWidth: '120px'}}>
              <Select
                label="Filter by"
                options={[{label: 'Store', value: 'store'}, {label: 'Group', value: 'group'}]}
                value={filterType}
                onChange={v => { setFilterType(v); setSelectedStore(''); setSelectedGroup(''); setRows([]); }}
              />
            </div>
            {filterType === 'store' && (
              <div style={{minWidth: '250px'}}>
                <Select
                  label="Store"
                  options={[{label: '-- Select Store --', value: ''}, ...storeOptions]}
                  value={selectedStore}
                  onChange={handleStoreSelect}
                />
              </div>
            )}
            {filterType === 'group' && (
              <div style={{minWidth: '250px'}}>
                <Select
                  label="Group"
                  options={[{label: '-- Select Group --', value: ''}, ...groupOptions]}
                  value={selectedGroup}
                  onChange={handleGroupSelect}
                />
              </div>
            )}
            <Button onClick={() => loadRates(selectedStore)} disabled={loading || !selectedStore}>
              Refresh
            </Button>
            {hasEdits && (
              <Button variant="primary" onClick={handleSave} loading={saving}>
                Save Changes ({Object.keys(editedRates).length})
              </Button>
            )}
          </InlineStack>
        </Card>

        {/* Loading */}
        {loading && <Box padding="400"><SkeletonBodyText lines={8} /></Box>}

        {/* Table */}
        {!loading && rows.length > 0 && (
          <Card padding="0">
            <IndexTable
              resourceName={{singular: 'rate', plural: 'rates'}}
              itemCount={rows.length}
              headings={[
                {title: 'Profile'}, {title: 'Zone'}, {title: 'Rate Name'},
                {title: 'Price'}, {title: 'Conditions'}, {title: 'Status'}
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        )}

        {!loading && selectedStore && rows.length === 0 && (
          <Card><Text tone="subdued">No shipping rates found for this store.</Text></Card>
        )}
      </BlockStack>
    </Box>
  );
}
