import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {Popover, ActionList, TextField, Icon} from '@shopify/polaris';
import {ClockIcon} from '@shopify/polaris-icons';

const COMMON_TIMEZONES = [
  {label: 'UTC', value: 'UTC'},
  {label: 'US Eastern (ET)', value: 'America/New_York'},
  {label: 'US Central (CT)', value: 'America/Chicago'},
  {label: 'US Mountain (MT)', value: 'America/Denver'},
  {label: 'US Pacific (PT)', value: 'America/Los_Angeles'},
  {label: 'Hawaii (HST)', value: 'Pacific/Honolulu'},
  {label: 'London (GMT/BST)', value: 'Europe/London'},
  {label: 'Paris (CET/CEST)', value: 'Europe/Paris'},
  {label: 'Berlin (CET/CEST)', value: 'Europe/Berlin'},
  {label: 'Moscow (MSK)', value: 'Europe/Moscow'},
  {label: 'Dubai (GST)', value: 'Asia/Dubai'},
  {label: 'India (IST)', value: 'Asia/Kolkata'},
  {label: 'Bangkok (ICT)', value: 'Asia/Bangkok'},
  {label: 'Ho Chi Minh (ICT)', value: 'Asia/Ho_Chi_Minh'},
  {label: 'Singapore (SGT)', value: 'Asia/Singapore'},
  {label: 'Hong Kong (HKT)', value: 'Asia/Hong_Kong'},
  {label: 'Tokyo (JST)', value: 'Asia/Tokyo'},
  {label: 'Seoul (KST)', value: 'Asia/Seoul'},
  {label: 'Sydney (AEST)', value: 'Australia/Sydney'},
  {label: 'Auckland (NZST)', value: 'Pacific/Auckland'},
  {label: 'São Paulo (BRT)', value: 'America/Sao_Paulo'},
  {label: 'Toronto (ET)', value: 'America/Toronto'}
];

/** Get current time string in the given timezone */
function getCurrentTime(tz) {
  const opts = {hour: '2-digit', minute: '2-digit', hour12: true};
  if (tz) opts.timeZone = tz;
  try {
    return new Date().toLocaleTimeString('en-US', opts);
  } catch {
    return new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true});
  }
}

function getOffsetLabel(tz) {
  if (!tz) return '';
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {timeZone: tz, timeZoneName: 'shortOffset'}).formatToParts(now);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart && tzPart.value) return tzPart.value;
  } catch { /* fallback below */ }
  // Manual offset calculation fallback
  try {
    const now = new Date();
    const utc = new Date(now.toLocaleString('en-US', {timeZone: 'UTC'}));
    const local = new Date(now.toLocaleString('en-US', {timeZone: tz}));
    const diff = (local - utc) / 3600000;
    const sign = diff >= 0 ? '+' : '';
    return `GMT${sign}${Number.isInteger(diff) ? diff : diff.toFixed(1)}`;
  } catch {
    return '';
  }
}

export default function TimezonePicker({timezone, onChange}) {
  const [active, setActive] = useState(false);
  const [search, setSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(() => getCurrentTime(timezone));

  // Update clock every minute
  useEffect(() => {
    setCurrentTime(getCurrentTime(timezone));
    const interval = setInterval(() => setCurrentTime(getCurrentTime(timezone)), 60000);
    return () => clearInterval(interval);
  }, [timezone]);

  const toggle = useCallback(() => setActive(v => !v), []);
  const close = useCallback(() => {
    setActive(false);
    setSearch('');
  }, []);

  const items = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? COMMON_TIMEZONES.filter(
          t => t.label.toLowerCase().includes(q) || t.value.toLowerCase().includes(q)
        )
      : COMMON_TIMEZONES;

    return [
      {
        content: 'Browser default',
        active: !timezone,
        helpText: !timezone ? getCurrentTime('') : undefined,
        onAction: () => {
          onChange('');
          close();
        }
      },
      ...filtered.map(t => ({
        content: t.label,
        active: timezone === t.value,
        helpText: getOffsetLabel(t.value),
        onAction: () => {
          onChange(t.value);
          close();
        }
      }))
    ];
  }, [search, timezone, onChange, close]);

  const offsetLabel = getOffsetLabel(timezone);

  const activator = (
    <button
      type="button"
      onClick={toggle}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 12px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: '#fff',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        height: '32px'
      }}
    >
      <Icon source={ClockIcon} tone="base" />
      <span style={{fontWeight: 500}}>{currentTime}</span>
      {offsetLabel && <span style={{opacity: 0.8, fontSize: '12px'}}>{offsetLabel}</span>}
    </button>
  );

  return (
    <Popover active={active} activator={activator} onClose={close} preferredAlignment="right">
      <div style={{padding: '8px 12px', borderBottom: '1px solid var(--p-color-border)'}}>
        <TextField
          value={search}
          onChange={setSearch}
          placeholder="Search timezone..."
          autoComplete="off"
          clearButton
          onClearButtonClick={() => setSearch('')}
          autoFocus
        />
      </div>
      <Popover.Pane fixed>
        <ActionList items={items} />
      </Popover.Pane>
    </Popover>
  );
}
