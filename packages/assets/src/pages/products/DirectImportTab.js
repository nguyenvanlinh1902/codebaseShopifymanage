 import React, {useState, useCallback, useRef} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Banner,
  DropZone,
  Divider,
  Scrollable,
  Box,
  Spinner,
  Select
} from '@shopify/polaris';
import {DeleteIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

export default function DirectImportTab({stores = []}) {
  const [files, setFiles] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const logsEndRef = useRef(null);

  const storeOptions = [
    {label: 'Select a store...', value: ''},
    ...stores.map(s => ({label: `${s.name} (${s.shopDomain})`, value: s.id}))
  ];

  const handleDrop = useCallback((_dropFiles, acceptedFiles) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const handleRemove = useCallback(index => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const readFileAsText = file =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Failed to read: ${file.name}`));
      reader.readAsText(file);
    });

  const handleDirectImport = async () => {
    if (files.length === 0 || !selectedStoreId) return;
    try {
      setImporting(true);
      setError(null);
      setResult(null);

      const csvFiles = [];
      for (const f of files) {
        const csvData = await readFileAsText(f);
        csvFiles.push({csvData, fileName: f.name});
      }

      const response = await api('/api/products/direct-import', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({storeIds: [selectedStoreId], csvFiles})
      });

      const json = await response.json();
      if (json.success) {
        setResult(json.data);
      } else {
        let errMsg = json.error || 'Import failed';
        if (json.fileErrors) {
          errMsg += '\n' + json.fileErrors.map(fe => `${fe.fileName}: ${fe.error}`).join('\n');
        }
        setError(errMsg);
      }
    } catch (err) {
      setError(`Request failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const getLogColor = level => {
    if (level === 'error') return 'critical';
    return undefined;
  };

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <Text variant="headingSm" as="h3">
            Direct Import (Debug)
          </Text>
          <Text variant="bodySm" tone="subdued">
            Bypasses PubSub queue. Processes CSV synchronously and returns detailed logs immediately.
          </Text>

          <Select
            label="Store"
            options={storeOptions}
            value={selectedStoreId}
            onChange={setSelectedStoreId}
            disabled={importing}
          />

          <DropZone
            onDrop={handleDrop}
            accept=".csv,text/csv"
            type="file"
            allowMultiple={false}
            disabled={importing}
          >
            <DropZone.FileUpload actionHint="Accepts .csv files" />
          </DropZone>

          {files.length > 0 && (
            <BlockStack gap="200">
              {files.map((f, index) => (
                <InlineStack key={`${f.name}-${index}`} align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge size="small">{(f.size / 1024).toFixed(1)} KB</Badge>
                    <Text variant="bodyMd">{f.name}</Text>
                  </InlineStack>
                  <Button
                    onClick={() => handleRemove(index)}
                    icon={DeleteIcon}
                    size="slim"
                    tone="critical"
                    variant="plain"
                    disabled={importing}
                  />
                </InlineStack>
              ))}
            </BlockStack>
          )}

          <InlineStack gap="200">
            <Button
              variant="primary"
              onClick={handleDirectImport}
              loading={importing}
              disabled={files.length === 0 || !selectedStoreId}
            >
              {importing ? 'Importing...' : 'Run Direct Import'}
            </Button>
            {importing && (
              <InlineStack gap="100" blockAlign="center">
                <Spinner size="small" />
                <Text variant="bodySm" tone="subdued">
                  Processing... This may take a while for large files.
                </Text>
              </InlineStack>
            )}
          </InlineStack>
        </BlockStack>
      </Card>

      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          <pre style={{whiteSpace: 'pre-wrap', margin: 0, fontSize: '12px'}}>{error}</pre>
        </Banner>
      )}

      {result && (
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="200" align="space-between">
              <Text variant="headingSm" as="h3">
                Import Result
              </Text>
              <InlineStack gap="200">
                <Badge tone="success">{result.successCount} success</Badge>
                {result.failedCount > 0 && (
                  <Badge tone="critical">{result.failedCount} failed</Badge>
                )}
                <Badge>{result.totalProducts} total</Badge>
              </InlineStack>
            </InlineStack>

            <Text variant="bodySm" tone="subdued">
              Store: {result.store?.name} ({result.store?.shopDomain})
            </Text>

            <Divider />

            <Text variant="headingSm" as="h3">
              Logs ({result.logs?.length || 0})
            </Text>

            <Box
              background="bg-surface-secondary"
              padding="300"
              borderRadius="200"
            >
              <Scrollable style={{maxHeight: '500px'}}>
                <BlockStack gap="100">
                  {(result.logs || []).map((log, i) => (
                    <Text
                      key={i}
                      variant="bodySm"
                      tone={getLogColor(log.level)}
                      as="p"
                      breakWord
                    >
                      <span style={{fontFamily: 'monospace', fontSize: '11px'}}>
                        {log.time?.split('T')[1]?.split('.')[0] || ''} [{log.level}] {log.msg}
                        {log.error ? ` | ${JSON.stringify(log.error)}` : ''}
                      </span>
                    </Text>
                  ))}
                  <div ref={logsEndRef} />
                </BlockStack>
              </Scrollable>
            </Box>
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}
