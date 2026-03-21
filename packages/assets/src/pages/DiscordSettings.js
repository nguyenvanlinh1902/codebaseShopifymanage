import React, {useEffect, useState} from 'react';
import {Page, Tabs, BlockStack, SkeletonBodyText, Card} from '@shopify/polaris';
import DiscordConfigForm from './discord/DiscordConfigForm';
import EmailRulesContent from './discord/EmailRulesContent';
import {useDiscordConfig} from '../hooks/useDiscordConfig';

/**
 * Discord Settings page — bot config and email filter rules
 * Watch management is fully automatic (auto-start on connect, auto-renew via cron)
 */
export default function DiscordSettings() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const {
    config,
    rules,
    loading,
    fetchConfig,
    saveConfig,
    testConnection,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule
  } = useDiscordConfig();

  useEffect(() => {
    Promise.all([fetchConfig(), fetchRules()]).finally(() => setInitialLoading(false));
  }, [fetchConfig, fetchRules]);

  const tabs = [
    {id: 'config', content: 'Bot Config', panelID: 'config-panel'},
    {
      id: 'rules',
      content: `Filter Rules${rules.length ? ` (${rules.length})` : ''}`,
      panelID: 'rules-panel'
    }
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
      subtitle="Configure Discord bot and email filter rules"
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
        </div>
      </Tabs>
    </Page>
  );
}
