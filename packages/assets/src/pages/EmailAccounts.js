import React, {useState} from 'react';
import {Page, Tabs, BlockStack} from '@shopify/polaris';
import AccountManagement from './email/AccountManagement';

/**
 * Email Accounts page — separate tabs for Outlook and Gmail providers
 */
export default function EmailAccounts() {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    {id: 'outlook', content: 'Outlook / Hotmail', panelID: 'outlook-panel'},
    {id: 'gmail', content: 'Gmail', panelID: 'gmail-panel'}
  ];

  const provider = tabs[selectedTab].id;

  return (
    <Page title="Email Accounts" subtitle="Manage connected email accounts">
      <BlockStack gap="400">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
        <AccountManagement key={provider} provider={provider} />
      </BlockStack>
    </Page>
  );
}
