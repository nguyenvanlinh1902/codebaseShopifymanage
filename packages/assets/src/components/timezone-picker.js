import React, {useState, useCallback, useMemo, useEffect} from 'react';
import {Popover, ActionList, TextField, Icon} from '@shopify/polaris';
import {ClockIcon} from '@shopify/polaris-icons';

const COMMON_TIMEZONES = [
  {label: 'UTC', value: 'UTC'},
  {label: 'US Eastern', value: 'America/New_York'},
  {label: 'US Central', value: 'America/Chicago'},
  {label: 'US Mountain', value: 'America/Denver'},
  {label: 'US Pacific', value: 'America/Los_Angeles'},
  {label: 'Hawaii', value: 'Pacific/Honolulu'},
  {label: 'London', value: 'Europe/London'},
  {label: 'Paris', value: 'Europe/Paris'},
  {label: 'Berlin', value: 'Europe/Berlin'},
  {label: 'Moscow', value: 'Europe/Moscow'},
  {label: 'Dubai', value: 'Asia/Dubai'},
  {label: 'India', value: 'Asia/Kolkata'},
  {label: 'Bangkok', value: 'Asia/Bangkok'},
  {label: 'Ho Chi Minh', value: 'Asia/Ho_Chi_Minh'},
  {label: 'Singapore', value: 'Asia/Singapore'},
  {label: 'Hong Kong', value: 'Asia/Hong_Kong'},
  {label: 'Tokyo', value: 'Asia/Tokyo'},
  {label: 'Seoul', value: 'Asia/Seoul'},
  {label: 'Sydney', value: 'Australia/Sydney'},
  {label: 'Auckland', value: 'Pacific/Auckland'},
  {label: 'São Paulo', value: 'America/Sao_Paulo'},
  {label: 'Toronto', value: 'America/Toronto'}
];

/** Get DST-aware timezone abbreviation e.g. "EDT", "EST", "PDT" */
function getTzAbbr(tz) {
  if (!tz) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone: tz, timeZoneName: 'short'}).formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value || '';
  } catch {
    return '';
  }
}

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
      ...filtered.map(t => {
        const abbr = getTzAbbr(t.value);
        const offset = getOffsetLabel(t.value);
        return {
          content: abbr ? `${t.label} (${abbr})` : t.label,
          active: timezone === t.value,
          helpText: offset,
          onAction: () => {
            onChange(t.value);
            close();
          }
        };
      })
    ];
  }, [search, timezone, onChange, close]);

  const tzAbbr = getTzAbbr(timezone);
  const offsetLabel = getOffsetLabel(timezone);
  // Show DST-aware abbr if available, otherwise fall back to offset
  const tzBadge = tzAbbr || offsetLabel;

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
      {tzBadge && <span style={{opacity: 0.8, fontSize: '12px'}}>{tzBadge}</span>}
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
