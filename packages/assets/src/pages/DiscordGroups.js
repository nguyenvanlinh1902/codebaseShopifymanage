import React, {useCallback, useEffect, useState} from 'react';
import {
  Page,
  Card,
  IndexTable,
  Badge,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  EmptyState,
  SkeletonBodyText,
  Modal,
  Tabs,
  TextField
} from '@shopify/polaris';
import {api} from '../helpers/api';
import {GroupDiscordForm, GroupScheduleForm} from './groups/group-config-forms';
import LinkedEmailsPanel from './groups/LinkedEmailsPanel';
import GlobalBotTokenModal from './groups/GlobalBotTokenModal';
import GroupHistoryPanel from './groups/GroupHistoryPanel';

/**
 * Admin-only page listing every store group with its Discord configuration,
 * digest schedule, and linked-email status. All per-group configuration happens
 * inside modals launched from this page — no per-group route needed.
 */
export default function DiscordGroups() {
  const [rows, setRows] = useState([]);
  const [globalToken, setGlobalToken] = useState({hasToken: false, botUsername: null});
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [settingsFor, setSettingsFor] = useState(null); // row | null
  const [emailsFor, setEmailsFor] = useState(null); // row | null

  const refresh = useCallback(async ({silent = false} = {}) => {
    if (!silent) setLoading(true);
    try {
      const [listRes, tokenRes] = await Promise.all([
        api('/api/discord/groups'),
        api('/api/discord/groups/global-config')
      ]);
      const listBody = await listRes.json();
      if (!listBody.success) throw new Error(listBody.error || `HTTP ${listRes.status}`);
      setRows(listBody.data || []);
      const tokenBody = await tokenRes.json();
      if (tokenBody.success) setGlobalToken(tokenBody.data);
      return true;
    } catch (err) {
      console.error('[StoreGroups] refresh failed:', err);
      setFlash({tone: 'critical', message: `Failed to load groups: ${err.message}`});
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Re-fetch without the full-page skeleton — for inline Save / Enable /
  // Run-now actions that update a single row.
  const silentRefresh = useCallback(() => refresh({silent: true}), [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runNow = async groupId => {
    setFlash(null);
    try {
      const res = await api(`/api/discord/groups/${groupId}/schedule/run-now`, {method: 'POST'});
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      const data = body.data || {};
      const {sent = 0, failed = 0, skipped = 0, reason, debug, budgetExceeded} = data;
      const baseMsg = reason
        ? `Digest: ${reason}`
        : `sent=${sent}, failed=${failed}, skipped=${skipped}`;
      let detail = '';
      if (debug) {
        if (reason === 'no-accounts') {
          detail = ` — storesInGroup=${debug.storesInGroup ?? 0}, viaStore=${debug.viaStore ?? 0}, viaLinkedStore=${debug.viaLinkedStore ?? 0}, viaLinkedGroup=${debug.viaLinkedGroup ?? 0}. Check Linked Emails.`;
        } else if (sent === 0 && debug.emailsFound === 0) {
          detail = ` — ${debug.accountsChecked} account(s) checked, 0 emails today (VN time). Elapsed: ${debug.elapsedMs}ms.`;
        } else if (sent === 0 && debug.accountBreakdown?.length) {
          const firstAccount = debug.accountBreakdown[0];
          detail = ` — ${debug.emailsFound} email(s) today. Top account ${firstAccount.email}: forwarded=${firstAccount.forwarded}, rejectedByRule=${firstAccount.rejectedByRule}, alreadySent=${firstAccount.alreadySent}${firstAccount.skippedReason ? `, reason=${firstAccount.skippedReason}` : ''}.`;
        }
      }
      if (budgetExceeded) {
        detail += ' — Time budget exceeded, stopped early. Run again to continue; remaining emails will be picked up on next tick.';
      }
      setFlash({
        tone: failed > 0 || budgetExceeded ? 'warning' : sent > 0 ? 'success' : 'info',
        message: baseMsg + detail
      });
      await silentRefresh();
    } catch (err) {
      setFlash({tone: 'critical', message: err.message});
    }
  };

  const testChannel = async groupId => {
    setFlash(null);
    try {
      const res = await api(`/api/discord/groups/${groupId}/test`, {method: 'POST'});
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      setFlash({tone: 'success', message: `Test sent to #${body.data.channelName}`});
    } catch (err) {
      setFlash({tone: 'critical', message: err.message});
    }
  };

  const toggleSchedule = async row => {
    setFlash(null);
    try {
      const res = await api(`/api/discord/groups/${row.id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled: !row.schedule?.enabled,
          intervalHours: row.schedule?.intervalHours || 24
        })
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      await silentRefresh();
    } catch (err) {
      setFlash({tone: 'critical', message: err.message});
    }
  };

  if (loading) {
    return (
      <Page title="Store Groups">
        <Card>
          <BlockStack gap="400">
            <SkeletonBodyText lines={3} />
            <SkeletonBodyText lines={3} />
          </BlockStack>
        </Card>
      </Page>
    );
  }

  const createAction = {content: 'Create group', onAction: () => setCreateOpen(true)};
  const refreshAction = {content: 'Refresh', onAction: refresh};
  const tokenAction = {
    content: globalToken.hasToken ? 'Rotate bot token' : 'Set bot token',
    onAction: () => setTokenModalOpen(true)
  };

  const tokenBanner = !globalToken.hasToken ? (
    <Banner
      tone="warning"
      action={{content: 'Set bot token', onAction: () => setTokenModalOpen(true)}}
    >
      No global Discord bot token configured. All groups share one token — set it before
      configuring channels.
    </Banner>
  ) : (
    <Banner tone="info" onDismiss={() => {}}>
      Global bot: <b>{globalToken.botUsername || '(configured)'}</b>. All groups send via this bot.
      <Button variant="plain" onClick={() => setTokenModalOpen(true)}>
        Rotate
      </Button>
    </Banner>
  );

  if (rows.length === 0) {
    return (
      <Page
        title="Store Groups"
        primaryAction={createAction}
        secondaryActions={[tokenAction, refreshAction]}
      >
        <div style={{marginBottom: 16}}>{tokenBanner}</div>
        {flash && (
          <div style={{marginBottom: 16}}>
            <Banner tone={flash.tone} onDismiss={() => setFlash(null)}>{flash.message}</Banner>
          </div>
        )}
        <Card>
          <EmptyState
            heading="No store groups yet"
            action={createAction}
            secondaryAction={refreshAction}
            image=""
          >
            <p>Create a store group, then configure Discord forwarding and linked emails for it.</p>
          </EmptyState>
        </Card>
        <CreateGroupModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={refresh}
          onFlash={setFlash}
        />
        <GlobalBotTokenModal
          open={tokenModalOpen}
          current={globalToken}
          onClose={() => setTokenModalOpen(false)}
          onSaved={silentRefresh}
          onFlash={setFlash}
        />
      </Page>
    );
  }

  const rm = rows.map((row, i) => {
    const cfg = row.config;
    const sched = row.schedule;
    const configBadge = cfg?.hasToken && cfg?.channelId
      ? <Badge tone="success">Configured</Badge>
      : <Badge tone="attention">Needs setup</Badge>;
    const scheduleBadge = sched?.enabled
      ? <Badge tone="success">Enabled</Badge>
      : <Badge>Disabled</Badge>;

    const nextRun = sched?.nextRunAt
      ? new Date(sched.nextRunAt).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        })
      : '—';

    const lastStats = sched?.lastRunStats
      ? `sent=${sched.lastRunStats.sent ?? 0} / failed=${sched.lastRunStats.failed ?? 0} / skipped=${sched.lastRunStats.skipped ?? 0}`
      : '—';

    return (
      <IndexTable.Row id={row.id} key={row.id} position={i}>
        <IndexTable.Cell>
          <BlockStack gap="050">
            <Text variant="bodyMd" fontWeight="bold">{row.name}</Text>
            {row.description && (
              <Text variant="bodySm" tone="subdued">{row.description}</Text>
            )}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>{row.storeCount}</IndexTable.Cell>
        <IndexTable.Cell>{configBadge}</IndexTable.Cell>
        <IndexTable.Cell>{scheduleBadge}</IndexTable.Cell>
        <IndexTable.Cell>{nextRun}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm" tone="subdued">{lastStats}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="150">
            <Button variant="plain" onClick={() => setSettingsFor(row)}>
              Bot
            </Button>
            <Button variant="plain" onClick={() => setEmailsFor(row)}>
              Emails
            </Button>
            <Button
              variant="plain"
              disabled={!cfg?.hasToken || !cfg?.channelId}
              onClick={() => testChannel(row.id)}
            >
              Test
            </Button>
            <Button
              variant="plain"
              disabled={!cfg?.hasToken || !cfg?.channelId}
              onClick={() => runNow(row.id)}
            >
              Run now
            </Button>
            <Button
              variant="plain"
              disabled={!cfg?.hasToken || !cfg?.channelId}
              onClick={() => toggleSchedule(row)}
            >
              {sched?.enabled ? 'Disable' : 'Enable'}
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Store Groups"
      subtitle="One Discord bot forwards emails to a dedicated channel per group. Staff see only the emails of groups they are assigned to."
      primaryAction={createAction}
      secondaryActions={[tokenAction, refreshAction]}
    >
      <div style={{marginBottom: 16}}>{tokenBanner}</div>
      {flash && (
        <div style={{marginBottom: 16}}>
          <Banner tone={flash.tone} onDismiss={() => setFlash(null)}>{flash.message}</Banner>
        </div>
      )}
      <Card padding="0">
        <IndexTable
          resourceName={{singular: 'group', plural: 'groups'}}
          itemCount={rows.length}
          selectable={false}
          headings={[
            {title: 'Group'},
            {title: 'Stores'},
            {title: 'Discord'},
            {title: 'Schedule'},
            {title: 'Next run'},
            {title: 'Last stats'},
            {title: 'Actions'}
          ]}
        >
          {rm}
        </IndexTable>
      </Card>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
        onFlash={setFlash}
      />

      {settingsFor && (
        <GroupSettingsModal
          group={settingsFor}
          hasGlobalToken={globalToken.hasToken}
          onClose={() => setSettingsFor(null)}
          onChanged={silentRefresh}
          onFlash={setFlash}
        />
      )}

      {emailsFor && (
        <LinkedEmailsModal
          group={emailsFor}
          onClose={() => setEmailsFor(null)}
          onFlash={setFlash}
        />
      )}

      <GlobalBotTokenModal
        open={tokenModalOpen}
        current={globalToken}
        onClose={() => setTokenModalOpen(false)}
        onSaved={silentRefresh}
        onFlash={setFlash}
      />
    </Page>
  );
}

function CreateGroupModal({open, onClose, onCreated, onFlash}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api('/api/store-groups', {
        method: 'POST',
        body: JSON.stringify({name: name.trim(), description: description.trim()})
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      setName('');
      setDescription('');
      onClose();
      const ok = await onCreated();
      onFlash(ok
        ? {tone: 'success', message: 'Group created'}
        : {tone: 'warning', message: 'Group saved, but list failed to reload. Click Refresh.'}
      );
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create store group"
      primaryAction={{content: 'Create', onAction: handleCreate, loading: saving, disabled: !name.trim()}}
      secondaryActions={[{content: 'Cancel', onAction: onClose}]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            autoComplete="off"
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function GroupSettingsModal({group, hasGlobalToken, onClose, onChanged, onFlash}) {
  const [tab, setTab] = useState(0);
  const [config, setConfig] = useState(group.config);
  const [schedule, setSchedule] = useState(group.schedule);

  const tabs = [
    {id: 'bot', content: 'Discord Bot', panelID: 'bot-panel'},
    {id: 'schedule', content: 'Schedule', panelID: 'schedule-panel'},
    {id: 'history', content: 'History', panelID: 'history-panel'}
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`${group.name} — Settings`}
      large
    >
      <Modal.Section>
        <Tabs tabs={tabs} selected={tab} onSelect={setTab}>
          <div style={{marginTop: 16}}>
            {tab === 0 && (
              <GroupDiscordForm
                groupId={group.id}
                config={config}
                hasGlobalToken={hasGlobalToken}
                onSaved={newCfg => {
                  setConfig(newCfg);
                  onFlash({tone: 'success', message: 'Channel saved'});
                  onChanged();
                }}
                onFlash={onFlash}
              />
            )}
            {tab === 1 && (
              <GroupScheduleForm
                groupId={group.id}
                schedule={schedule}
                onSaved={newSched => {
                  setSchedule(newSched);
                  onFlash({tone: 'success', message: 'Schedule updated'});
                  onChanged();
                }}
                onFlash={onFlash}
              />
            )}
            {tab === 2 && (
              <GroupHistoryPanel groupId={group.id} onFlash={onFlash} />
            )}
          </div>
        </Tabs>
      </Modal.Section>
    </Modal>
  );
}

function LinkedEmailsModal({group, onClose, onFlash}) {
  return (
    <Modal open onClose={onClose} title={`${group.name} — Linked Emails`} large>
      <Modal.Section>
        <LinkedEmailsPanel groupId={group.id} onFlash={onFlash} />
      </Modal.Section>
    </Modal>
  );
}
