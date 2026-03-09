import React, {useState, useEffect} from 'react';
import {Page, Layout, Banner} from '@shopify/polaris';
import {api} from '../helpers/api';
import {usePermittedStores} from '../hooks/usePermittedStores';
import MetafieldDefinitionsTable from './setup-store/MetafieldDefinitionsTable';
import ThemeSelection from './setup-store/ThemeSelection';
import StoreSelection from './setup-store/StoreSelection';
import CheckResults from './setup-store/CheckResults';
import ApplyResults from './setup-store/ApplyResults';

export default function SetupStore() {
  // Stores from shared context
  const {stores, loading: storesLoading} = usePermittedStores();
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);

  // Predefined definitions
  const [definitions, setDefinitions] = useState([]);

  // Saved themes
  const [savedThemes, setSavedThemes] = useState([]);
  const [savedThemesLoading, setSavedThemesLoading] = useState(true);
  const [selectedThemeId, setSelectedThemeId] = useState('');

  // Check results
  const [checkResults, setCheckResults] = useState([]);
  const [checking, setChecking] = useState(false);

  // Apply results
  const [applyResults, setApplyResults] = useState([]);
  const [applying, setApplying] = useState(false);

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadDefinitions();
    loadSavedThemes();
  }, []);

  const loadDefinitions = async () => {
    try {
      const res = await api('/api/setup/definitions');
      const data = await res.json();
      if (data.success) {
        setDefinitions(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load definitions', err);
    }
  };

  const loadSavedThemes = async () => {
    try {
      setSavedThemesLoading(true);
      const res = await api('/api/themes/imported');
      const data = await res.json();
      if (data.success) {
        setSavedThemes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load saved themes', err);
    } finally {
      setSavedThemesLoading(false);
    }
  };

  const formatFileSize = bytes => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const handleCheck = async () => {
    if (selectedStoreIds.length === 0) {
      setErrorMsg('Please select at least one store');
      return;
    }
    try {
      setChecking(true);
      setErrorMsg('');
      setSuccessMsg('');
      setCheckResults([]);
      setApplyResults([]);

      const res = await api('/api/setup/check', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const data = await res.json();
      if (data.success) {
        setCheckResults(data.data || []);
        const allOk = (data.data || []).every(
          store => !store.error && store.metafields.every(m => m.status === 'exists')
        );
        if (allOk) {
          setSuccessMsg('All selected stores have all metafield definitions.');
        }
      } else {
        setErrorMsg(data.error || 'Failed to check stores');
      }
    } catch (err) {
      setErrorMsg('Failed to check stores');
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    if (selectedStoreIds.length === 0) {
      setErrorMsg('Please select at least one store');
      return;
    }
    try {
      setApplying(true);
      setErrorMsg('');
      setSuccessMsg('');
      setApplyResults([]);

      // 1. Apply metafield definitions
      const metafieldRes = await api('/api/setup/apply', {
        method: 'POST',
        body: JSON.stringify({storeIds: selectedStoreIds})
      });
      const metafieldData = await metafieldRes.json();

      let results = [];
      if (metafieldData.success) {
        results = (metafieldData.data || []).map(r => ({...r, themeResult: null}));
      }

      // 2. Import theme if selected
      if (selectedThemeId) {
        const selectedTheme = savedThemes.find(t => t.id === selectedThemeId);
        for (let i = 0; i < results.length; i++) {
          const storeId = results[i].storeId;
          try {
            const themeRes = await api(`/api/themes/imported/${selectedThemeId}/reimport`, {
              method: 'POST',
              body: JSON.stringify({storeId, themeName: selectedTheme?.themeName})
            });
            const themeData = await themeRes.json();
            results[i].themeResult = themeData.success
              ? {success: true, message: 'Theme import started'}
              : {success: false, message: themeData.error || 'Failed'};
          } catch (err) {
            results[i].themeResult = {success: false, message: 'Request failed'};
          }
        }

        // Also handle stores that weren't in metafield results
        for (const storeId of selectedStoreIds) {
          if (!results.find(r => r.storeId === storeId)) {
            const store = stores.find(s => s.id === storeId);
            try {
              const themeRes = await api(`/api/themes/imported/${selectedThemeId}/reimport`, {
                method: 'POST',
                body: JSON.stringify({storeId, themeName: selectedTheme?.themeName})
              });
              const themeData = await themeRes.json();
              results.push({
                storeId,
                storeName: store?.name || store?.shopDomain || storeId,
                shopDomain: store?.shopDomain || '',
                created: [],
                skipped: [],
                errors: [],
                themeResult: themeData.success
                  ? {success: true, message: 'Theme import started'}
                  : {success: false, message: themeData.error || 'Failed'}
              });
            } catch (err) {
              results.push({
                storeId,
                storeName: store?.name || store?.shopDomain || storeId,
                shopDomain: store?.shopDomain || '',
                created: [],
                skipped: [],
                errors: [],
                themeResult: {success: false, message: 'Request failed'}
              });
            }
          }
        }
      }

      setApplyResults(results);

      // Build summary message
      const totalCreated = results.reduce((sum, s) => sum + (s.created?.length || 0), 0);
      const totalErrors = results.reduce((sum, s) => sum + (s.errors?.length || 0), 0);
      const themeSuccessCount = results.filter(r => r.themeResult?.success).length;
      const themeFailCount = results.filter(r => r.themeResult && !r.themeResult.success).length;

      const msgs = [];
      if (totalCreated > 0) msgs.push(`Created ${totalCreated} metafield definition(s)`);
      if (totalCreated === 0 && totalErrors === 0)
        msgs.push('All metafield definitions already exist');
      if (totalErrors > 0) msgs.push(`${totalErrors} metafield error(s)`);
      if (themeSuccessCount > 0) msgs.push(`Theme imported to ${themeSuccessCount} store(s)`);
      if (themeFailCount > 0) msgs.push(`Theme failed on ${themeFailCount} store(s)`);

      if (totalErrors === 0 && themeFailCount === 0) {
        setSuccessMsg(msgs.join('. ') + '.');
      } else {
        setSuccessMsg(msgs.join('. ') + '.');
      }

      setCheckResults([]);
    } catch (err) {
      setErrorMsg('Failed to apply setup');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Page title="Setup Store">
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
          <MetafieldDefinitionsTable definitions={definitions} />
        </Layout.Section>

        <Layout.Section>
          <ThemeSelection
            savedThemes={savedThemes}
            savedThemesLoading={savedThemesLoading}
            selectedThemeId={selectedThemeId}
            onThemeChange={setSelectedThemeId}
            checking={checking}
            applying={applying}
            formatFileSize={formatFileSize}
          />
        </Layout.Section>

        <Layout.Section>
          <StoreSelection
            stores={stores}
            storesLoading={storesLoading}
            selectedStoreIds={selectedStoreIds}
            onStoreSelectionChange={setSelectedStoreIds}
            selectedThemeId={selectedThemeId}
            savedThemes={savedThemes}
            checking={checking}
            applying={applying}
            onCheck={handleCheck}
            onApply={handleApply}
          />
        </Layout.Section>

        {checkResults.length > 0 && (
          <Layout.Section>
            <CheckResults checkResults={checkResults} />
          </Layout.Section>
        )}

        {applyResults.length > 0 && (
          <Layout.Section>
            <ApplyResults applyResults={applyResults} />
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
