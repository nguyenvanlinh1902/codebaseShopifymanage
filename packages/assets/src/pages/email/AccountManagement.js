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
  EmptyState,
  Modal,
  SkeletonBodyText
} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Account management — list connected Outlook/Hotmail accounts with connect/delete
 */
export default function AccountManagement({onAccountChange}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/outlook/accounts');
      const result = await res.json();
      if (result.success) setAccounts(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const connectAccount = useCallback(async (loginHint) => {
    try {
      setError(null);
      const url = loginHint
        ? `/api/outlook/auth-url?login_hint=${encodeURIComponent(loginHint)}`
        : '/api/outlook/auth-url';
      const res = await api(url);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const w = 500;
      const h = 600;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(
        result.data.authUrl,
        'outlook-auth',
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`
      );

      const handleMessage = event => {
        if (
          event.data?.type === 'google-auth-callback' ||
          event.data?.type === 'outlook-auth-callback'
        ) {
          window.removeEventListener('message', handleMessage);
          if (event.data.success) {
            setSuccess(`Connected ${event.data.googleEmail || event.data.email || 'account'}`);
            fetchAccounts();
            onAccountChange?.();
          } else {
            setError(event.data.error || 'Failed to connect Outlook');
          }
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchAccounts, onAccountChange]);

  const handleStartWatch = async email => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await api('/api/outlook/watch', {
        method: 'POST',
        body: JSON.stringify({email})
      });
      const result = await res.json();
      if (!result.success) {
        // Token expired — prompt user to reconnect
        if (result.code === 'TOKEN_EXPIRED') {
          setError(`Token expired for ${email}. Please reconnect the account.`);
          fetchAccounts();
          return;
        }
        throw new Error(result.error);
      }
      setSuccess(`Watch started for ${email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async account => {
    try {
      setActionLoading(true);
      const res = await api('/api/outlook/disconnect', {
        method: 'POST',
        body: JSON.stringify({email: account.email})
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setSuccess(`Deleted ${account.email}`);
      setDeleteConfirm(null);
      fetchAccounts();
      onAccountChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <BlockStack gap="400">
          <SkeletonBodyText lines={5} />
        </BlockStack>
      </Card>
    );
  }

  const resourceName = {singular: 'account', plural: 'accounts'};

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text as="h2" variant="headingMd">
              Connected Email Accounts
            </Text>
            <Button onClick={connectAccount} variant="primary">
              Connect Outlook / Hotmail
            </Button>
          </InlineStack>

          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          )}
          {success && (
            <Banner tone="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Banner>
          )}

          {accounts.length === 0 ? (
            <EmptyState heading="No email accounts connected" image="">
              <p>
                Connect an Outlook or Hotmail account to browse emails and set up Discord
                forwarding.
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={accounts.length}
              headings={[
                {title: 'Email'},
                {title: 'Type'},
                {title: 'Status'},
                {title: 'Connected'},
                {title: 'Last Refreshed'},
                {title: 'Actions'}
              ]}
              selectable={false}
            >
              {accounts.map((account, index) => (
                <IndexTable.Row id={account.email} key={account.email} position={index}>
                  <IndexTable.Cell>
                    <Text fontWeight="bold">{account.email}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone="attention">Outlook</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={account.authStatus === 'expired' ? 'critical' : 'success'}>
                      {account.authStatus === 'expired' ? 'Expired' : 'Active'}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {account.connectedAt
                        ? new Date(account.connectedAt).toLocaleDateString()
                        : '-'}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {account.lastRefreshed
                        ? new Date(account.lastRefreshed).toLocaleString()
                        : '-'}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200">
                      {account.authStatus === 'expired' ? (
                        <Button onClick={() => connectAccount(account.email)} size="slim" variant="primary" tone="critical">
                          Reconnect
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleStartWatch(account.email)}
                          size="slim"
                          loading={actionLoading}
                        >
                          Start Watch
                        </Button>
                      )}
                      <Button onClick={() => setDeleteConfirm(account)} size="slim" tone="critical">
                        Delete
                      </Button>
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </BlockStack>
      </Card>

      {deleteConfirm && (
        <Modal
          open
          onClose={() => setDeleteConfirm(null)}
          title="Delete Outlook account?"
          primaryAction={{
            content: 'Delete',
            destructive: true,
            loading: actionLoading,
            onAction: () => handleDelete(deleteConfirm)
          }}
          secondaryActions={[{content: 'Cancel', onAction: () => setDeleteConfirm(null)}]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete <strong>{deleteConfirm.email}</strong>? This will
              remove the account, stop any active email watches and Discord forwarding.
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </>
  );
}

AccountManagement.propTypes = {
  onAccountChange: PropTypes.func
};
