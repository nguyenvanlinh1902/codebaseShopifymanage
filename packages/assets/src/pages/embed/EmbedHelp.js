import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Collapsible,
  Button,
  Icon,
  Box,
  Badge,
  Divider
} from '@shopify/polaris';
import {
  ProductIcon,
  OrderIcon,
  NoteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EmailIcon
} from '@shopify/polaris-icons';

const STEPS = [
  {
    title: 'Import Products',
    description: 'Upload a CSV file to bulk import products into your Shopify store.',
    icon: ProductIcon,
    bg: 'bg-fill-info-secondary'
  },
  {
    title: 'Connect Google Sheets',
    description: 'Link your Google account to enable order syncing to spreadsheets.',
    icon: NoteIcon,
    bg: 'bg-fill-caution-secondary'
  },
  {
    title: 'Sync Orders',
    description: 'Select a sheet and start syncing orders automatically or on-demand.',
    icon: OrderIcon,
    bg: 'bg-fill-success-secondary'
  }
];

const FAQ_ITEMS = [
  {
    question: 'How do I import products from a CSV file?',
    answer:
      'Navigate to the Products page, then click "Upload & Import" tab. Drag and drop your CSV file or click to browse. The app supports standard Shopify CSV format. You can download a template from the import page.'
  },
  {
    question: 'How do I sync orders to Google Sheets?',
    answer:
      'First, connect your Google account from the Orders page. Then select a Google Sheet and tab to sync orders to. Click "Sync Now" to start a manual sync, or configure automatic sync from Settings.'
  },
  {
    question: 'How do I connect my Google account?',
    answer:
      'Go to the Orders page and click "Connect Google Account". You will be redirected to Google to authorize access. The app only requests access to Google Sheets — no other Google data is accessed.'
  },
  {
    question: 'What data does this app collect?',
    answer:
      'The app collects store information, product data (during import), order data (during sync), and Google Sheets metadata. We do not sell or share your data with third parties. See our Privacy Policy for full details.'
  },
  {
    question: 'How do I uninstall the app?',
    answer:
      'Go to your Shopify Admin > Settings > Apps and sales channels > ToolTrackingOrder > Remove app. All your data will be deleted within 48 hours of uninstallation as required by Shopify.'
  },
  {
    question: 'Why are my orders not syncing?',
    answer:
      'Check that: 1) Your Google account is connected, 2) A sync configuration is set up with a valid sheet and tab, 3) The sheet has not been deleted or renamed. Try disconnecting and reconnecting your Google account if issues persist.'
  }
];

function StepCard({step, number}) {
  return (
    <Card>
      <InlineStack gap="400" blockAlign="center" wrap={false}>
        <Box background={step.bg} borderRadius="300" padding="300" minWidth="44px">
          <Icon source={step.icon} />
        </Box>
        <BlockStack gap="100">
          <InlineStack gap="200" blockAlign="center">
            <Badge size="small">{`Step ${number}`}</Badge>
            <Text variant="headingSm" as="h3" fontWeight="semibold">{step.title}</Text>
          </InlineStack>
          <Text variant="bodySm" tone="subdued">{step.description}</Text>
        </BlockStack>
      </InlineStack>
    </Card>
  );
}

StepCard.propTypes = {
  step: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    icon: PropTypes.func.isRequired,
    bg: PropTypes.string.isRequired
  }).isRequired,
  number: PropTypes.number.isRequired
};

function FaqItem({item, open, onToggle}) {
  return (
    <BlockStack gap="0">
      <Box
        paddingBlockStart="300"
        paddingBlockEnd="300"
        role="button"
        onClick={onToggle}
        style={{cursor: 'pointer'}}
      >
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <Text variant="bodyMd" fontWeight="medium">{item.question}</Text>
          <Icon source={open ? ChevronUpIcon : ChevronDownIcon} tone="subdued" />
        </InlineStack>
      </Box>
      <Collapsible open={open} transition={{duration: '200ms'}}>
        <Box paddingBlockEnd="300">
          <Text variant="bodyMd" tone="subdued">{item.answer}</Text>
        </Box>
      </Collapsible>
    </BlockStack>
  );
}

FaqItem.propTypes = {
  item: PropTypes.shape({
    question: PropTypes.string.isRequired,
    answer: PropTypes.string.isRequired
  }).isRequired,
  open: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired
};

export default function EmbedHelp() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFaq = index => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <Page title="Help & Support" subtitle="Learn how to use ToolTrackingOrder">
      <Layout>
        {/* Getting Started */}
        <Layout.Section>
          <Text variant="headingMd" as="h2">Getting Started</Text>
          <Box paddingBlockStart="300">
            <BlockStack gap="300">
              {STEPS.map((step, i) => (
                <StepCard key={i} step={step} number={i + 1} />
              ))}
            </BlockStack>
          </Box>
        </Layout.Section>

        {/* FAQ */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Frequently Asked Questions</Text>
              <BlockStack gap="0">
                {FAQ_ITEMS.map((item, index) => (
                  <Box key={index}>
                    <FaqItem
                      item={item}
                      open={openIndex === index}
                      onToggle={() => toggleFaq(index)}
                    />
                    {index < FAQ_ITEMS.length - 1 && <Divider />}
                  </Box>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Contact & App Info side by side */}
        <Layout.Section>
          <InlineStack gap="400" align="start" wrap={false}>
            <Box minWidth="50%">
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="300" blockAlign="center">
                    <Box background="bg-fill-info-secondary" borderRadius="300" padding="200">
                      <Icon source={EmailIcon} />
                    </Box>
                    <Text variant="headingSm" as="h3" fontWeight="semibold">Contact Support</Text>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    Need help? Our team is available to assist you with any questions or issues.
                  </Text>
                  <Button url="mailto:support@trackingorder.mam3.site" external>
                    Email Support
                  </Button>
                </BlockStack>
              </Card>
            </Box>
            <Box minWidth="50%">
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3" fontWeight="semibold">App Information</Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text variant="bodySm" tone="subdued">App Name</Text>
                      <Text variant="bodySm" fontWeight="medium">ToolTrackingOrder</Text>
                    </InlineStack>
                    <Divider />
                    <InlineStack align="space-between">
                      <Text variant="bodySm" tone="subdued">Version</Text>
                      <Text variant="bodySm" fontWeight="medium">1.0.0</Text>
                    </InlineStack>
                    <Divider />
                    <InlineStack align="space-between">
                      <Text variant="bodySm" tone="subdued">API Version</Text>
                      <Text variant="bodySm" fontWeight="medium">2026-01</Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
