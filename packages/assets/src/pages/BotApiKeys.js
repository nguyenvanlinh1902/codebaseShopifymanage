import React, {useCallback, useEffect, useState} from 'react';
import {Page, Layout, Banner, Checkbox, InlineStack} from '@shopify/polaris';
import {Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useApi} from '../hooks/useApi';
import KeysList from './bot-api-keys/keys-list';
import CreateKeyModal from './bot-api-keys/create-key-modal';
import ShowRawKeyModal from './bot-api-keys/show-raw-key-modal';
import RevokeConfirmationModal from './bot-api-keys/revoke-confirmation-modal';

/**
 * Admin-only Bot API Keys page.
 * Shared admin pool: ALL admins see/revoke ALL keys.
 */
export default function BotApiKeys() {
  const {user} = useAuth();
  const isAdmin = user?.role === 'admin';
  const {get, post, request, loading, error, clearError} = useApi();

  const [keys, setKeys] = useState([]);
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rawModal, setRawModal] = useState({open: false, raw: '', name: ''});
  const [revokeState, setRevokeState] = useState({open: false, target: null, submitting: false});
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    const qs = includeRevoked ? '?includeRevoked=true' : '';
    const data = await get(`/api/bot-api-keys${qs}`);
    setKeys(Array.isArray(data) ? data : []);
  }, [get, includeRevoked, isAdmin]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const onCreate = async payload => {
    setCreating(true);
    try {
      const data = await post('/api/bot-api-keys', payload);
      setCreateOpen(false);
      setRawModal({open: true, raw: data?.raw || '', name: data?.key?.name || ''});
      setFlash('API key created');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async () => {
    const target = revokeState.target;
    if (!target) return;
    setRevokeState(s => ({...s, submitting: true}));
    try {
      await request(`/api/bot-api-keys/${target.id}/revoke`, {method: 'POST'});
      setFlash(`Revoked ${target.name || target.id}`);
      setRevokeState({open: false, target: null, submitting: false});
      await load();
    } catch {
      setRevokeState(s => ({...s, submitting: false}));
    }
  };

  return (
    <Page
      title="Bot API Keys"
      subtitle="Long-lived keys so external AI bots can call the API as a specific user"
      primaryAction={{content: 'Create new key', onAction: () => setCreateOpen(true)}}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={clearError}>{error}</Banner>
          </Layout.Section>
        )}
        {flash && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setFlash('')}>{flash}</Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <InlineStack align="end">
            <Checkbox label="Show revoked" checked={includeRevoked} onChange={setIncludeRevoked} />
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <KeysList
            keys={keys}
            loading={loading}
            onRevoke={key => setRevokeState({open: true, target: key, submitting: false})}
          />
        </Layout.Section>
      </Layout>

      <CreateKeyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreate}
        submitting={creating}
      />
      <ShowRawKeyModal
        open={rawModal.open}
        rawKey={rawModal.raw}
        keyName={rawModal.name}
        onClose={() => setRawModal({open: false, raw: '', name: ''})}
      />
      <RevokeConfirmationModal
        open={revokeState.open}
        keyName={revokeState.target?.name}
        keyPrefix={revokeState.target?.keyPrefix}
        submitting={revokeState.submitting}
        onConfirm={onRevoke}
        onClose={() => setRevokeState({open: false, target: null, submitting: false})}
      />
    </Page>
  );
}
