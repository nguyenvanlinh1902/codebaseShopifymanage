import React, {useState} from 'react';
import {Page, Tabs, BlockStack} from '@shopify/polaris';
import EmailBrowser from './email/EmailBrowser';

/**
 * Email Management page — separate tabs for Outlook and Gmail
 */
export default function EmailManagement() {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    {id: 'outlook', content: 'Outlook / Hotmail', panelID: 'outlook-panel'},
    {id: 'gmail', content: 'Gmail', panelID: 'gmail-panel'}
  ];

  const provider = tabs[selectedTab].id;

  return (
    <Page title="Email Management" fullWidth>
      <BlockStack gap="400">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
        <EmailBrowser key={provider} provider={provider} />
      </BlockStack>
    </Page>
  );
}
