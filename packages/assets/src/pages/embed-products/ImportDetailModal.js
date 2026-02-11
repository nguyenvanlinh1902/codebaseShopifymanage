import React from 'react';
import {Modal, BlockStack, InlineStack, Text, Badge, Divider} from '@shopify/polaris';

function formatTimestamp(ts) {
  if (!ts) return '-';
  return new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleString();
}

export default function ImportDetailModal({detail, onClose}) {
  return (
    <Modal
      open={!!detail}
      onClose={onClose}
      title={detail?.fileName || 'Import Details'}
      secondaryActions={[{content: 'Close', onAction: onClose}]}
    >
      {detail && (
        <Modal.Section>
          <BlockStack gap="400">
            <InlineStack gap="400">
              <Badge
                tone={
                  detail.status === 'completed'
                    ? 'success'
                    : detail.status === 'failed'
                    ? 'critical'
                    : detail.status === 'partial'
                    ? 'warning'
                    : 'info'
                }
              >
                {detail.status}
              </Badge>
              <Text variant="bodySm" tone="subdued">
                {formatTimestamp(detail.createdAt)}
              </Text>
            </InlineStack>

            <Divider />

            <InlineStack gap="600">
              <BlockStack gap="100">
                <Text variant="bodySm" tone="subdued">
                  Total
                </Text>
                <Text variant="headingMd">{detail.totalProducts || 0}</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text variant="bodySm" tone="subdued">
                  Success
                </Text>
                <Text variant="headingMd" tone="success">
                  {detail.successCount || 0}
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text variant="bodySm" tone="subdued">
                  Failed
                </Text>
                <Text variant="headingMd" tone="critical">
                  {detail.failedCount || 0}
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text variant="bodySm" tone="subdued">
                  Skipped
                </Text>
                <Text variant="headingMd">{detail.skippedCount || 0}</Text>
              </BlockStack>
            </InlineStack>

            {detail.storeName && (
              <>
                <Divider />
                <InlineStack gap="200">
                  <Text variant="bodySm" tone="subdued">
                    Store:
                  </Text>
                  <Text variant="bodySm">{detail.storeName}</Text>
                </InlineStack>
              </>
            )}

            {detail.failedProductDetails?.length > 0 && (
              <>
                <Divider />
                <Text variant="headingSm">Failed Products</Text>
                <BlockStack gap="200">
                  {detail.failedProductDetails.slice(0, 50).map((p, i) => (
                    <InlineStack key={i} gap="200" blockAlign="start">
                      <Badge tone="critical" size="small">
                        {i + 1}
                      </Badge>
                      <BlockStack gap="0">
                        <Text variant="bodySm" fontWeight="semibold">
                          {p.title}
                        </Text>
                        <Text variant="bodySm" tone="critical">
                          {p.error}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  ))}
                </BlockStack>
              </>
            )}

            {detail.products?.length > 0 && (
              <>
                <Divider />
                <Text variant="headingSm">Product Status</Text>
                <BlockStack gap="100">
                  {detail.products.slice(0, 100).map((p, i) => (
                    <InlineStack key={i} gap="200" blockAlign="center">
                      <Badge
                        size="small"
                        tone={
                          p.status === 'completed'
                            ? 'success'
                            : p.status === 'failed'
                            ? 'critical'
                            : p.status === 'skipped'
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {p.status}
                      </Badge>
                      <Text variant="bodySm">{p.title}</Text>
                      {p.error && (
                        <Text variant="bodySm" tone="critical">
                          - {p.error}
                        </Text>
                      )}
                    </InlineStack>
                  ))}
                </BlockStack>
              </>
            )}
          </BlockStack>
        </Modal.Section>
      )}
    </Modal>
  );
}
