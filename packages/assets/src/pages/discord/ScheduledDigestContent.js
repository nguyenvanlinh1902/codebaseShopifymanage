import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Checkbox,
  Select,
  Button,
  Text,
  Banner,
  Divider,
  Box,
  Badge,
  SkeletonBodyText,
  ProgressBar,
  TextField,
  IndexTable,
  EmptyState
} from '@shopify/polaris';
import {api} from '../../helpers/api';

const INTERVAL_OPTIONS = [
  {label: 'Every 1 minute', value: '0.0167'},
  {label: 'Every 5 minutes', value: '0.0833'},
  {label: 'Every 15 minutes', value: '0.25'},
  {label: 'Every 30 minutes', value: '0.5'},
  {label: 'Every 1 hour', value: '1'},
  {label: 'Every 2 hours', value: '2'},
  {label: 'Every 3 hours', value: '3'},
  {label: 'Every 4 hours', value: '4'},
  {label: 'Every 6 hours', value: '6'},
  {label: 'Every 8 hours', value: '8'},
  {label: 'Every 12 hours', value: '12'},
  {label: 'Every 24 hours (daily)', value: '24'}
];

function formatVn(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Due now!';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function useCountdown(targetIso) {
  const [remaining, setRemaining] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!targetIso) {
      setRemaining(null);
      return;
    }

    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => clearInterval(intervalRef.current);
  }, [targetIso]);

  return remaining;
}

function useEmailAccounts() {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [gmailRes, outlookRes] = await Promise.all([
          api('/api/gmail/accounts').then(r => r.json()).catch(() => ({success: false})),
          api('/api/outlook/accounts').then(r => r.json()).catch(() => ({success: false}))
        ]);
        const list = [];
        if (gmailRes.success && gmailRes.data) {
          gmailRes.data.forEach(a => list.push({email: a.email || a.googleEmail, provider: 'gmail'}));
        }
        if (outlookRes.success && outlookRes.data) {
          outlookRes.data.forEach(a => list.push({email: a.email || a.googleEmail, provider: 'outlook'}));
        }
        setAccounts(list);
      } catch { /* ignore */ }
    }
    load();
  }, []);

  return accounts;
}

function ManualRunCard({running, onRunNow}) {
  const accounts = useEmailAccounts();
  const [selectedAccount, setSelectedAccount] = useState('');
  const [testChannelId, setTestChannelId] = useState('');

  const accountOptions = [
    {label: 'Select an email account...', value: ''},
    ...accounts.map(a => ({
      label: `${a.email} (${a.provider})`,
      value: a.email
    }))
  ];

  const handleRunNow = () => {
    onRunNow({
      sourceAccounts: selectedAccount ? [selectedAccount] : [],
      testChannelId: testChannelId.trim() || undefined
    });
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingSm" as="h4">Manual test</Text>
          <Badge tone="attention">Dev only</Badge>
        </InlineStack>
        <Text variant="bodySm" tone="subdued">
          Pick an email account and optionally a test channel to run the digest manually.
        </Text>
        <Select
          label="Email account"
          options={accountOptions}
          value={selectedAccount}
          onChange={setSelectedAccount}
        />
        <TextField
          label="Test channel ID (optional)"
          value={testChannelId}
          onChange={setTestChannelId}
          placeholder="Paste a Discord channel ID for testing"
          helpText="Leave empty to use the main configured channel."
          autoComplete="off"
        />
        <Button
          variant="primary"
          tone="success"
          loading={running}
          onClick={handleRunNow}
          disabled={!selectedAccount}
        >
          Run now
        </Button>
      </BlockStack>
    </Card>
  );
}

const PAGE_SIZE = 20;

// Convert YYYY-MM-DD (VN local) to ISO string at day-start / day-end (+07:00).
const dayStartIsoVn = d => (d ? new Date(`${d}T00:00:00+07:00`).toISOString() : null);
const dayEndIsoVn = d => (d ? new Date(`${d}T23:59:59.999+07:00`).toISOString() : null);

