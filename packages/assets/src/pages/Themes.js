import React, {useState, useEffect, useCallback} from 'react';
import {Page, Layout, Card, Banner, Modal, BlockStack, Tabs} from '@shopify/polaris';
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
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Stores
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);

  // Tab 1: Theme List
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

  // Tab 2: Saved themes
  const [importedThemes, setImportedThemes] = useState([]);
  const [importedLoading, setImportedLoading] = useState(false);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState(null);
  const [reimportModal, setReimportModal] = useState(null);
  const [reimportStores, setReimportStores] = useState([]);
  const [reimporting, setReimporting] = useState(false);

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { loadStores(); }, []);

  useEffect(() => {
    setThemes([]);
    setErrorMsg('');
    setSuccessMsg('');
    if (selectedStoreId && selectedTab === 0) loadThemes();
  }, [selectedStoreId]);

  const loadStores = async () => {
    try {
      setStoresLoading(true);
      const res = await api('/api/stores?limit=50');
      const data = await res.json();
      if (data.success) {
        setStores(data.data || []);
        if (data.data?.length > 0) setSelectedStoreId(data.data[0].id);
      }
    } catch { setErrorMsg('Failed to load stores'); }
    finally { setStoresLoading(false); }
  };

  const loadThemes = useCallback(async () => {
    if (!selectedStoreId) return;
    const storeName = stores.find(s => s.id === selectedStoreId)?.name || '';
    try {
      setThemesLoading(true);
      setErrorMsg('');
      setThemes([]);
      const res = await api(`/api/themes?storeId=${selectedStoreId}`);
      const data = await res.json();
      if (data.success) {
        setThemes(data.data || []);
      } else {
        const msg = data.error || 'Failed to load themes';
        setErrorMsg(msg.includes('403') || msg.includes('Forbidden')
          ? `Store "${storeName}" — access denied. Token may be missing theme scope.`
          : `Store "${storeName}": ${msg}`);
      }
    } catch { setErrorMsg(`Failed to load themes for "${storeName}".`); }
    finally { setThemesLoading(false); }
  }, [selectedStoreId, stores]);

  const loadImportedThemes = async () => {
    try {
      setImportedLoading(true);
      const res = await api('/api/themes/imported');
      const data = await res.json();
      if (data.success) setImportedThemes(data.data || []);
      else setErrorMsg(data.error || 'Failed to load saved themes');
    } catch { setErrorMsg('Failed to load saved themes'); }
    finally { setImportedLoading(false); }
  };

  const handleImport = async () => {
    if (!themeName || !themeFile || selectedImportStores.length === 0) return;
    try {
      setImporting(true);
      setErrorMsg('');
      setImportResults([]);
      const themeFileBase64 = await readFileAsBase64(themeFile);
      const results = [];
      for (const storeId of selectedImportStores) {
        const storeName = stores.find(s => s.id === storeId)?.name || storeId;
        try {
          const res = await api('/api/themes/import', {
            method: 'POST',
            body: JSON.stringify({storeId, themeName, themeFile: themeFileBase64, fileName: themeFile.name})
          });
          const data = await res.json();
          results.push({storeName, success: data.success, message: data.success ? data.message : data.error});
        } catch { results.push({storeName, success: false, message: 'Request failed'}); }
      }
      setImportResults(results);
      const ok = results.filter(r => r.success).length;
      if (ok > 0) {
        setSuccessMsg(`Theme imported to ${ok} store(s)${results.length - ok > 0 ? `, ${results.length - ok} failed` : ''}.`);
        setThemeName('');
        setThemeFile(null);
        setSelectedImportStores([]);
        if (selectedStoreId) loadThemes();
        setImportModalOpen(false);
      } else {
        setErrorMsg('Failed to import theme to all stores.');
      }
    } catch { setErrorMsg('Failed to import theme'); }
    finally { setImporting(false); }
  };

  const handleDeleteRecord = async recordId => {
    try {
      setActionLoading(recordId);
      const res = await api(`/api/themes/imported/${recordId}`, {method: 'DELETE'});
      const data = await res.json();
      if (data.success) { setSuccessMsg('Theme record deleted'); setConfirmDeleteRecord(null); loadImportedThemes(); }
      else setErrorMsg(data.error || 'Failed to delete');
    } catch { setErrorMsg('Failed to delete'); }
    finally { setActionLoading(null); }
  };

  const handleReimport = async () => {
    if (!reimportModal || reimportStores.length === 0) return;
    try {
      setReimporting(true);
      const results = [];
      for (const storeId of reimportStores) {
        const storeName = stores.find(s => s.id === storeId)?.name || storeId;
        try {
          const res = await api(`/api/themes/imported/${reimportModal.id}/reimport`, {
            method: 'POST', body: JSON.stringify({storeId, themeName: reimportModal.themeName})
          });
          const data = await res.json();
          results.push({storeName, success: data.success, message: data.success ? '' : data.error});
        } catch { results.push({storeName, success: false, message: 'Request failed'}); }
      }
      const ok = results.filter(r => r.success).length;
      if (ok > 0) { setSuccessMsg(`Re-imported to ${ok} store(s).`); loadImportedThemes(); }
      else setErrorMsg('Failed to re-import to all stores.');
      setReimportModal(null);
      setReimportStores([]);
    } catch { setErrorMsg('Failed to re-import'); }
    finally { setReimporting(false); }
  };

  const handlePublish = async themeId => {
    try {
      setActionLoading(themeId);
      const res = await api(`/api/themes/${themeId}/publish`, {method: 'PUT', body: JSON.stringify({storeId: selectedStoreId})});
      const data = await res.json();
      if (data.success) { setSuccessMsg('Theme published!'); loadThemes(); }
      else setErrorMsg(data.error || 'Failed to publish');
    } catch { setErrorMsg('Failed to publish'); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async themeId => {
    try {
      setActionLoading(themeId);
      const res = await api(`/api/themes/${themeId}?storeId=${selectedStoreId}`, {method: 'DELETE'});
      const data = await res.json();
      if (data.success) { setSuccessMsg('Theme deleted.'); setConfirmDelete(null); loadThemes(); }
      else setErrorMsg(data.error || 'Failed to delete');
    } catch { setErrorMsg('Failed to delete'); }
    finally { setActionLoading(null); }
  };

  const readFileAsBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleDropZone = useCallback((_dropFiles, acceptedFiles) => {
    if (acceptedFiles.length > 0) setThemeFile(acceptedFiles[0]);
  }, []);

  const formatFileSize = bytes => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const storeOptions = [{label: 'Select a store', value: ''}, ...stores.map(s => ({label: s.name || s.shopDomain, value: s.id}))];

  const tabs = [
    {id: 'themes', content: 'Store Themes', panelID: 'themes-panel'},
    {id: 'library', content: `Theme Library${importedThemes.length > 0 ? ` (${importedThemes.length})` : ''}`, panelID: 'library-panel'}
  ];

  return (
    <Page
      title="Theme Management"
      primaryAction={{content: 'Import Theme', onAction: () => setImportModalOpen(true)}}
    >
      <Layout>
        {successMsg && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccessMsg('')}>{successMsg}</Banner>
          </Layout.Section>
        )}
        {errorMsg && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setErrorMsg('')}>{errorMsg}</Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card padding="0">
            <Tabs tabs={tabs} selected={selectedTab} onSelect={i => {
              setSelectedTab(i);
              setSuccessMsg('');
              setErrorMsg('');
              if (i === 1 && importedThemes.length === 0) loadImportedThemes();
            }}>
              <div style={{padding: '16px'}}>
                {selectedTab === 0 && (
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
                  />
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

      {/* Import Theme Modal */}
      <Modal
        open={importModalOpen}
        onClose={() => { setImportModalOpen(false); setImportResults([]); }}
        title="Import Theme"
        primaryAction={{content: `Import to ${selectedImportStores.length || 0} Store${selectedImportStores.length !== 1 ? 's' : ''}`, onAction: handleImport, loading: importing, disabled: !themeName || !themeFile || selectedImportStores.length === 0}}
        secondaryActions={[{content: 'Cancel', onAction: () => setImportModalOpen(false)}]}
        large
      >
        <Modal.Section>
          <BlockStack gap="400">
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
              inModal
            />
            {importResults.length > 0 && <ImportResults importResults={importResults} />}
          </BlockStack>
        </Modal.Section>
      </Modal>

      <DeleteThemeModal confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} handleDelete={handleDelete} actionLoading={actionLoading} />
      <DeleteRecordModal confirmDeleteRecord={confirmDeleteRecord} setConfirmDeleteRecord={setConfirmDeleteRecord} handleDeleteRecord={handleDeleteRecord} actionLoading={actionLoading} />
      <ReimportModal reimportModal={reimportModal} setReimportModal={setReimportModal} reimportStores={reimportStores} setReimportStores={setReimportStores} stores={stores} reimporting={reimporting} handleReimport={handleReimport} formatFileSize={formatFileSize} />
    </Page>
  );
}
