import React from 'react';
import {Button, Layout, Page} from '@shopify/polaris';

const OptionalScopes = () => {
  const handleGrantExtraScopes = () => {
    shopify.scopes.request(['read_translations', 'read_customers']).then(response => {
      if (response.result === 'granted-all') {
        window.location.reload();
      }
    });
  };

  return (
    <Page title="Optional Scopes">
      <Layout>
        <Layout.Section>
          <Button onClick={handleGrantExtraScopes}>Grant extra scopes</Button>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default OptionalScopes;
