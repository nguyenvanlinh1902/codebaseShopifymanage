import React, {useState, useEffect, useCallback, useMemo} from 'react';
import PropTypes from 'prop-types';
import {Layout, Card, Banner, BlockStack, SkeletonBodyText} from '@shopify/polaris';
import AccountSelector from './AccountSelector';
import EmailFiltersBar from './EmailFiltersBar';
import EmailListContent from './EmailListContent';
import EmailDetailPanel from './EmailDetailPanel';
import {useGmailEmails} from '../../hooks/useGmailEmails';

/**
 * Reusable email browser scoped to a single provider.
 */
export default function EmailBrowser({provider}) {
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
  } = useGmailEmails(selectedEmail, provider);

  const handleAccountSelect = useCallback(email => {
    setSelectedEmail(email);
    setSelectedMessage(null);
  }, [setSelectedMessage]);

  useEffect(() => {
    if (selectedEmail) {
      fetchEmails();
      fetchLabels();
    }
  }, [selectedEmail, fetchEmails, fetchLabels]);

  const [inboxTypeFilter, setInboxTypeFilter] = useState('all');

  const handleFilter = useCallback(
    ({query, label, inboxType}) => {
      if (inboxType !== undefined) setInboxTypeFilter(inboxType);
      fetchEmails(query, label);
    },
    [fetchEmails]
  );

  const filteredEmails = useMemo(() => {
    if (inboxTypeFilter === 'all') return emails;
    return emails.filter(e => e.inboxType === inboxTypeFilter);
  }, [emails, inboxTypeFilter]);

  const handleSelectMessage = useCallback(
    messageId => {
      fetchMessage(messageId);
    },
    [fetchMessage]
  );

  const showInitialState = !selectedEmail && !loading;
  const showListSkeleton = loading && emails.length === 0;

  return (
    <Layout>
      <Layout.Section variant="oneThird">
        <BlockStack gap="400">
          <Card>
            <AccountSelector
              provider={provider}
              selectedEmail={selectedEmail}
              onSelect={handleAccountSelect}
            />
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
              emails={filteredEmails}
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
  );
}

EmailBrowser.propTypes = {
  provider: PropTypes.oneOf(['outlook', 'gmail']).isRequired
};
