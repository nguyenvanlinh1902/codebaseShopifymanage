/* eslint-disable react/prop-types */
import React, {useState, useEffect} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Spinner,
  Modal,
  Checkbox
} from '@shopify/polaris';
import {api} from '../../helpers/api';

export default function ProductPublishing({formData, onChange, storeId, productId, isNew}) {
  const [allChannels, setAllChannels] = useState([]);
  const [publishedIds, setPublishedIds] = useState(new Set());
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState(new Set());
  const [savingPublish, setSavingPublish] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoadingChannels(true);
    api(`/api/shopify-products/sales-channels?storeId=${storeId}`)
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          const channels = result.data || [];
          setAllChannels(channels);
          if (isNew) {
            const ids = channels.map(c => c.id);
            setPublishedIds(new Set(ids));
            onChange('_publishIds', ids);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingChannels(false));
  }, [storeId, isNew]);

  useEffect(() => {
    // Sync from formData.publications for edit mode
    if (!productId || !formData.publications) return;
    const ids = (formData.publications || []).map(p => p.id || p.channelId || p);
    setPublishedIds(new Set(ids));
  }, [productId, formData.publications]);

  const openManage = () => {
    setPendingIds(new Set(publishedIds));
    setManageOpen(true);
  };

  const handleSavePublishing = async () => {
    if (!productId || isNew) {
      setPublishedIds(new Set(pendingIds));
      onChange('_publishIds', [...pendingIds]);
      setManageOpen(false);
      return;
    }
    const toPublish = [...pendingIds].filter(id => !publishedIds.has(id));
    const toUnpublish = [...publishedIds].filter(id => !pendingIds.has(id));
    if (toPublish.length === 0 && toUnpublish.length === 0) {
      setManageOpen(false);
      return;
    }
    try {
      setSavingPublish(true);
      await api(`/api/shopify-products/${productId}/publish`, {
        method: 'PUT',
        body: JSON.stringify({
          storeId,
          publishIds: toPublish.length > 0 ? toPublish : undefined,
          unpublishIds: toUnpublish.length > 0 ? toUnpublish : undefined
        })
      });
      setPublishedIds(new Set(pendingIds));
      setManageOpen(false);
    } catch {
      // silently fail
    } finally {
      setSavingPublish(false);
    }
  };

  const publishedChannels = allChannels.filter(c => publishedIds.has(c.id));
  const unpublishedChannels = allChannels.filter(c => !publishedIds.has(c.id));

  return (
    <>
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingSm">
              Publishing
            </Text>
            {allChannels.length > 0 && (
              <Button variant="plain" onClick={openManage}>
                Manage
              </Button>
            )}
          </InlineStack>
          <Text as="p" variant="bodySm" fontWeight="medium">
            Sales channels
          </Text>
          {loadingChannels ? (
            <Spinner size="small" />
          ) : allChannels.length === 0 ? (
            <Text as="p" variant="bodySm" tone="subdued">
              No sales channels available
            </Text>
          ) : publishedChannels.length === 0 ? (
            <Text as="p" variant="bodySm" tone="subdued">
              Not included in any sales channels
            </Text>
          ) : (
            <BlockStack gap="100">
              {publishedChannels.map(ch => (
                <InlineStack key={ch.id} gap="200" blockAlign="center">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#22c55e',
                      flexShrink: 0
                    }}
                  />
                  <Text as="span" variant="bodySm">
                    {ch.name}
                  </Text>
                </InlineStack>
              ))}
              {unpublishedChannels.length > 0 && (
                <InlineStack gap="200" blockAlign="start">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#d1d5db',
                      flexShrink: 0,
                      marginTop: 4
                    }}
                  />
                  <Text as="span" variant="bodySm" tone="subdued">
                    {unpublishedChannels.map(c => c.name).join(', ')}
                  </Text>
                </InlineStack>
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage sales channels"
        primaryAction={{content: 'Done', onAction: handleSavePublishing, loading: savingPublish}}
        secondaryActions={[{content: 'Cancel', onAction: () => setManageOpen(false)}]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            {allChannels.map(ch => (
              <Checkbox
                key={ch.id}
                label={ch.name}
                checked={pendingIds.has(ch.id)}
                onChange={checked => {
                  setPendingIds(prev => {
                    const next = new Set(prev);
                    if (checked) next.add(ch.id);
                    else next.delete(ch.id);
                    return next;
                  });
                }}
              />
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
