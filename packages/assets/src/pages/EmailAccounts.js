import React from 'react';
import {Page} from '@shopify/polaris';
import AccountManagement from './email/AccountManagement';

/**
 * Email Accounts page — standalone route for managing Outlook/Hotmail connections
 */
export default function EmailAccounts() {
  return (
    <Page title="Email Accounts" subtitle="Manage connected email accounts">
      <AccountManagement />
    </Page>
  );
}
