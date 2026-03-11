import React, {useState, useEffect, useMemo} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  SkeletonBodyText,
  Badge,
  Divider,
  Popover,
  ActionList,
  Button,
  TextField
} from '@shopify/polaris';
import {
  CashDollarIcon,
  TargetIcon,
  ChartVerticalFilledIcon,
  CalendarIcon,
  CartIcon
} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';
import {getTodayStr, toDateStr, daysAgo} from '../../helpers/timezone-date';
import {usePermittedStores} from '../../hooks/usePermittedStores';
import AnalyticsStatCard from '../analytics/analytics-stat-card';

const PERIOD_OPTIONS = [
  {label: 'Today', value: 'today'},
  {label: 'Last 7 days', value: '7d'},
  {label: 'Last 30 days', value: '30d'},
  {label: 'This Month', value: 'month'},
  {label: 'Last 90 days', value: '90d'},
  {label: 'This Year', value: 'year'},
  {label: 'Custom', value: 'custom'}
];

function fmt(v) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(v || 0);
}

function getDateRange(period, customFrom, customTo, timezone) {
  const today = getTodayStr(timezone);
  const now = new Date(today + 'T00:00:00');
  const monthStart = today.slice(0, 8) + '01';
  const prevMonthStart = toDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const yearStart = now.getFullYear() + '-01-01';
  const prevYearStart = now.getFullYear() - 1 + '-01-01';

  const da = n => daysAgo(n, timezone);
  const ranges = {
    today: {
      from: today,
      to: today,
      prevFrom: da(1),
      prevTo: da(1),
      label: 'vs yesterday'
    },
    '7d': {
      from: da(7),
      to: today,
      prevFrom: da(14),
      prevTo: da(8),
      label: 'vs prev 7d'
    },
    '30d': {
      from: da(30),
      to: today,
      prevFrom: da(60),
      prevTo: da(31),
      label: 'vs prev 30d'
    },
    month: {
      from: monthStart,
      to: today,
      prevFrom: prevMonthStart,
      prevTo: da(now.getDate()),
      label: 'vs last month'
    },
    '90d': {
      from: da(90),
      to: today,
      prevFrom: da(180),
      prevTo: da(91),
      label: 'vs prev 90d'
    },
    year: {
      from: yearStart,
      to: today,
      prevFrom: prevYearStart,
      prevTo: now.getFullYear() - 1 + today.slice(4),
      label: 'vs last year'
    },
    custom: {from: customFrom, to: customTo, prevFrom: null, prevTo: null, label: ''}
  };
  return ranges[period] || ranges.month;
}

function sumDays(days, from, to, field = 'value') {
  return days.filter(d => d.day >= from && d.day <= to).reduce((s, d) => s + (d[field] || 0), 0);
}

function pctChange(cur, prev) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

// Reusable Popover filter button
function PopoverFilter({label, options, value, onChange, icon}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover
      active={open}
      onClose={() => setOpen(false)}
      activator={
        <Button onClick={() => setOpen(v => !v)} disclosure icon={icon} size="slim">
          {selected?.label || label}
        </Button>
      }
    >
      <ActionList
        items={options.map(o => ({
          content: o.label,
          active: o.value === value,
          onAction: () => {
            onChange(o.value);
            setOpen(false);
          }
        }))}
      />
    </Popover>
  );
}

