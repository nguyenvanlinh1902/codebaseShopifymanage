import React, {useState, useEffect, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Select,
  IndexTable,
  Button,
  TextField,
  Banner,
  SkeletonBodyText,
  EmptyState,
  Badge,
  InlineStack,
  Text,
  BlockStack,
  Spinner,
  Tabs,
  DropZone,
  ChoiceList,
  Modal
} from '@shopify/polaris';
import {RefreshIcon, DeleteIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';

export default function Themes() {
  const [selectedTab, setSelectedTab] = useState(0);

  // Stores
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);

  // Tab 1: Theme List + Import
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [themes, setThemes] = useState([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Import
  const [themeName, setThemeName] = useState('');
  const [themeFile, setThemeFile] = useState(null);
  const [selectedImportStores, setSelectedImportStores] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState([]);

  // Tab 2: Imported themes (saved on server)
  const [importedThemes, setImportedThemes] = useState([]);
  const [importedLoading, setImportedLoading] = useState(false);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState(null);
  const [reimportModal, setReimportModal] = useState(null);
  const [reimportStores, setReimportStores] = useState([]);
  const [reimporting, setReimporting] = useState(false);

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load stores on mount
  useEffect(() => {
    loadStores();
  }, []);

  // Load themes when store changes (Tab 1)
  useEffect(() => {
    setThemes([]);
    setErrorMsg('');
    setSuccessMsg('');
    if (selectedStoreId && selectedTab === 0) {
      loadThemes();
    }
  }, [selectedStoreId]);

  const loadStores = async () => {
    try {
      setStoresLoading(true);
      const res = await api('/api/stores?limit=50');
      const data = await res.json();
      if (data.success) {
        setStores(data.data || []);
        if (data.data?.length > 0) {
          setSelectedStoreId(data.data[0].id);
        }
      }
    } catch (err) {
      setErrorMsg('Failed to load stores');
    } finally {
      setStoresLoading(false);
    }
  };

  const loadThemes = useCallback(async () => {
    if (!selectedStoreId) return;
    const currentStore = stores.find(s => s.id === selectedStoreId);
    const storeName = currentStore?.name || currentStore?.shopDomain || '';
    try {
      setThemesLoading(true);
      setErrorMsg('');
      setThemes([]);
      const res = await api(`/api/themes?storeId=${selectedStoreId}`);
      const data = await res.json();
      if (data.success) {
        setThemes(data.data || []);
      } else {
        setThemes([]);
        const errMsg = data.error || 'Failed to load themes';
        if (errMsg.includes('403') || errMsg.includes('Forbidden')) {
          setErrorMsg(`Store "${storeName}" access denied. The access token may not have read_themes/write_themes scope. Please update the token in Stores page.`);
        } else {
          setErrorMsg(`Store "${storeName}": ${errMsg}`);
        }
      }
    } catch (err) {
      setThemes([]);
      setErrorMsg(`Failed to load themes for store "${storeName}". Please check the store connection.`);
    } finally {
      setThemesLoading(false);
    }
  }, [selectedStoreId, stores]);

  // Load imported theme records from our server
  const loadImportedThemes = async () => {
    try {
      setImportedLoading(true);
      const res = await api('/api/themes/imported');
      const data = await res.json();
      if (data.success) {
        setImportedThemes(data.data || []);
      } else {
        setErrorMsg(data.error || 'Failed to load imported themes');
      }
    } catch (err) {
      setErrorMsg('Failed to load imported themes');
    } finally {
      setImportedLoading(false);
    }
  };

  // Delete imported theme record
  const handleDeleteRecord = async (recordId) => {
    try {
      setActionLoading(recordId);
      const res = await api(`/api/themes/imported/${recordId}`, {method: 'DELETE'});
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Theme record deleted');
        setConfirmDeleteRecord(null);
        loadImportedThemes();
      } else {
        setErrorMsg(data.error || 'Failed to delete record');
      }
    } catch (err) {
      setErrorMsg('Failed to delete record');
    } finally {
      setActionLoading(null);
    }
  };

  // Re-import theme to other stores
  const handleReimport = async () => {
    if (!reimportModal || reimportStores.length === 0) return;
    try {
      setReimporting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const results = [];
      for (const storeId of reimportStores) {
        const store = stores.find(s => s.id === storeId);
        const storeName = store?.name || store?.shopDomain || storeId;
        try {
          const res = await api(`/api/themes/imported/${reimportModal.id}/reimport`, {
            method: 'POST',
            body: JSON.stringify({storeId, themeName: reimportModal.themeName})
          });
          const data = await res.json();
          if (data.success) {
            results.push({storeName, success: true});
          } else {
            results.push({storeName, success: false, message: data.error});
          }
        } catch (err) {
          results.push({storeName, success: false, message: 'Request failed'});
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        setSuccessMsg(`Theme re-imported to ${successCount} store(s).${failCount > 0 ? ` ${failCount} failed.` : ''}`);
        loadImportedThemes();
      } else {
        setErrorMsg('Failed to re-import to all stores.');
      }

      setReimportModal(null);
      setReimportStores([]);
    } catch (err) {
      setErrorMsg('Failed to re-import theme');
    } finally {
      setReimporting(false);
    }
  };

  // Import theme (ZIP only)
  const handleImport = async () => {
    if (!themeName || !themeFile) return;
    if (selectedImportStores.length === 0) {
      setErrorMsg('Please select at least one store');
      return;
    }

    try {
      setImporting(true);
      setErrorMsg('');
      setSuccessMsg('');
      setImportResults([]);

      const themeFileBase64 = await readFileAsBase64(themeFile);
      const fileName = themeFile.name;

      const results = [];
      for (const storeId of selectedImportStores) {
        const store = stores.find(s => s.id === storeId);
        const storeName = store?.name || store?.shopDomain || storeId;
        try {
          const body = {
            storeId,
            themeName,
            themeFile: themeFileBase64,
            fileName
          };

          const res = await api('/api/themes/import', {
            method: 'POST',
            body: JSON.stringify(body)
          });
          const data = await res.json();
          if (data.success) {
            results.push({storeName, success: true, message: data.message});
          } else {
            results.push({storeName, success: false, message: data.error});
          }
        } catch (err) {
          results.push({storeName, success: false, message: 'Request failed'});
        }
      }

      setImportResults(results);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0 && failCount === 0) {
        setSuccessMsg(`Theme imported to ${successCount} store(s) successfully! It may take a few minutes for Shopify to process.`);
        setThemeName('');
        setThemeFile(null);
        setSelectedImportStores([]);
        if (selectedStoreId) loadThemes();
      } else if (successCount > 0) {
        setSuccessMsg(`Theme imported to ${successCount} store(s). ${failCount} store(s) failed.`);
        if (selectedStoreId) loadThemes();
      } else {
        setErrorMsg('Failed to import theme to all selected stores.');
      }
    } catch (err) {
      setErrorMsg('Failed to import theme');
    } finally {
      setImporting(false);
    }
  };

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDropZone = useCallback((_dropFiles, acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setThemeFile(acceptedFiles[0]);
    }
  }, []);

  const handlePublish = async (themeId) => {
    try {
      setActionLoading(themeId);
      setErrorMsg('');
      const res = await api(`/api/themes/${themeId}/publish`, {
        method: 'PUT',
        body: JSON.stringify({storeId: selectedStoreId})
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Theme published successfully!');
        loadThemes();
      } else {
        setErrorMsg(data.error || 'Failed to publish theme');
      }
    } catch (err) {
      setErrorMsg('Failed to publish theme');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (themeId) => {
    try {
      setActionLoading(themeId);
      setErrorMsg('');
      const res = await api(`/api/themes/${themeId}?storeId=${selectedStoreId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Theme deleted successfully!');
        setConfirmDelete(null);
        loadThemes();
      } else {
        setErrorMsg(data.error || 'Failed to delete theme');
      }
    } catch (err) {
      setErrorMsg('Failed to delete theme');
    } finally {
      setActionLoading(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const storeOptions = [
    {label: 'Select a store', value: ''},
    ...stores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];

  const roleBadge = (role) => {
    switch (role) {
      case 'main':
        return <Badge tone="success">Main</Badge>;
      case 'unpublished':
        return <Badge>Unpublished</Badge>;
      case 'demo':
        return <Badge tone="warning">Demo</Badge>;
      case 'development':
        return <Badge tone="info">Development</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  const tabs = [
    {id: 'themes', content: 'Import & Themes', panelID: 'themes-panel'},
    {id: 'imported', content: 'Theme List', panelID: 'imported-panel'}
  ];

  const rowMarkup = themes.map((theme, index) => (
    <IndexTable.Row id={String(theme.id)} key={theme.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold">{theme.name}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{roleBadge(theme.role)}</IndexTable.Cell>
      <IndexTable.Cell>
        {theme.processing ? (
          <InlineStack gap="200" blockAlign="center">
            <Spinner size="small" />
            <Text tone="subdued">Processing...</Text>
          </InlineStack>
        ) : (
          <Badge tone="success">Ready</Badge>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {theme.updated_at ? new Date(theme.updated_at).toLocaleDateString() : '-'}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          {theme.role !== 'main' && !theme.processing && (
            <Button
              size="slim"
              onClick={() => handlePublish(theme.id)}
              loading={actionLoading === theme.id}
            >
              Publish
            </Button>
          )}
          {theme.role !== 'main' && (
            <Button
              size="slim"
              tone="critical"
              onClick={() => setConfirmDelete(theme)}
              loading={actionLoading === theme.id}
            >
              Delete
            </Button>
          )}
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Theme Management">
      <Layout>
        {successMsg && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMsg('')}>
              {successMsg}
            </Banner>
          </Layout.Section>
        )}
        {errorMsg && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setErrorMsg('')}>
              {errorMsg}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={(i) => {
              setSelectedTab(i);
              setSuccessMsg('');
              setErrorMsg('');
              if (i === 1 && importedThemes.length === 0) {
                loadImportedThemes();
              }
            }}>
              <div style={{padding: '16px'}}>
                {/* ========== TAB 1: IMPORT & THEMES ========== */}
                {selectedTab === 0 && (
                  <BlockStack gap="500">
                    {/* Import Section */}
                    <Card>
                      <BlockStack gap="300">
                        <Text as="h2" variant="headingMd">Import Theme</Text>

                        <DropZone
                          accept=".zip"
                          type="file"
                          onDrop={handleDropZone}
                          allowMultiple={false}
                        >
                          {themeFile ? (
                            <BlockStack gap="200" inlineAlign="center">
                              <Text variant="bodyMd" fontWeight="bold">{themeFile.name}</Text>
                              <Text tone="subdued">
                                {(themeFile.size / 1024 / 1024).toFixed(2)} MB
                              </Text>
                              <Button
                                size="slim"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setThemeFile(null);
                                }}
                              >
                                Remove
                              </Button>
                            </BlockStack>
                          ) : (
                            <DropZone.FileUpload actionHint="Accepts .zip files" />
                          )}
                        </DropZone>

                        <TextField
                          label="Theme Name"
                          value={themeName}
                          onChange={setThemeName}
                          placeholder="e.g. Dawn Custom"
                          autoComplete="off"
                        />

                        <ChoiceList
                          title="Import to stores"
                          allowMultiple
                          choices={stores.map(store => ({
                            label: `${store.name || store.shopDomain} (${store.shopDomain}.myshopify.com)`,
                            value: store.id
                          }))}
                          selected={selectedImportStores}
                          onChange={setSelectedImportStores}
                          disabled={importing}
                        />

                        {selectedImportStores.length > 0 && themeName && themeFile && (
                          <Banner tone="info">
                            <Text as="p">
                              Theme <strong>"{themeName}"</strong> will be imported to{' '}
                              <strong>{selectedImportStores.length} store(s)</strong>.
                            </Text>
                          </Banner>
                        )}

                        <InlineStack align="end">
                          <Button
                            variant="primary"
                            onClick={handleImport}
                            loading={importing}
                            disabled={!themeName || !themeFile || selectedImportStores.length === 0}
                          >
                            Import to {selectedImportStores.length || 0} Store{selectedImportStores.length !== 1 ? 's' : ''}
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    </Card>

                    {/* Import Results */}
                    {importResults.length > 0 && (
                      <Card>
                        <BlockStack gap="300">
                          <Text as="h2" variant="headingMd">Import Results</Text>
                          {importResults.map((result, i) => (
                            <InlineStack key={i} gap="200" blockAlign="center">
                              <Badge tone={result.success ? 'success' : 'critical'}>
                                {result.success ? 'OK' : 'Failed'}
                              </Badge>
                              <Text variant="bodyMd" fontWeight="semibold">{result.storeName}</Text>
                              <Text tone="subdued" variant="bodySm">
                                {result.message}
                              </Text>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </Card>
                    )}

                    {/* Theme List Section */}
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="end">
                          <div style={{minWidth: '300px', flex: 1}}>
                            <Select
                              label="View Themes for Store"
                              options={storeOptions}
                              value={selectedStoreId}
                              onChange={setSelectedStoreId}
                              disabled={storesLoading}
                            />
                          </div>
                          <Button
                            icon={RefreshIcon}
                            onClick={loadThemes}
                            disabled={!selectedStoreId}
                          >
                            Refresh
                          </Button>
                        </InlineStack>

                        {themesLoading ? (
                          <SkeletonBodyText lines={5} />
                        ) : !selectedStoreId ? (
                          <EmptyState heading="Select a store" image="">
                            <p>Choose a store to view its themes.</p>
                          </EmptyState>
                        ) : themes.length === 0 && !errorMsg ? (
                          <EmptyState heading="No themes found" image="">
                            <p>This store has no themes, or the access token does not have theme permissions.</p>
                          </EmptyState>
                        ) : themes.length > 0 ? (
                          <IndexTable
                            itemCount={themes.length}
                            headings={[
                              {title: 'Name'},
                              {title: 'Role'},
                              {title: 'Status'},
                              {title: 'Updated'},
                              {title: 'Actions'}
                            ]}
                            selectable={false}
                          >
                            {rowMarkup}
                          </IndexTable>
                        ) : null}
                      </BlockStack>
                    </Card>
                  </BlockStack>
                )}

                {/* ========== TAB 2: THEME LIST (saved on our server) ========== */}
                {selectedTab === 1 && (
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Saved Themes ({importedThemes.length})
                      </Text>
                      <Button
                        icon={RefreshIcon}
                        onClick={loadImportedThemes}
                        disabled={importedLoading}
                      >
                        Refresh
                      </Button>
                    </InlineStack>

                    <Text tone="subdued" variant="bodySm">
                      Theme files uploaded to our server. You can re-import them to other stores without uploading again.
                    </Text>

                    {importedLoading ? (
                      <SkeletonBodyText lines={5} />
                    ) : importedThemes.length === 0 ? (
                      <EmptyState heading="No saved themes" image="">
                        <p>When you import a theme via the "Import & Themes" tab, the file will be saved here for future use.</p>
                      </EmptyState>
                    ) : (
                      importedThemes.map(record => (
                        <Card key={record.id}>
                          <BlockStack gap="300">
                            <InlineStack align="space-between" blockAlign="start">
                              <BlockStack gap="100">
                                <Text variant="headingSm" fontWeight="bold">
                                  {record.themeName}
                                </Text>
                                <Text tone="subdued" variant="bodySm">
                                  {record.fileName} ({formatFileSize(record.fileSize)})
                                </Text>
                                <Text tone="subdued" variant="bodySm">
                                  Uploaded: {new Date(record.createdAt).toLocaleDateString()}{' '}
                                  {new Date(record.createdAt).toLocaleTimeString()}
                                </Text>
                              </BlockStack>
                              <InlineStack gap="200">
                                <Button
                                  size="slim"
                                  onClick={() => {
                                    setReimportModal(record);
                                    setReimportStores([]);
                                  }}
                                >
                                  Re-import
                                </Button>
                                <Button
                                  size="slim"
                                  tone="critical"
                                  icon={DeleteIcon}
                                  onClick={() => setConfirmDeleteRecord(record)}
                                >
                                  Delete
                                </Button>
                              </InlineStack>
                            </InlineStack>

                            {/* Show which stores this was imported to */}
                            {record.importedTo && record.importedTo.length > 0 && (
                              <BlockStack gap="100">
                                <Text variant="bodySm" fontWeight="semibold">Imported to:</Text>
                                {record.importedTo.map((item, i) => (
                                  <InlineStack key={i} gap="200" blockAlign="center">
                                    <Badge tone="success">OK</Badge>
                                    <Text variant="bodySm">{item.storeName}</Text>
                                  </InlineStack>
                                ))}
                              </BlockStack>
                            )}
                          </BlockStack>
                        </Card>
                      ))
                    )}
                  </BlockStack>
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Delete Shopify Theme Modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Theme"
        primaryAction={{
          content: 'Delete',
          destructive: true,
          onAction: () => handleDelete(confirmDelete?.id),
          loading: actionLoading === confirmDelete?.id
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setConfirmDelete(null)}]}
      >
        <Modal.Section>
          <Text>
            Are you sure you want to delete the theme <strong>{confirmDelete?.name}</strong>? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>

      {/* Delete Saved Record Modal */}
      <Modal
        open={!!confirmDeleteRecord}
        onClose={() => setConfirmDeleteRecord(null)}
        title="Delete Saved Theme"
        primaryAction={{
          content: 'Delete',
          destructive: true,
          onAction: () => handleDeleteRecord(confirmDeleteRecord?.id),
          loading: actionLoading === confirmDeleteRecord?.id
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => setConfirmDeleteRecord(null)}]}
      >
        <Modal.Section>
          <Text>
            Delete <strong>{confirmDeleteRecord?.themeName}</strong> from server? The file will be removed from storage permanently.
          </Text>
        </Modal.Section>
      </Modal>

      {/* Re-import Modal */}
      <Modal
        open={!!reimportModal}
        onClose={() => {
          setReimportModal(null);
          setReimportStores([]);
        }}
        title={`Re-import: ${reimportModal?.themeName || ''}`}
        primaryAction={{
          content: `Import to ${reimportStores.length} Store${reimportStores.length !== 1 ? 's' : ''}`,
          onAction: handleReimport,
          loading: reimporting,
          disabled: reimportStores.length === 0
        }}
        secondaryActions={[{content: 'Cancel', onAction: () => {
          setReimportModal(null);
          setReimportStores([]);
        }}]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text variant="bodyMd">
              File: <strong>{reimportModal?.fileName}</strong> ({formatFileSize(reimportModal?.fileSize)})
            </Text>
            <ChoiceList
              title="Select stores to import to"
              allowMultiple
              choices={stores.map(store => ({
                label: `${store.name || store.shopDomain} (${store.shopDomain}.myshopify.com)`,
                value: store.id
              }))}
              selected={reimportStores}
              onChange={setReimportStores}
              disabled={reimporting}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
