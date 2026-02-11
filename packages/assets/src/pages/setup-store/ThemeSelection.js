import React from 'react';
import {Card, Select, Text, Banner, BlockStack, SkeletonBodyText} from '@shopify/polaris';

export default function ThemeSelection({
  savedThemes,
  savedThemesLoading,
  selectedThemeId,
  onThemeChange,
  checking,
  applying,
  formatFileSize
}) {
  const themeOptions = [
    {label: 'No theme (metafields only)', value: ''},
    ...savedThemes.map(t => ({
      label: `${t.themeName} (${t.fileName}${
        t.fileSize ? ' - ' + formatFileSize(t.fileSize) : ''
      })`,
      value: t.id
    }))
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Theme (Optional)
        </Text>
        <Text tone="subdued" variant="bodySm">
          Optionally select a saved theme to import to the selected stores during setup.
        </Text>
        {savedThemesLoading ? (
          <SkeletonBodyText lines={2} />
        ) : savedThemes.length === 0 ? (
          <Banner tone="info">
            No saved themes available. Upload themes via the Themes page first.
          </Banner>
        ) : (
          <Select
            label="Select a saved theme"
            options={themeOptions}
            value={selectedThemeId}
            onChange={onThemeChange}
            disabled={checking || applying}
          />
        )}
      </BlockStack>
    </Card>
  );
}