// Period filter with custom date range inside the Popover
function PeriodPopoverFilter({
  period,
  customFrom,
  customTo,
  onPeriodChange,
  onCustomFromChange,
  onCustomToChange
}) {
  const [open, setOpen] = useState(false);
  const selected = PERIOD_OPTIONS.find(o => o.value === period);

  const buttonLabel =
    period === 'custom' && customFrom && customTo
      ? `${customFrom} → ${customTo}`
      : selected?.label || 'Period';

  return (
    <Popover
      active={open}
      onClose={() => setOpen(false)}
      activator={
        <Button onClick={() => setOpen(v => !v)} disclosure icon={CalendarIcon} size="slim">
          {buttonLabel}
        </Button>
      }
    >
      <ActionList
        items={PERIOD_OPTIONS.filter(o => o.value !== 'custom').map(o => ({
          content: o.label,
          active: o.value === period,
          onAction: () => {
            onPeriodChange(o.value);
            setOpen(false);
          }
        }))}
      />
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--p-color-border-secondary, #E1E3E5)'
        }}
      >
        <BlockStack gap="200">
          <Text variant="bodySm" fontWeight="semibold">
            Custom Range
          </Text>
          <InlineStack gap="200">
            <div style={{width: 140}}>
              <TextField
                label="From"
                type="date"
                value={customFrom}
                onChange={v => {
                  onCustomFromChange(v);
                  onPeriodChange('custom');
                }}
                autoComplete="off"
                labelHidden
              />
            </div>
            <div style={{width: 140}}>
              <TextField
                label="To"
                type="date"
                value={customTo}
                onChange={v => {
                  onCustomToChange(v);
                  onPeriodChange('custom');
                }}
                autoComplete="off"
                labelHidden
              />
            </div>
          </InlineStack>
        </BlockStack>
      </div>
    </Popover>
  );
}

