import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {
  Card, IndexTable, Text, Badge, Button, InlineStack, BlockStack,
  Banner, EmptyState, Modal, Spinner
} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Account management tab — list connected Gmail accounts with connect/delete
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
      const res = await api('/api/gmail/accounts');
      const result = await res.json();
      if (result.success) setAccounts(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const connectGmail = useCallback(async () => {
    try {
      setError(null);
      const res = await api('/api/gmail/auth-url');
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const w = 500, h = 600;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(result.data.authUrl, 'gmail-auth',
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`);

      const handleMessage = event => {
        if (event.data?.type === 'google-auth-callback') {
          window.removeEventListener('message', handleMessage);
          if (event.data.success) {
            setSuccess(`Connected ${event.data.googleEmail || 'account'}`);
            fetchAccounts();
            onAccountChange?.();
          } else {
            setError(event.data.error || 'Failed to connect Gmail');
          }
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchAccounts, onAccountChange]);

  const handleDelete = async (email) => {
    try {
      setActionLoading(true);
      const res = await api('/api/gmail/disconnect', {
        method: 'POST',
        body: JSON.stringify({email})
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setSuccess(`Deleteed ${email}`);
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
          <Text as="p" tone="subdued">Loading accounts...</Text>
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
            <Text as="h2" variant="headingMd">Connected Gmail Accounts</Text>
            <Button onClick={connectGmail} variant="primary">Connect Gmail Account</Button>
          </InlineStack>

          {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}
          {success && <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}

          {accounts.length === 0 ? (
            <EmptyState
              heading="No Gmail accounts connected"
              image=""
              action={{content: 'Connect Gmail', onAction: connectGmail}}
            >
              <p>Connect a Gmail account to browse emails and set up Discord forwarding.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={accounts.length}
              headings={[
                {title: 'Email'},
                {title: 'Type'},
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
                  <IndexTable.Cell>
                    <Badge tone={account.authType === 'gmail' ? 'info' : undefined}>
                      {account.authType === 'gmail' ? 'Gmail' : 'Shared'}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {account.connectedAt ? new Date(account.connectedAt).toLocaleDateString() : '-'}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Button
                      onClick={() => setDeleteConfirm(account)}
                      size="slim"
                      tone="critical"
                    >
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
          title="Delete Gmail account?"
          primaryAction={{
            content: 'Delete',
            destructive: true,
            loading: actionLoading,
            onAction: () => handleDelete(deleteConfirm.email)
          }}
          secondaryActions={[{content: 'Cancel', onAction: () => setDeleteConfirm(null)}]}
        >
          <Modal.Section>
            <Text as="p">
              Are you sure you want to delete <strong>{deleteConfirm.email}</strong>?
              This will remove the account, stop any active email watches and Discord forwarding.
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
