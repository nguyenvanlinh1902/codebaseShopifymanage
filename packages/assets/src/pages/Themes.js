import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, Card, Banner, Badge, BlockStack, Tabs} from '@shopify/polaris';
import {api} from '../helpers/api';
import ImportSection from './themes/ImportSection';
import ImportResults from './themes/ImportResults';
import ThemeListSection from './themes/ThemeListSection';
import SavedThemesList from './themes/SavedThemesList';
import DeleteThemeModal from './themes/DeleteThemeModal';
import DeleteRecordModal from './themes/DeleteRecordModal';
import ReimportModal from './themes/ReimportModal';

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
          setErrorMsg(
            `Store "${storeName}" access denied. The access token may not have read_themes/write_themes scope. Please update the token in Stores page.`
          );
        } else {
          setErrorMsg(`Store "${storeName}": ${errMsg}`);
        }
      }
    } catch (err) {
      setThemes([]);
      setErrorMsg(
        `Failed to load themes for store "${storeName}". Please check the store connection.`
      );
    } finally {
      setThemesLoading(false);
    }
  }, [selectedStoreId, stores]);

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

  const handleDeleteRecord = async recordId => {
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
        setSuccessMsg(
          `Theme re-imported to ${successCount} store(s).${
            failCount > 0 ? ` ${failCount} failed.` : ''
          }`
        );
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
        setSuccessMsg(
          `Theme imported to ${successCount} store(s) successfully! It may take a few minutes for Shopify to process.`
        );
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

  const readFileAsBase64 = file => {
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

  const handlePublish = async themeId => {
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

  const handleDelete = async themeId => {
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

  const formatFileSize = bytes => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const storeOptions = [
    {label: 'Select a store', value: ''},
    ...stores.map(s => ({label: s.name || s.shopDomain, value: s.id}))
  ];

  const roleBadge = role => {
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
            <Tabs
              tabs={tabs}
              selected={selectedTab}
              onSelect={i => {
                setSelectedTab(i);
                setSuccessMsg('');
                setErrorMsg('');
                if (i === 1 && importedThemes.length === 0) {
                  loadImportedThemes();
                }
              }}
            >
              <div style={{padding: '16px'}}>
                {selectedTab === 0 && (
                  <BlockStack gap="500">
                    <ImportSection
                      themeName={themeName}
                      setThemeName={setThemeName}
                      themeFile={themeFile}
                      setThemeFile={setThemeFile}
                      selectedImportStores={selectedImportStores}
                      setSelectedImportStores={setSelectedImportStores}
                      stores={stores}
                      importing={importing}
                      handleImport={handleImport}
                      handleDropZone={handleDropZone}
                    />

                    <ImportResults importResults={importResults} />

                    <ThemeListSection
                      storeOptions={storeOptions}
                      selectedStoreId={selectedStoreId}
                      setSelectedStoreId={setSelectedStoreId}
                      storesLoading={storesLoading}
                      loadThemes={loadThemes}
                      themesLoading={themesLoading}
                      themes={themes}
                      errorMsg={errorMsg}
                      handlePublish={handlePublish}
                      setConfirmDelete={setConfirmDelete}
                      actionLoading={actionLoading}
                      roleBadge={roleBadge}
                    />
                  </BlockStack>
                )}

                {selectedTab === 1 && (
                  <SavedThemesList
                    importedThemes={importedThemes}
                    importedLoading={importedLoading}
                    loadImportedThemes={loadImportedThemes}
                    setReimportModal={setReimportModal}
                    setReimportStores={setReimportStores}
                    setConfirmDeleteRecord={setConfirmDeleteRecord}
                    formatFileSize={formatFileSize}
                  />
                )}
              </div>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>

      <DeleteThemeModal
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        handleDelete={handleDelete}
        actionLoading={actionLoading}
      />

      <DeleteRecordModal
        confirmDeleteRecord={confirmDeleteRecord}
        setConfirmDeleteRecord={setConfirmDeleteRecord}
        handleDeleteRecord={handleDeleteRecord}
        actionLoading={actionLoading}
      />

      <ReimportModal
        reimportModal={reimportModal}
        setReimportModal={setReimportModal}
        reimportStores={reimportStores}
        setReimportStores={setReimportStores}
        stores={stores}
        reimporting={reimporting}
        handleReimport={handleReimport}
        formatFileSize={formatFileSize}
      />
    </Page>
  );
}
