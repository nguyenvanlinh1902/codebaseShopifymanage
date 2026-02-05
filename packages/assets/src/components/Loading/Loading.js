import React from 'react';
import {SkeletonPage, Layout, Card, SkeletonBodyText} from '@shopify/polaris';

/**
 * Loading Component
 * Displayed while lazy components are loading
 */
export default function Loading() {
  return (
    <SkeletonPage primaryAction>
      <Layout>
        <Layout.Section>
          <Card>
            <SkeletonBodyText lines={10} />
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}
