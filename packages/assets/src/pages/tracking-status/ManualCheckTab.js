import React, {useState} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Box,
  Select,
  TextField,
  Badge,
  Banner,
  Divider
} from '@shopify/polaris';

const STATUS_TONE_MAP = {
  pending: 'attention',
  info_received: 'info',
  in_transit: 'info',
  delivered: 'success',
  expired: undefined,
  not_found: 'warning',
  pick_up: 'info',
  undelivered: 'warning',
  alert: 'critical'
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function ManualCheckTab({apiKeys, onCheckSingle, loading}) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [carrier, setCarrier] = useState('');
  const [result, setResult] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  const keyOptions = [
    {label: 'Auto (any available key)', value: ''},
    ...apiKeys.map(k => ({
      label: `${k.name} (${k.apiKey})${k.status !== 'active' ? ` [${k.status}]` : ''}`,
      value: k.id
    }))
  ];

  const handleCheck = async () => {
    const num = trackingNumber.trim();
    if (!num) return;
    try {
      setChecking(true);
      setError(null);
      setWarnings([]);
      setResult(null);
      const response = await onCheckSingle({
        trackingNumber: num,
        carrier: carrier.trim() || undefined,
        ...(selectedKeyId && {keyId: selectedKeyId})
      });
      setResult(response.data);
      if (response.warnings?.length) setWarnings(response.warnings);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Box padding="400">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" fontWeight="semibold">Manual Tracking Check</Text>
            <Text variant="bodySm" tone="subdued">
              Enter a tracking number to check its status via 17TRACK. Choose a specific API key or let the system auto-select.
            </Text>

            <InlineStack gap="300" blockAlign="end" wrap>
              <div className="filter-item filter-item--md">
                <TextField
                  label="Tracking Number"
                  value={trackingNumber}
                  onChange={setTrackingNumber}
                  placeholder="Enter tracking number"
                  autoComplete="off"
                />
              </div>
              <div className="filter-item filter-item--sm">
                <TextField
                  label="Carrier (optional)"
                  value={carrier}
                  onChange={setCarrier}
                  placeholder="e.g. DHL, UPS"
                  autoComplete="off"
                />
              </div>
              <div className="filter-item filter-item--md">
                <Select
                  label="API Key"
                  options={keyOptions}
                  value={selectedKeyId}
                  onChange={setSelectedKeyId}
                />
              </div>
              <Button
                variant="primary"
                onClick={handleCheck}
                loading={checking}
                disabled={!trackingNumber.trim()}
              >
                Check
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {warnings.length > 0 && (
          <Banner tone="warning" onDismiss={() => setWarnings([])}>
            {warnings.join(' | ')}
          </Banner>
        )}

        {result && (
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" fontWeight="semibold">
                  {result.trackingNumber}
                </Text>
                <Badge tone={STATUS_TONE_MAP[result.status]}>
                  {result.status || 'unknown'}
                </Badge>
              </InlineStack>

              <Divider />

              <InlineStack gap="600" wrap>
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">Carrier</Text>
                  <Text variant="bodyMd">{result.carrier || '—'}</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">Order</Text>
                  <Text variant="bodyMd">{result.orderNumber || '—'}</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">API Key</Text>
                  <Text variant="bodyMd">{result.apiKeyName || '—'}</Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text variant="bodySm" tone="subdued">Last Checked</Text>
                  <Text variant="bodyMd">{formatDate(result.lastCheckedAt)}</Text>
                </BlockStack>
              </InlineStack>

              {result.lastEvent && (
                <>
                  <Divider />
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">Last Event</Text>
                    <Text variant="bodyMd">{result.lastEvent}</Text>
                    {result.lastEventDate && (
                      <Text variant="bodySm" tone="subdued">
                        {formatDate(result.lastEventDate)}
                      </Text>
                    )}
                  </BlockStack>
                </>
              )}

              {result.isDelivered && (
                <>
                  <Divider />
                  <Banner tone="success">This tracking has been delivered.</Banner>
                </>
              )}
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Box>
  );
}
