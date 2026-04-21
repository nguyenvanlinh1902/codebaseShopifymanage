import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  FormLayout,
  TextField,
  Select,
  Divider
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

export function closestIntervalOption(hours) {
  const target = Number(hours) || 24;
  let best = INTERVAL_OPTIONS[INTERVAL_OPTIONS.length - 1].value;
  let bestDelta = Infinity;
  for (const opt of INTERVAL_OPTIONS) {
    const delta = Math.abs(Number(opt.value) - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = opt.value;
    }
  }
  return best;
}

export function formatVn(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

/**
 * Per-group Discord channel form. Bot token is global and managed separately
 * via GlobalBotTokenModal — groups only own channelId.
 */
export function GroupDiscordForm({groupId, config, hasGlobalToken, onSaved, onFlash}) {
  const [channelId, setChannelId] = useState(config?.channelId || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api(`/api/discord/groups/${groupId}/config`, {
        method: 'PUT',
        body: JSON.stringify({channelId})
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      onSaved(body.data);
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const res = await api(`/api/discord/groups/${groupId}/test`, {method: 'POST'});
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      onFlash({tone: 'success', message: `Connected to #${body.data.channelName}. Test sent.`});
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setTesting(false);
    }
  };

  const canSave = !!channelId;
  const canTest = hasGlobalToken && channelId;

  return (
    <BlockStack gap="400">
      {!hasGlobalToken && (
        <Text as="p" tone="critical" variant="bodySm">
          No global bot token configured yet. Click &quot;Manage Bot Token&quot; at the top of Store Groups first.
        </Text>
      )}
      <Text as="p" tone="subdued" variant="bodySm">
        Paste the Discord channel ID this group should forward emails to. The bot token is shared across all groups.
      </Text>
      <FormLayout>
        <TextField
          label="Channel ID"
          value={channelId}
          onChange={setChannelId}
          placeholder="Right-click channel → Copy Channel ID"
          autoComplete="off"
          helpText="Developer Mode must be on in Discord (Settings → Advanced)."
        />
      </FormLayout>
      <InlineStack gap="200">
        <Button onClick={handleSave} loading={saving} variant="primary" disabled={!canSave}>
          Save channel
        </Button>
        <Button onClick={handleTest} loading={testing} disabled={!canTest}>
          Send test message
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
GroupDiscordForm.propTypes = {
  groupId: PropTypes.string.isRequired,
  config: PropTypes.object,
  hasGlobalToken: PropTypes.bool,
  onSaved: PropTypes.func.isRequired,
  onFlash: PropTypes.func.isRequired
};

/** Scheduled digest form (frequency + run now + stats). */
export function GroupScheduleForm({groupId, schedule, onSaved, onFlash}) {
  const [enabled, setEnabled] = useState(!!schedule?.enabled);
  const [intervalHours, setIntervalHours] = useState(
    schedule?.intervalHours !== undefined
      ? closestIntervalOption(schedule.intervalHours)
      : '0.25'
  );
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api(`/api/discord/groups/${groupId}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          intervalHours: Number(intervalHours) || 0.25
        })
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      onSaved(body.data);
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setRunning(true);
      const res = await api(`/api/discord/groups/${groupId}/schedule/run-now`, {method: 'POST'});
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      const {sent = 0, failed = 0, skipped = 0, reason} = body.data || {};
      onFlash({
        tone: failed > 0 ? 'warning' : 'success',
        message: reason
          ? `Digest skipped: ${reason}`
          : `Digest done. sent=${sent}, failed=${failed}, skipped=${skipped}`
      });
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setRunning(false);
    }
  };

  const stats = schedule?.lastRunStats;

  return (
    <BlockStack gap="400">
      <Text as="p" tone="subdued" variant="bodySm">
        The cron will fetch today&apos;s emails (Vietnam time) and forward them to the configured
        Discord channel. Emails already sent will not be sent again.
      </Text>

      <InlineStack gap="200" blockAlign="center">
        <Button variant={enabled ? 'primary' : 'secondary'} onClick={() => setEnabled(e => !e)}>
          {enabled ? 'Enabled' : 'Disabled'}
        </Button>
        <Text as="span" tone="subdued" variant="bodySm">
          {enabled ? 'Runs on the frequency below' : 'Click to enable'}
        </Text>
      </InlineStack>

      <Select
        label="Frequency"
        options={INTERVAL_OPTIONS}
        value={intervalHours}
        onChange={setIntervalHours}
      />

      <Button variant="primary" onClick={handleSave} loading={saving}>
        Save
      </Button>

      <Divider />

      <BlockStack gap="100">
        <Text as="h3" variant="headingSm">Status</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Next run: {formatVn(schedule?.nextRunAt)}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Last run: {formatVn(schedule?.lastRunAt)}
        </Text>
        {stats && (
          <Text as="p" variant="bodySm" tone="subdued">
            Last stats: sent={stats.sent ?? 0}, failed={stats.failed ?? 0}, skipped={stats.skipped ?? 0}
            {stats.reason ? ` (${stats.reason})` : ''}
          </Text>
        )}
      </BlockStack>

      <Button onClick={handleRunNow} loading={running}>
        Run now
      </Button>
    </BlockStack>
  );
}
GroupScheduleForm.propTypes = {
  groupId: PropTypes.string.isRequired,
  schedule: PropTypes.object,
  onSaved: PropTypes.func.isRequired,
  onFlash: PropTypes.func.isRequired
};
