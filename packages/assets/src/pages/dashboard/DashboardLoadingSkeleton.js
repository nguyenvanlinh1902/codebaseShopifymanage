import React from 'react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  SkeletonDisplayText,
  SkeletonBodyText
} from '@shopify/polaris';

export default function DashboardLoadingSkeleton() {
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{flex: 1}}>
                <Card>
                  <BlockStack gap="200">
                    <SkeletonDisplayText size="small" />
                    <SkeletonBodyText lines={2} />
                  </BlockStack>
                </Card>
              </div>
            ))}
          </InlineStack>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <SkeletonBodyText lines={10} />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
