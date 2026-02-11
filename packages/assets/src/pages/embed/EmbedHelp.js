import React, {useState} from 'react';
import {Page, Layout, Card, Text, BlockStack, InlineStack, Box, Divider} from '@shopify/polaris';
import StepCard from './embed-help/StepCard';
import FaqItem from './embed-help/FaqItem';
import ContactSupport from './embed-help/ContactSupport';
import AppInfo from './embed-help/AppInfo';
import {STEPS, FAQ_ITEMS} from './embed-help/constants';

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
          <Text variant="headingMd" as="h2">
            Getting Started
          </Text>
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
              <Text variant="headingMd" as="h2">
                Frequently Asked Questions
              </Text>
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
              <ContactSupport />
            </Box>
            <Box minWidth="50%">
              <AppInfo />
            </Box>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
