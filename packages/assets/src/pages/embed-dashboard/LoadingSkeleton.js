import React from 'react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineGrid,
  SkeletonDisplayText,
  SkeletonBodyText
} from '@shopify/polaris';

export default function LoadingSkeleton() {
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={2} />
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <InlineGrid columns={3} gap="400">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <SkeletonBodyText lines={3} />
              </Card>
            ))}
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
