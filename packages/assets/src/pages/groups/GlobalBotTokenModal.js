import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {Modal, BlockStack, Text, TextField, Banner} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Admin modal to set or rotate the Discord bot token shared by every store
 * group. Validates against Discord on save, so stale / malformed tokens are
 * rejected before touching Firestore.
 */
export default function GlobalBotTokenModal({open, current, onClose, onSaved, onFlash}) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    try {
      const res = await api('/api/discord/groups/global-config', {
        method: 'PUT',
        body: JSON.stringify({botToken: token})
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      setToken('');
      onFlash({
        tone: 'success',
        message: `Saved bot "${body.data.botUsername}". All groups now share this token.`
      });
      onSaved();
      onClose();
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Discord Bot Token (global)"
      primaryAction={{
        content: current?.hasToken ? 'Rotate token' : 'Save token',
        onAction: handleSave,
        loading: saving,
        disabled: !token.trim()
      }}
      secondaryActions={[{content: 'Cancel', onAction: onClose}]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {current?.hasToken ? (
            <Banner tone="info">
              Current bot: <b>{current.botUsername || '(unknown)'}</b>. Pasting a new token replaces it.
            </Banner>
          ) : (
            <Banner tone="warning">
              No token configured. All groups need this to forward emails.
            </Banner>
          )}
          <Text as="p" variant="bodySm" tone="subdued">
            Developer Portal → your App → <b>Bot</b> → <b>Reset Token</b> → copy the new token
            (shown once). Then paste below. The bot is shared across all store groups — each group
            only picks its own channel.
          </Text>
          <TextField
            label="Bot Token"
            type="password"
            value={token}
            onChange={setToken}
            placeholder="Paste the Discord bot token"
            autoComplete="off"
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

GlobalBotTokenModal.propTypes = {
  open: PropTypes.bool.isRequired,
  current: PropTypes.shape({
    hasToken: PropTypes.bool,
    botUsername: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
  onFlash: PropTypes.func.isRequired
};
