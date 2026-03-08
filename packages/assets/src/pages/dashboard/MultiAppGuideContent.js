import React, {useState} from 'react';
import {BlockStack, InlineStack, Text, List, Divider, Banner, Box, Button} from '@shopify/polaris';
import {ClipboardIcon} from '@shopify/polaris-icons';

const APP_URL = 'https://trackingorder-1c98b.firebaseapp.com';
const CALLBACK_URL = `${APP_URL}/api/authMultip/shopify/callback`;
const SCOPES = 'read_products,write_products,read_orders,write_orders,read_fulfillments,write_fulfillments,read_assigned_fulfillment_orders,write_assigned_fulfillment_orders,read_merchant_managed_fulfillment_orders,write_merchant_managed_fulfillment_orders,read_third_party_fulfillment_orders,write_third_party_fulfillment_orders,read_inventory,write_inventory,read_themes,write_themes,read_metaobjects,write_metaobjects,read_metaobject_definitions,write_metaobject_definitions,read_customers,read_shopify_payments_disputes,read_shopify_payments_payouts,read_shopify_payments_accounts,read_legal_policies,write_legal_policies,read_analytics,read_reports';

function CopyBox({value}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
      <InlineStack align="space-between" blockAlign="start" gap="200" wrap={false}>
        <Text variant="bodySm" as="p" breakWord>
          <code style={{wordBreak: 'break-all'}}>{value}</code>
        </Text>
        <div style={{flexShrink: 0}}>
          <Button
            size="slim"
            icon={ClipboardIcon}
            onClick={handleCopy}
            variant="plain"
            accessibilityLabel="Copy"
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </InlineStack>
    </Box>
  );
}

export default function MultiAppGuideContent() {
  return (
    <BlockStack gap="300">
      <Banner tone="info">
        <p>
          Connect a Shopify store using <strong>your own Partner App credentials</strong> (Client ID + Client Secret).
          Each partner app can manage its own store independently.
        </p>
      </Banner>

      <Text variant="bodySm" as="p" fontWeight="semibold">
        Step 1 — Configure your Partner App:
      </Text>
      <List type="number">
        <List.Item>
          Go to <strong>Shopify Partner Dashboard</strong> → Apps → your app → <strong>Configuration</strong>
        </List.Item>
        <List.Item>
          Add this <strong>Allowed redirection URL</strong>:
          <Box paddingBlockStart="150">
            <CopyBox value={CALLBACK_URL} />
          </Box>
        </List.Item>
        <List.Item>
          Set the <strong>API scopes</strong>:
          <Box paddingBlockStart="150">
            <CopyBox value={SCOPES} />
          </Box>
        </List.Item>
        <List.Item>Save, then copy your <strong>Client ID</strong> and <strong>Client Secret</strong></List.Item>
      </List>

      <Divider />

      <Text variant="bodySm" as="p" fontWeight="semibold">
        Step 2 — Connect the store:
      </Text>
      <List type="number">
        <List.Item>
          Open this URL in your browser (replace the placeholders):
          <Box paddingBlockStart="150">
            <CopyBox value={`${APP_URL}/api/authMultip/shopify?shop=[STORE-DOMAIN]&client_id=[CLIENT_ID]&client_secret=[CLIENT_SECRET]`} />
          </Box>
        </List.Item>
        <List.Item>Shopify will ask you to authorize the app — click <strong>Install</strong></List.Item>
        <List.Item>The store is automatically saved and the <code>orders/create</code> webhook is registered</List.Item>
      </List>
    </BlockStack>
  );
}
