import React, {useCallback, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {
  BlockStack,
  Text,
  ResourceList,
  ResourceItem,
  InlineStack,
  Badge,
  Button,
  SkeletonBodyText,
  EmptyState
} from '@shopify/polaris';
import {api} from '../../helpers/api';

function formatVn(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    return iso;
  }
}

/**
 * Per-group Discord forward history. Each row = one email successfully
 * claimed & sent to this group's channel. Lets admins verify what the digest
 * actually forwarded vs. what was silently skipped.
 */
export default function GroupHistoryPanel({groupId, onFlash}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/api/discord/groups/${groupId}/history?limit=50`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      setRows(body.data || []);
    } catch (err) {
      onFlash({tone: 'critical', message: err.message});
    } finally {
      setLoading(false);
    }
  }, [groupId, onFlash]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <BlockStack gap="400">
        <SkeletonBodyText lines={5} />
      </BlockStack>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState heading="No forwarded emails yet for this group" image="">
        <p>
          When the digest (cron or Run now) claims & posts an email to this group&apos;s Discord
          channel, it shows up here. If Run now returns 0 sent — check the debug breakdown in the
          flash message.
        </p>
      </EmptyState>
    );
  }

  return (
    <BlockStack gap="300">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" variant="headingSm">Recent forwards ({rows.length})</Text>
        <Button variant="plain" onClick={load}>Refresh</Button>
      </InlineStack>

      <ResourceList
        resourceName={{singular: 'email', plural: 'emails'}}
        items={rows}
        renderItem={row => (
          <ResourceItem id={row.id} accessibilityLabel={row.subject || row.messageId}>
            <BlockStack gap="050">
              <InlineStack gap="200" blockAlign="center">
                <Text variant="bodyMd" fontWeight="bold">
                  {row.subject || '(no subject)'}
                </Text>
                <Badge>{row.provider}</Badge>
                {row.sentAt ? (
                  <Badge tone="success">sent</Badge>
                ) : (
                  <Badge tone="attention">claimed</Badge>
                )}
              </InlineStack>
              <Text variant="bodySm" tone="subdued">
                {row.accountEmail} • msg {row.messageId}
              </Text>
              <Text variant="bodySm" tone="subdued">
                Sent: {formatVn(row.sentAt)} • Claimed: {formatVn(row.claimedAt)}
              </Text>
            </BlockStack>
          </ResourceItem>
        )}
      />
    </BlockStack>
  );
}

GroupHistoryPanel.propTypes = {
  groupId: PropTypes.string.isRequired,
  onFlash: PropTypes.func.isRequired
};
