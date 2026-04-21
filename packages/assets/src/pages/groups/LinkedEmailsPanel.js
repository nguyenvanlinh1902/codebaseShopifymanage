import React, {useCallback, useEffect, useMemo, useState} from 'react';
import PropTypes from 'prop-types';
import {
  BlockStack,
  Text,
  Button,
  InlineStack,
  ResourceList,
  ResourceItem,
  Checkbox,
  Badge,
  TextField,
  SkeletonBodyText,
  EmptyState
} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Group membership matrix for every known Gmail/Outlook account. Admins tick
 * the boxes to attach/detach emails to this group — the only editable path is
 * via `linkedGroupIds`; store-derived membership is shown as a read-only badge.
 */
export default function LinkedEmailsPanel({groupId, onFlash}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [desiredEmails, setDesiredEmails] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/discord/groups/${groupId}/linked-emails`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      setRows(body.data || []);
      // Seed desired set from the server's current linkedGroupIds membership.
      setDesiredEmails(new Set(
        (body.data || []).filter(r => r.viaLinkedGroup).map(r => r.email)
      ));
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setLoading(false);
    }
  }, [groupId, onFlash]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.email.toLowerCase().includes(q)
      || (r.storeName || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const toggle = (email, next) => {
    setDesiredEmails(prev => {
      const copy = new Set(prev);
      if (next) copy.add(email); else copy.delete(email);
      return copy;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api(`/api/discord/groups/${groupId}/linked-emails`, {
        method: 'PUT',
        body: JSON.stringify({emails: Array.from(desiredEmails)})
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      onFlash({
        tone: 'success',
        message: `Linked emails updated: +${body.data.added} / -${body.data.removed}`
      });
      await load();
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BlockStack gap="400">
        <SkeletonBodyText lines={4} />
      </BlockStack>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState heading="No email accounts connected" image="">
        <p>Connect Gmail or Outlook accounts first, then come back here to assign them to this group.</p>
      </EmptyState>
    );
  }

  return (
    <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">Linked emails</Text>
          <Text as="p" tone="subdued" variant="bodySm">
            Tick an account to forward its emails to this group&apos;s Discord channel.
            Accounts already in this group via their store membership are locked
            on and shown with a badge.
          </Text>
        </BlockStack>

        <TextField
          label="Search"
          labelHidden
          value={query}
          onChange={setQuery}
          placeholder="Search by email or store..."
          autoComplete="off"
          clearButton
          onClearButtonClick={() => setQuery('')}
        />

        <ResourceList
          resourceName={{singular: 'email', plural: 'emails'}}
          items={filtered}
          renderItem={row => {
            const forced = row.viaStore || row.viaLinkedStore;
            const checked = forced || desiredEmails.has(row.email);
            return (
              <ResourceItem id={row.email} accessibilityLabel={row.email}>
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Checkbox
                      label=""
                      labelHidden
                      checked={checked}
                      disabled={forced}
                      onChange={next => toggle(row.email, next)}
                    />
                    <BlockStack gap="050">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="bold">{row.email}</Text>
                        <Badge>{row.authType}</Badge>
                      </InlineStack>
                      {row.storeName && (
                        <Text variant="bodySm" tone="subdued">
                          {row.storeName}
                        </Text>
                      )}
                    </BlockStack>
                  </InlineStack>
                  <InlineStack gap="200">
                    {row.viaStore && <Badge tone="info">via store</Badge>}
                    {row.viaLinkedStore && <Badge tone="info">via linked store</Badge>}
                    {row.viaLinkedGroup && !forced && <Badge tone="success">direct link</Badge>}
                  </InlineStack>
                </InlineStack>
              </ResourceItem>
            );
          }}
        />

      <Button variant="primary" onClick={handleSave} loading={saving}>
        Save linked emails
      </Button>
    </BlockStack>
  );
}

LinkedEmailsPanel.propTypes = {
  groupId: PropTypes.string.isRequired,
  onFlash: PropTypes.func.isRequired
};
