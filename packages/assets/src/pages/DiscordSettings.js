import React, {useEffect, useState} from 'react';
import {Page, Tabs, BlockStack, SkeletonBodyText, Card} from '@shopify/polaris';
import DiscordConfigForm from './discord/DiscordConfigForm';
import EmailRulesContent from './discord/EmailRulesContent';
import WatchStatusContent from './discord/WatchStatusContent';
import {useDiscordConfig} from '../hooks/useDiscordConfig';

/**
 * Discord Settings page — bot config, filter rules, watch status
 */
export default function DiscordSettings() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const {
    config, rules, watchStatuses, loading,
    fetchConfig, saveConfig, testConnection,
    fetchRules, createRule, updateRule, deleteRule, toggleRule,
    fetchWatchStatus
  } = useDiscordConfig();

  useEffect(() => {
    Promise.all([fetchConfig(), fetchRules(), fetchWatchStatus()])
      .finally(() => setInitialLoading(false));
  }, [fetchConfig, fetchRules, fetchWatchStatus]);

  const tabs = [
    {id: 'config', content: 'Bot Config', panelID: 'config-panel'},
    {id: 'rules', content: `Filter Rules${rules.length ? ` (${rules.length})` : ''}`, panelID: 'rules-panel'},
    {id: 'watches', content: `Watch Status${watchStatuses.length ? ` (${watchStatuses.length})` : ''}`, panelID: 'watches-panel'}
  ];

  if (initialLoading) {
    return (
      <Page title="Discord Settings">
        <Card>
          <BlockStack gap="400">
            <SkeletonBodyText lines={4} />
            <SkeletonBodyText lines={3} />
          </BlockStack>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Discord Settings"
      subtitle="Configure Discord bot, email filter rules, and Gmail watch status"
      primaryAction={{
        content: 'Setup Guide',
        url: '/guides/discord-gmail-setup-guide.pdf.html',
        external: true
      }}
    >
      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        <div style={{marginTop: 16}}>
          {selectedTab === 0 && (
            <DiscordConfigForm
              config={config}
              onSave={saveConfig}
              onTest={testConnection}
              loading={loading}
            />
          )}
          {selectedTab === 1 && (
            <EmailRulesContent
              rules={rules}
              onCreate={createRule}
              onUpdate={updateRule}
              onDelete={deleteRule}
              onToggle={toggleRule}
            />
          )}
          {selectedTab === 2 && (
            <WatchStatusContent
              watchStatuses={watchStatuses}
              onRefresh={fetchWatchStatus}
            />
          )}
        </div>
      </Tabs>
    </Page>
  );
}
