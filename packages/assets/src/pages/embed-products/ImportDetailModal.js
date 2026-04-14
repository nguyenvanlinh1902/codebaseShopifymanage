import React from 'react';
import {Modal, BlockStack, InlineStack, Text, Badge, Divider} from '@shopify/polaris';

function formatTimestamp(ts) {
  if (!ts) return '-';
  return new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleString();
}

/** Group failed products by error message for concise display */
function renderGroupedErrors(failures) {
  // Group by error message
  const groups = {};
  for (const f of failures) {
    const msg = f.message || f.error || 'Unknown error';
    if (!groups[msg]) groups[msg] = [];
    groups[msg].push(f.title);
  }

  const entries = Object.entries(groups);
  return (
    <BlockStack gap="300">
      {entries.map(([msg, titles], i) => (
        <BlockStack key={i} gap="100">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="critical" size="small">{titles.length}x</Badge>
            <Text variant="bodySm" tone="critical">{msg}</Text>
          </InlineStack>
          <Text variant="bodySm" tone="subdued">
            {titles.length <= 3 ? titles.join(', ') : `${titles.slice(0, 3).join(', ')} +${titles.length - 3} more`}
          </Text>
        </BlockStack>
      ))}
    </BlockStack>
  );
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
              {(detail.totalVariants || 0) > 0 && (
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">
                    Variants
                  </Text>
                  <Text variant="headingMd">{detail.totalVariants}</Text>
                </BlockStack>
              )}
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
                <Text variant="headingSm">Failed Products ({detail.failedProductDetails.length})</Text>
                {renderGroupedErrors(detail.failedProductDetails)}
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
                      <Text variant="bodySm">
                        {p.title}{p.variantCount > 1 ? ` (${p.variantCount} variants)` : ''}
                      </Text>
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
