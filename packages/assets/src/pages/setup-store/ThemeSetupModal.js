import React, {useState} from 'react';
import {
  Modal, BlockStack, Text, Select, Badge, InlineStack,
  Spinner, Banner, IndexTable, ChoiceList
} from '@shopify/polaris';
import {api} from '../../helpers/api';

export default function ThemeSetupModal({
  open, onClose, stores, savedThemes, savedThemesLoading, onSuccess
}) {
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [selectedThemeId, setSelectedThemeId] = useState('');
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState([]);

  const formatFileSize = bytes => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const themeOptions = savedThemes.map(t => ({
    label: `${t.themeName} (${formatFileSize(t.fileSize)})`,
    value: t.id
  }));

  const storeChoices = stores.map(s => ({
    label: `${s.name || s.shopDomain} (${s.shopDomain}.myshopify.com)`,
    value: s.id
  }));

  const handleApply = async () => {
    if (!selectedThemeId || !selectedStoreIds.length) return;
    setApplying(true);
    setResults([]);
    const selectedTheme = savedThemes.find(t => t.id === selectedThemeId);
    const storeResults = [];

    for (const storeId of selectedStoreIds) {
      try {
        const res = await api(`/api/themes/imported/${selectedThemeId}/reimport`, {
          method: 'POST',
          body: JSON.stringify({storeId, themeName: selectedTheme?.themeName})
        });
        const data = await res.json();
        const store = stores.find(s => s.id === storeId);
        storeResults.push({
          storeId,
          storeName: store?.name || store?.shopDomain || storeId,
          success: data.success,
          message: data.success ? 'Theme import started' : (data.error || 'Failed')
        });
      } catch {
        storeResults.push({storeId, storeName: storeId, success: false, message: 'Request failed'});
      }
    }

    setResults(storeResults);
    const successCount = storeResults.filter(r => r.success).length;
    onSuccess(`Theme imported to ${successCount}/${storeResults.length} store(s).`);
    setApplying(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Theme"
      primaryAction={{
        content: 'Import Theme',
        onAction: handleApply,
        loading: applying,
        disabled: !selectedThemeId || !selectedStoreIds.length
      }}
      secondaryActions={[{content: 'Close', onAction: onClose}]}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Store selection */}
          <ChoiceList
            title="Select stores"
            allowMultiple
            choices={storeChoices}
            selected={selectedStoreIds}
            onChange={setSelectedStoreIds}
            disabled={applying}
          />

          {/* Theme selection */}
          {savedThemesLoading ? (
            <Spinner size="small" />
          ) : savedThemes.length === 0 ? (
            <Banner tone="warning">
              No saved themes found. Go to Themes page to import a theme first.
            </Banner>
          ) : (
            <Select
              label="Saved Theme"
              options={[{label: '-- Select Theme --', value: ''}, ...themeOptions]}
              value={selectedThemeId}
              onChange={setSelectedThemeId}
              disabled={applying}
            />
          )}

          {results.length > 0 && (
            <IndexTable
              resourceName={{singular: 'store', plural: 'stores'}}
              itemCount={results.length}
              headings={[{title: 'Store'}, {title: 'Status'}, {title: 'Message'}]}
              selectable={false}
            >
              {results.map((r, i) => (
                <IndexTable.Row id={r.storeId} key={r.storeId} position={i}>
                  <IndexTable.Cell><Text variant="bodySm">{r.storeName}</Text></IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={r.success ? 'success' : 'critical'}>{r.success ? 'OK' : 'Failed'}</Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell><Text variant="bodySm">{r.message}</Text></IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
