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
  Spinner
} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Account management — list connected Gmail + Outlook accounts with connect/delete
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const connectAccount = useCallback(
    async provider => {
      try {
        setError(null);
        const endpoint = provider === 'outlook' ? '/api/outlook/auth-url' : '/api/gmail/auth-url';
        const res = await api(endpoint);
        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        const w = 500;
        const h = 600;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(
          result.data.authUrl,
          `${provider}-auth`,
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
              setError(event.data.error || `Failed to connect ${provider}`);
            }
          }
        };
        window.addEventListener('message', handleMessage);
      } catch (err) {
        setError(err.message);
      }
    },
    [fetchAccounts, onAccountChange]
  );

  const handleDelete = async account => {
    try {
      setActionLoading(true);
      const endpoint =
        account.provider === 'outlook' ? '/api/outlook/disconnect' : '/api/gmail/disconnect';
      const res = await api(endpoint, {
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
        <BlockStack gap="400" inlineAlign="center">
          <Spinner size="small" />
          <Text as="p" tone="subdued">
            Loading accounts...
          </Text>
        </BlockStack>
      </Card>
    );
  }

  const resourceName = {singular: 'account', plural: 'accounts'};
  const providerBadge = provider => {
    if (provider === 'outlook') return <Badge tone="attention">Outlook</Badge>;
    return <Badge tone="info">Gmail</Badge>;
  };

  return (
    <>
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text as="h2" variant="headingMd">
              Connected Email Accounts
            </Text>
            <InlineStack gap="200">
              <Button onClick={() => connectAccount('gmail')}>Connect Gmail</Button>
              <Button onClick={() => connectAccount('outlook')} variant="primary">
                Connect Outlook
              </Button>
            </InlineStack>
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
                Connect a Gmail or Outlook account to browse emails and set up Discord forwarding.
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={accounts.length}
              headings={[
                {title: 'Email'},
                {title: 'Provider'},
                {title: 'Connected'},
                {title: 'Actions'}
              ]}
              selectable={false}
            >
              {accounts.map((account, index) => (
                <IndexTable.Row id={account.email} key={account.email} position={index}>
                  <IndexTable.Cell>
                    <Text fontWeight="bold">{account.email}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{providerBadge(account.provider)}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {account.connectedAt
                        ? new Date(account.connectedAt).toLocaleDateString()
                        : '-'}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Button onClick={() => setDeleteConfirm(account)} size="slim" tone="critical">
                      Delete
                    </Button>
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
          title={`Delete ${deleteConfirm.provider === 'outlook' ? 'Outlook' : 'Gmail'} account?`}
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
