import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Banner,
  Spinner
} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Watch status — shows all Gmail accounts with Start/Stop watch controls
 * Fetches Gmail accounts list + existing watch records to show combined view
 */
export default function WatchStatusContent({watchStatuses, onRefresh}) {
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Fetch Gmail + Outlook accounts to show all (not just watched ones)
  const fetchAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const [gmailRes, outlookRes] = await Promise.all([
        api('/api/gmail/accounts').then(r => r.json()),
        api('/api/outlook/accounts').then(r => r.json())
      ]);
      const gmail = (gmailRes.success ? gmailRes.data : []).map(a => ({...a, provider: 'gmail'}));
      const outlook = (outlookRes.success ? outlookRes.data : []).map(a => ({
        ...a,
        provider: 'outlook'
      }));
      setAccounts([...gmail, ...outlook]);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleStartWatch = async (email, provider) => {
    try {
      setActionLoading(email);
      const endpoint = provider === 'outlook' ? '/api/outlook/watch' : '/api/gmail/watch';
      const res = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({email})
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      onRefresh();
    } catch (err) {
      console.error('Failed to start watch:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopWatch = async (email, provider) => {
    try {
      setActionLoading(email);
      const endpoint = provider === 'outlook' ? '/api/outlook/watch/stop' : '/api/gmail/watch/stop';
      await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({email})
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to stop watch:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getWatchForEmail = (email, provider) => {
    if (provider === 'outlook') {
      return watchStatuses.find(w => w.email === email);
    }
    return watchStatuses.find(w => w.googleEmail === email);
  };

  const getStatusBadge = watch => {
    if (!watch) return <Badge>Not watching</Badge>;
    if (watch.status === 'active') {
      const hoursLeft = Math.round(
        (new Date(watch.watchExpiration) - Date.now()) / (1000 * 60 * 60)
      );
      if (hoursLeft < 24) return <Badge tone="warning">Expiring ({hoursLeft}h)</Badge>;
      return <Badge tone="success">Active</Badge>;
    }
    if (watch.status === 'error') return <Badge tone="critical">Error</Badge>;
    return <Badge>Expired</Badge>;
  };

  if (loadingAccounts) {
    return (
      <Card>
        <BlockStack gap="200" inlineAlign="center">
          <Spinner size="small" />
          <Text as="p" tone="subdued">
            Loading accounts...
          </Text>
        </BlockStack>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <Banner tone="info">
          No email accounts connected. Go to <strong>Email Management → Accounts</strong> to connect
          one first.
        </Banner>
      </Card>
    );
  }

  const resourceName = {singular: 'account', plural: 'accounts'};
  const hasErrors = watchStatuses.some(w => w.status === 'error');

  const rowMarkup = accounts.map((account, index) => {
    const watch = getWatchForEmail(account.email, account.provider);
    const isActive = watch?.status === 'active';
    const providerLabel = account.provider === 'outlook' ? 'Outlook' : 'Gmail';

    return (
      <IndexTable.Row id={account.email} key={account.email} position={index}>
        <IndexTable.Cell>
          <Text fontWeight="bold">{account.email}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={account.provider === 'outlook' ? 'attention' : 'info'}>
            {providerLabel}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{getStatusBadge(watch)}</IndexTable.Cell>
        <IndexTable.Cell>
          {watch?.watchExpiration ? new Date(watch.watchExpiration).toLocaleDateString() : '-'}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {watch?.lastSyncTime ? new Date(watch.lastSyncTime).toLocaleString() : 'Never'}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {watch?.renewalError ? (
            <Text as="span" tone="critical" variant="bodySm">
              {watch.renewalError}
            </Text>
          ) : (
            <Text as="span" tone="subdued">
              -
            </Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {isActive ? (
            <Button
              onClick={() => handleStopWatch(account.email, account.provider)}
              size="slim"
              tone="critical"
              loading={actionLoading === account.email}
              disabled={!!actionLoading}
            >
              Stop
            </Button>
          ) : (
            <Button
              onClick={() => handleStartWatch(account.email, account.provider)}
              size="slim"
              variant="primary"
              loading={actionLoading === account.email}
              disabled={!!actionLoading}
            >
              Start Watch
            </Button>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text as="h2" variant="headingMd">
            Email Watch Status
          </Text>
          <Button
            onClick={() => {
              onRefresh();
              fetchAccounts();
            }}
            size="slim"
          >
            Refresh
          </Button>
        </InlineStack>

        <Banner tone="info">
          Click <strong>Start Watch</strong> to begin listening for new emails on an account. New
          emails will be auto-forwarded to Discord based on your filter rules.
        </Banner>

        {hasErrors && (
          <Banner tone="warning">
            Some watches have errors. They will be retried during the daily renewal (2 AM UTC).
          </Banner>
        )}

        <IndexTable
          resourceName={resourceName}
          itemCount={accounts.length}
          headings={[
            {title: 'Email'},
            {title: 'Provider'},
            {title: 'Status'},
            {title: 'Expires'},
            {title: 'Last Sync'},
            {title: 'Error'},
            {title: 'Actions'}
          ]}
          selectable={false}
        >
          {rowMarkup}
        </IndexTable>
      </BlockStack>
    </Card>
  );
}

WatchStatusContent.propTypes = {
  watchStatuses: PropTypes.array.isRequired,
  onRefresh: PropTypes.func.isRequired
};
