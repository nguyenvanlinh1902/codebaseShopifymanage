import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, Card, Banner, BlockStack, SkeletonBodyText} from '@shopify/polaris';
import AccountSelector from './email/AccountSelector';
import EmailFiltersBar from './email/EmailFiltersBar';
import EmailListContent from './email/EmailListContent';
import EmailDetailPanel from './email/EmailDetailPanel';
import {useGmailEmails} from '../hooks/useGmailEmails';

/**
 * Email Management page — browse Outlook/Hotmail emails for connected accounts
 */
export default function EmailManagement() {
  const [selectedEmail, setSelectedEmail] = useState('');
  const {
    emails,
    loading,
    error,
    hasMore,
    selectedMessage,
    setSelectedMessage,
    labels,
    fetchEmails,
    fetchMore,
    fetchMessage,
    fetchLabels
  } = useGmailEmails(selectedEmail);

  const handleAccountSelect = useCallback(email => {
    setSelectedEmail(email);
  }, []);

  useEffect(() => {
    if (selectedEmail) {
      fetchEmails();
      fetchLabels();
    }
  }, [selectedEmail, fetchEmails, fetchLabels]);

  const handleFilter = useCallback(
    ({query, label}) => {
      fetchEmails(query, label);
    },
    [fetchEmails]
  );

  const handleSelectMessage = useCallback(
    messageId => {
      fetchMessage(messageId);
    },
    [fetchMessage]
  );

  const showInitialState = !selectedEmail && !loading;
  const showListSkeleton = loading && emails.length === 0;

  return (
    <Page title="Email Management" fullWidth>
      <Layout>
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <AccountSelector selectedEmail={selectedEmail} onSelect={handleAccountSelect} />
            </Card>

            {selectedEmail && (
              <Card>
                <EmailFiltersBar labels={labels} onFilter={handleFilter} />
              </Card>
            )}

            {showInitialState && (
              <Card>
                <Banner tone="info">
                  Select an email account to browse emails, or go to Accounts to connect one.
                </Banner>
              </Card>
            )}

            {showListSkeleton && (
              <Card>
                <BlockStack gap="300">
                  <SkeletonBodyText lines={3} />
                  <SkeletonBodyText lines={3} />
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              </Card>
            )}

            {!showListSkeleton && selectedEmail && (
              <EmailListContent
                emails={emails}
                loading={loading}
                hasMore={hasMore}
                onFetchMore={fetchMore}
                onSelectMessage={handleSelectMessage}
                selectedId={selectedMessage?.id}
              />
            )}

            {error && <Banner tone="critical">{error}</Banner>}
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <EmailDetailPanel
            message={selectedMessage}
            loading={loading && !selectedMessage}
            onClose={() => setSelectedMessage(null)}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