export default function DashboardFinanceSummary() {
  const {groups, stores: contextStores, isAdmin, user} = usePermittedStores();
  const userTimezone = user?.timezone || '';
  const [rawStores, setRawStores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');

  useEffect(() => {
    api('/api/dashboard/finance-summary')
      .then(r => r.json())
      .then(d => {
        if (d.success) setRawStores(d.data.stores);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // IDs of stores belonging to the selected group
  const groupStoreIds = useMemo(() => {
    if (groupFilter === 'all') return null;
    return new Set(contextStores.filter(s => s.groupId === groupFilter).map(s => s.id));
  }, [groupFilter, contextStores]);

  const storeOptions = useMemo(() => {
    if (!rawStores) return [];
    const base = groupStoreIds ? rawStores.filter(s => groupStoreIds.has(s.storeId)) : rawStores;
    return [
      {label: 'All Stores', value: 'all'},
      ...base.map(s => ({label: s.name, value: s.storeId}))
    ];
  }, [rawStores, groupStoreIds]);

  const groupOptions = useMemo(
    () => [{label: 'All Groups', value: 'all'}, ...groups.map(g => ({label: g.name, value: g.id}))],
    [groups]
  );

  const computed = useMemo(() => {
    if (!rawStores) return null;
    if (period === 'custom' && (!customFrom || !customTo)) return null;
    const range = getDateRange(period, customFrom, customTo, userTimezone);

    let filtered = rawStores;
    // Apply group filter first
    if (groupStoreIds) filtered = filtered.filter(s => groupStoreIds.has(s.storeId));
    // Then store filter
    if (storeFilter !== 'all') filtered = filtered.filter(s => s.storeId === storeFilter);

    const stores = filtered.map(s => ({
      ...s,
      revenue: sumDays(s.revenueDays, range.from, range.to),
      revenuePrev: range.prevFrom ? sumDays(s.revenueDays, range.prevFrom, range.prevTo) : null,
      totalSales: sumDays(s.revenueDays, range.from, range.to, 'totalSales'),
      totalSalesPrev: range.prevFrom
        ? sumDays(s.revenueDays, range.prevFrom, range.prevTo, 'totalSales')
        : null,
      adSpend: sumDays(s.adSpendDays, range.from, range.to),
      adSpendPrev: range.prevFrom ? sumDays(s.adSpendDays, range.prevFrom, range.prevTo) : null
    }));

    const totals = stores.reduce(
      (a, s) => {
        a.revenue += s.revenue;
        a.revenuePrev += s.revenuePrev || 0;
        a.totalSales += s.totalSales;
        a.totalSalesPrev += s.totalSalesPrev || 0;
        a.adSpend += s.adSpend;
        a.adSpendPrev += s.adSpendPrev || 0;
        a.payoutBalance += s.payoutBalance?.amount || 0;
        return a;
      },
      {
        revenue: 0,
        revenuePrev: 0,
        totalSales: 0,
        totalSalesPrev: 0,
        adSpend: 0,
        adSpendPrev: 0,
        payoutBalance: 0
      }
    );
    return {stores, totals, label: range.label};
  }, [rawStores, period, customFrom, customTo, storeFilter, groupStoreIds, userTimezone]);

  if (loading) return <SkeletonBodyText lines={4} />;
  if (!rawStores) return null;

  const salesPct = computed
    ? pctChange(computed.totals.totalSales, computed.totals.totalSalesPrev)
    : null;
  const revPct = computed ? pctChange(computed.totals.revenue, computed.totals.revenuePrev) : null;
  const adsPct = computed ? pctChange(computed.totals.adSpend, computed.totals.adSpendPrev) : null;

  return (
    <BlockStack gap="400">
      <InlineStack gap="300" align="space-between" blockAlign="center" wrap>
        <Text variant="headingMd">Finance Overview</Text>
        <InlineStack gap="200" blockAlign="center" wrap>
          {isAdmin && groups.length > 0 && (
            <PopoverFilter
              label="Group"
              options={groupOptions}
              value={groupFilter}
              onChange={v => {
                setGroupFilter(v);
                setStoreFilter('all');
              }}
            />
          )}
          {storeOptions.length > 2 && (
            <PopoverFilter
              label="Store"
              options={storeOptions}
              value={storeFilter}
              onChange={setStoreFilter}
            />
          )}
          <PeriodPopoverFilter
            period={period}
            customFrom={customFrom}
            customTo={customTo}
            onPeriodChange={setPeriod}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        </InlineStack>
      </InlineStack>

      {computed && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}
          >
            <AnalyticsStatCard
              title="Total Sales"
              value={fmt(computed.totals.totalSales)}
              icon={CartIcon}
              color="#8b5cf6"
              subtitle={
                salesPct !== null && computed.label
                  ? `${salesPct > 0 ? '+' : ''}${salesPct}% ${computed.label}`
                  : undefined
              }
            />
            <AnalyticsStatCard
              title="Net Revenue"
              value={fmt(computed.totals.revenue)}
              icon={ChartVerticalFilledIcon}
              color="#22c55e"
              subtitle={
                revPct !== null && computed.label
                  ? `${revPct > 0 ? '+' : ''}${revPct}% ${computed.label}`
                  : undefined
              }
            />
            <AnalyticsStatCard
              title="Ad Spend"
              value={fmt(computed.totals.adSpend)}
              icon={TargetIcon}
              color="#ef4444"
              subtitle={
                adsPct !== null && computed.label
                  ? `${adsPct > 0 ? '+' : ''}${adsPct}% ${computed.label}`
                  : undefined
              }
            />
            <AnalyticsStatCard
              title="Payout Balance"
              value={fmt(computed.totals.payoutBalance)}
              icon={CashDollarIcon}
              color="#6366f1"
            />
          </div>

          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm">Per Store</Text>
              <Divider />
              {computed.stores.map(s => (
                <div key={s.storeId} style={{padding: '8px 0'}}>
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodySm" fontWeight="semibold">
                      {s.name}
                    </Text>
                    <InlineStack gap="300">
                      <Badge>{fmt(s.totalSales)} sales</Badge>
                      <Badge tone="success">{fmt(s.revenue)} net</Badge>
                      <Badge tone="critical">{fmt(s.adSpend)} ads</Badge>
                      <Badge tone="info">{fmt(s.payoutBalance?.amount)} payout</Badge>
                    </InlineStack>
                  </InlineStack>
                </div>
              ))}
            </BlockStack>
          </Card>
        </>
      )}
    </BlockStack>
  );
}
