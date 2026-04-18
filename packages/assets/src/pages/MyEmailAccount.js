import React, {useState} from 'react';
import {Page, Tabs, BlockStack} from '@shopify/polaris';
import AccountManagement from './email/AccountManagement';

/**
 * My Email Account page — separate tabs per provider (Outlook / Gmail)
 */
export default function MyEmailAccount() {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    {id: 'outlook', content: 'Outlook / Hotmail', panelID: 'outlook-panel'},
    {id: 'gmail', content: 'Gmail', panelID: 'gmail-panel'}
  ];

  const provider = tabs[selectedTab].id;

  return (
    <Page title="My Email Account">
      <BlockStack gap="400">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
        <AccountManagement key={provider} provider={provider} />
      </BlockStack>
    </Page>
  );
}
