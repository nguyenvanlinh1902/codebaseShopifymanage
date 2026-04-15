import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Card,
  Text,
  Button,
  InlineStack,
  BlockStack,
  Banner,
  Badge,
  SkeletonBodyText,
  SkeletonDisplayText,
  Modal
} from '@shopify/polaris';
import {api} from '../helpers/api';

/**
 * My Email Account page — each user can connect multiple Outlook/Hotmail accounts
 */
export default function MyEmailAccount() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [disconnectEmail, setDisconnectEmail] = useState(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/outlook/accounts');
      const result = await res.json();
      setAccounts(result.success ? result.data || [] : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const connectAccount = useCallback(async () => {
    try {
      setError(null);
      const res = await api('/api/outlook/auth-url');
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
          } else {
            setError(event.data.error || 'Failed to connect');
          }
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchAccounts]);

  const disconnectAccount = async () => {
    try {
      setActionLoading(true);
      const res = await api('/api/outlook/disconnect', {
        method: 'POST',
        body: JSON.stringify({email: disconnectEmail})
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setSuccess(`Disconnected ${disconnectEmail}`);
      setAccounts(prev => prev.filter(a => a.email !== disconnectEmail));
      setDisconnectEmail(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Page title="My Email Account">
        <Card>
          <BlockStack gap="400">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={3} />
          </BlockStack>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="My Email Account">
      <BlockStack gap="400">
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

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Outlook / Hotmail Accounts
              </Text>
              <Button onClick={connectAccount} variant="primary">
                Connect Account
              </Button>
            </InlineStack>

            {accounts.length === 0 ? (
              <Text as="p" tone="subdued">
                No email account connected. Connect your Outlook or Hotmail account.
              </Text>
            ) : (
              <BlockStack gap="300">
                {accounts.map(account => (
                  <InlineStack
                    key={account.email}
                    gap="300"
                    align="space-between"
                    blockAlign="center"
                  >
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span" fontWeight="bold">
                        {account.email}
                      </Text>
                      <Badge tone="success">Connected</Badge>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {account.connectedAt
                          ? new Date(account.connectedAt).toLocaleDateString()
                          : ''}
                      </Text>
                    </InlineStack>
                    <Button
                      onClick={() => setDisconnectEmail(account.email)}
                      tone="critical"
                      size="slim"
                    >
                      Disconnect
                    </Button>
                  </InlineStack>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {disconnectEmail && (
          <Modal
            open
            onClose={() => setDisconnectEmail(null)}
            title="Disconnect account?"
            primaryAction={{
              content: 'Disconnect',
              destructive: true,
              loading: actionLoading,
              onAction: disconnectAccount
            }}
            secondaryActions={[{content: 'Cancel', onAction: () => setDisconnectEmail(null)}]}
          >
            <Modal.Section>
              <Text as="p">
                Are you sure you want to disconnect <strong>{disconnectEmail}</strong>?
              </Text>
            </Modal.Section>
          </Modal>
        )}
      </BlockStack>
    </Page>
  );
}