function SentHistoryCard() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cursorStack, setCursorStack] = useState([null]); // cursors[i] = "after" for page i (page 0 = null)
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  const fetchPage = useCallback(async (pageIdx, stack, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({limit: String(PAGE_SIZE)});
      const after = stack[pageIdx];
      if (after) params.set('after', after);
      const fromIso = dayStartIsoVn(fromDate);
      const toIso = dayEndIsoVn(toDate);
      if (fromIso) params.set('from', fromIso);
      if (toIso) params.set('to', toIso);
      const res = await api(`/api/discord/sent-emails?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEmails(json.data || []);
        setHasMore(!!json.hasMore);
        setNextCursor(json.nextCursor || null);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate]);

  // Initial load + re-load when filters change (reset pagination).
  useEffect(() => {
    setCursorStack([null]);
    setPage(0);
    fetchPage(0, [null]);
  }, [fromDate, toDate, fetchPage]);

  // Auto-refresh only on first page without navigating.
  useEffect(() => {
    if (page !== 0) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchPage(0, cursorStack, true);
    }, 20000);
    return () => clearInterval(id);
  }, [page, cursorStack, fetchPage]);

  const handleNext = () => {
    if (!hasMore || !nextCursor) return;
    const newStack = cursorStack.slice(0, page + 1).concat(nextCursor);
    setCursorStack(newStack);
    setPage(page + 1);
    fetchPage(page + 1, newStack);
  };

  const handlePrev = () => {
    if (page === 0) return;
    setPage(page - 1);
    fetchPage(page - 1, cursorStack);
  };

  const handleClearFilter = () => {
    setFromDate('');
    setToDate('');
  };

  const rowMarkup = emails.map((e, idx) => (
    <IndexTable.Row id={e.id} key={e.id} position={idx}>
      <IndexTable.Cell>
        <Text variant="bodySm">{formatVn(e.sentAt)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={e.provider === 'gmail' ? 'info' : 'success'}>{e.provider}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm">{e.accountEmail}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" truncate>{e.subject || '—'}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued">{e.discordMessageId || '—'}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card padding="0">
      <Box padding="400" paddingBlockEnd="300">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingSm" as="h4">Sent history</Text>
            <Button size="slim" loading={refreshing} onClick={() => fetchPage(page, cursorStack, true)}>
              Refresh
            </Button>
          </InlineStack>
          <InlineStack gap="200" blockAlign="end" wrap>
            <Box minWidth="160px">
              <TextField
                label="From"
                type="date"
                value={fromDate}
                onChange={setFromDate}
                autoComplete="off"
              />
            </Box>
            <Box minWidth="160px">
              <TextField
                label="To"
                type="date"
                value={toDate}
                onChange={setToDate}
                autoComplete="off"
              />
            </Box>
            {(fromDate || toDate) && (
              <Button size="slim" onClick={handleClearFilter}>Clear</Button>
            )}
          </InlineStack>
        </BlockStack>
      </Box>
      {loading ? (
        <Box padding="400"><SkeletonBodyText lines={4} /></Box>
      ) : emails.length === 0 ? (
        <EmptyState
          heading={fromDate || toDate ? 'No emails in this range' : 'No emails sent yet'}
          image="https://cdn.shopify.com/s/files/1/2376/3301/products/emptystate-files.png"
        >
          <p>
            {fromDate || toDate
              ? 'Try a different date range or clear the filter.'
              : 'Forwarded emails will appear here after the next digest run.'}
          </p>
        </EmptyState>
      ) : (
        <>
          <IndexTable
            resourceName={{singular: 'email', plural: 'emails'}}
            itemCount={emails.length}
            headings={[
              {title: 'Sent at'},
              {title: 'Provider'},
              {title: 'Account'},
              {title: 'Subject'},
              {title: 'Discord msg ID'}
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
          <Box padding="400" borderBlockStartWidth="025" borderColor="border">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="bodySm" tone="subdued">
                Page {page + 1} · Showing {emails.length} email{emails.length !== 1 ? 's' : ''}
              </Text>
              <InlineStack gap="200">
                <Button size="slim" disabled={page === 0} onClick={handlePrev}>Previous</Button>
                <Button size="slim" disabled={!hasMore} onClick={handleNext}>Next</Button>
              </InlineStack>
            </InlineStack>
          </Box>
        </>
      )}
    </Card>
  );
}

function ScheduleStatusCard({schedule, onReset, resetting}) {
  const remaining = useCountdown(schedule.enabled ? schedule.nextRunAt : null);
  const isDue = remaining !== null && remaining <= 0;
  const intervalMs = (schedule.intervalHours || 6) * 3600 * 1000;
  const elapsed = remaining !== null ? intervalMs - remaining : 0;
  const progress = remaining !== null ? Math.min(100, (elapsed / intervalMs) * 100) : 0;

  return (
    <Card>
      <BlockStack gap="300">
        <Text variant="headingSm" as="h4">Schedule status</Text>
        <Divider />

        <InlineStack gap="600" wrap>
          <Box>
            <Text tone="subdued" variant="bodySm">Last run</Text>
            <Text variant="bodyMd">{formatVn(schedule.lastRunAt)}</Text>
          </Box>
          <Box>
            <Text tone="subdued" variant="bodySm">Next run</Text>
            <Text variant="bodyMd">{formatVn(schedule.nextRunAt)}</Text>
          </Box>
          <Box>
            <Text tone="subdued" variant="bodySm">State</Text>
            <Badge tone={schedule.enabled ? 'success' : 'attention'}>
              {schedule.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Box>
        </InlineStack>

        {schedule.enabled && remaining !== null && (
          <>
            <Divider />
            {isDue ? (
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodySm" tone="caution">Overdue — next run time has passed.</Text>
                <Button size="slim" loading={resetting} onClick={onReset}>
                  Reset timer
                </Button>
              </InlineStack>
            ) : (
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="bodySm" tone="subdued">Time until next run</Text>
                  <Badge tone={remaining < 300000 ? 'warning' : 'info'}>
                    {formatCountdown(remaining)}
                  </Badge>
                </InlineStack>
                <ProgressBar progress={progress} tone="primary" size="small" />
              </BlockStack>
            )}
          </>
        )}

        {schedule.lastRunStats && (
          <>
            <Divider />
            <BlockStack gap="200">
              <Text variant="headingSm" as="h5">Last run result</Text>
              <InlineStack gap="400" wrap>
                <Badge tone="success">Sent: {schedule.lastRunStats.sent || 0}</Badge>
                <Badge>Skipped: {schedule.lastRunStats.skipped || 0}</Badge>
                <Badge tone="critical">Failed: {schedule.lastRunStats.failed || 0}</Badge>
              </InlineStack>
              {schedule.lastRunStats.error && (
                <Banner tone="warning">
                  <p>{schedule.lastRunStats.error}</p>
                </Banner>
              )}
            </BlockStack>
          </>
        )}
      </BlockStack>
    </Card>
  );
}

export default function ScheduledDigestContent() {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState('6');
  const [resetting, setResetting] = useState(false);
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ||
    new URLSearchParams(window.location.search).has('debug');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api('/api/discord/schedule');
      const json = await res.json();
      if (json.success && json.data) {
        setSchedule(json.data);
        setEnabled(!!json.data.enabled);
        setIntervalHours(String(json.data.intervalHours || 6));
      }
    } catch (err) {
      setMessage({tone: 'critical', text: err.message});
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 15000);
    return () => clearInterval(id);
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api('/api/discord/schedule', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          intervalHours: Number(intervalHours),
          sourceAccounts: []
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSchedule(json.data);
      setMessage({tone: 'success', text: 'Schedule saved.'});
    } catch (err) {
      setMessage({tone: 'critical', text: err.message});
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setMessage(null);
    try {
      const res = await api('/api/discord/schedule', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          intervalHours: Number(intervalHours),
          sourceAccounts: []
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSchedule(json.data);
      setMessage({tone: 'success', text: 'Timer reset. Next run recalculated.'});
    } catch (err) {
      setMessage({tone: 'critical', text: err.message});
    } finally {
      setResetting(false);
    }
  };

  const handleRunNow = async ({sourceAccounts = [], testChannelId} = {}) => {
    setRunning(true);
    setMessage(null);
    try {
      const res = await api('/api/discord/schedule/run-now', {
        method: 'POST',
        body: JSON.stringify({sourceAccounts, testChannelId})
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const {sent = 0, failed = 0, skipped = 0, reason} = json.data || {};
      if (reason === 'no-discord-config') {
        setMessage({tone: 'critical', text: 'No Discord bot configured. Go to Bot Config tab first.'});
      } else if (sent === 0 && failed === 0) {
        setMessage({tone: 'info', text: 'No new emails to send. All emails have already been forwarded.'});
      } else {
        setMessage({
          tone: failed > 0 ? 'warning' : 'success',
          text: `Run completed: sent ${sent}, skipped ${skipped}, failed ${failed}.`
        });
      }
      await load(true);
    } catch (err) {
      setMessage({tone: 'critical', text: err.message});
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <BlockStack gap="400">
          <SkeletonBodyText lines={5} />
        </BlockStack>
      </Card>
    );
  }

  return (
    <BlockStack gap="400">
      {message && (
        <Banner tone={message.tone} onDismiss={() => setMessage(null)}>
          <p>{message.text}</p>
        </Banner>
      )}

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h3">Scheduled email digest</Text>
            <Badge tone="info">Timezone: Asia/Ho_Chi_Minh (GMT+7)</Badge>
          </InlineStack>

          <Checkbox
            label="Enable scheduled digest"
            checked={enabled}
            onChange={setEnabled}
            helpText="The cron will fetch today's emails (Vietnam time) and forward them to the configured Discord channel. Emails already sent will not be sent again."
          />

          <Select
            label="Frequency"
            options={INTERVAL_OPTIONS}
            value={intervalHours}
            onChange={setIntervalHours}
            disabled={!enabled}
          />

          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save
          </Button>
        </BlockStack>
      </Card>

      {isLocal && <ManualRunCard running={running} onRunNow={handleRunNow} />}

      {schedule && <ScheduleStatusCard schedule={schedule} onReset={handleReset} resetting={resetting} />}

      <SentHistoryCard />
    </BlockStack>
  );
}
