import React, {useState, useCallback, useEffect} from 'react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Banner,
  Spinner,
  Box,
  Divider,
  SkeletonBodyText,
  TextField,
  Select,
  Collapsible
} from '@shopify/polaris';
import {
  RefreshIcon,
  WrenchIcon,
  StatusActiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  KeyIcon,
  SearchIcon
} from '@shopify/polaris-icons';
import {api} from '../helpers/api';
import {useStores} from '../context/store-context';

const WEBHOOK_TOPICS = [
  {label: 'orders/create', value: 'orders/create'},
  {label: 'orders/updated', value: 'orders/updated'},
  {label: 'orders/cancelled', value: 'orders/cancelled'},
  {label: 'products/create', value: 'products/create'},
  {label: 'products/update', value: 'products/update'},
  {label: 'products/delete', value: 'products/delete'},
  {label: 'app/uninstalled', value: 'app/uninstalled'}
];

/**
 * Per-store webhook + scopes panel
 */
function StoreWebhookRow({store}) {
  const [checking, setChecking] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState(null);
  const [scopes, setScopes] = useState(null);
  const [error, setError] = useState(null);

  // Token check state
  const [checkingToken, setCheckingToken] = useState(false);
  const [tokenResult, setTokenResult] = useState(null);

  // Register webhook form
  const [showRegister, setShowRegister] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookTopic, setWebhookTopic] = useState('orders/create');
  const [registerMsg, setRegisterMsg] = useState(null);

  // Scopes toggle
  const [showScopes, setShowScopes] = useState(false);

  // Order inspector state
  const [inspecting, setInspecting] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [orderError, setOrderError] = useState(null);
  const [showOrders, setShowOrders] = useState(false);
  const [orderNumberSearch, setOrderNumberSearch] = useState('');

  const checkToken = useCallback(async () => {
    setCheckingToken(true);
    setTokenResult(null);
    try {
      const res = await api(`/api/authMultip/check-token?shop=${encodeURIComponent(store.shopDomain)}`);
      const json = await res.json();
      if (json.success) {
        setTokenResult(json);
      } else {
        setTokenResult({valid: false, reason: json.error || 'Request failed'});
      }
    } catch (err) {
      setTokenResult({valid: false, reason: err.message});
    } finally {
      setCheckingToken(false);
    }
  }, [store.shopDomain]);

  const inspectOrders = useCallback(async () => {
    setInspecting(true);
    setOrderData(null);
    setOrderError(null);
    try {
      const qs = new URLSearchParams({storeId: store.id, limit: '3'});
      if (orderNumberSearch.trim()) qs.set('orderNumber', orderNumberSearch.trim());
      const res = await api(`/api/dev/orders?${qs}`);
      const json = await res.json();
      if (json.success) {
        setOrderData(json.data);
        setShowOrders(true);
      } else {
        setOrderError(json.error || 'Failed to fetch orders');
      }
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setInspecting(false);
    }
  }, [store.id, orderNumberSearch]);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await api(`/api/authMultip/webhooks?shop=${encodeURIComponent(store.shopDomain)}`);
      const json = await res.json();
      if (json.success) {
        setResult(json);
        setScopes(json.scopes || []);
      } else {
        setError(json.error || 'Check failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }, [store.shopDomain]);

  const fix = useCallback(async () => {
    setFixing(true);
    setError(null);
    try {
      const res = await api(
        `/api/authMultip/webhooks/fix?shop=${encodeURIComponent(store.shopDomain)}`,
        {method: 'POST'}
      );
      const json = await res.json();
      if (json.success) await check();
      else setError(json.error || 'Fix failed');
    } catch (err) {
      setError(err.message);
    } finally {
      setFixing(false);
    }
  }, [store.shopDomain, check]);

  const registerWebhook = useCallback(async () => {
    if (!webhookUrl.trim()) return;
    setRegistering(true);
    setRegisterMsg(null);
    try {
      const res = await api(
        `/api/authMultip/webhooks/register?shop=${encodeURIComponent(store.shopDomain)}`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({webhookUrl: webhookUrl.trim(), topic: webhookTopic})
        }
      );
      const json = await res.json();
      if (json.success) {
        setRegisterMsg({tone: 'success', text: `Registered ${webhookTopic} → ${webhookUrl.trim()}`});
        await check();
      } else {
        setRegisterMsg({tone: 'critical', text: json.error || 'Register failed'});
      }
    } catch (err) {
      setRegisterMsg({tone: 'critical', text: err.message});
    } finally {
      setRegistering(false);
    }
  }, [store.shopDomain, webhookUrl, webhookTopic, check]);

  const hasIssues = result && (!result.allPresent || result.missing?.length > 0 || result.wrongAddress?.length > 0);
  const isOk = result?.allPresent;

  return (
    <Card>
      <BlockStack gap="300">
        {/* Store header */}
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <BlockStack gap="050">
            <InlineStack gap="200" blockAlign="center">
              <Text variant="bodyMd" fontWeight="semibold">{store.name || store.shopDomain}</Text>
              {result && (
                <Badge tone={isOk ? 'success' : 'warning'}>
                  {isOk
                    ? 'Webhooks OK'
                    : `${(result.missing?.length || 0) + (result.wrongAddress?.length || 0)} issue(s)`}
                </Badge>
              )}
              {result?.missingScopes?.length > 0 && (
                <Badge tone="critical">
                  {result.missingScopes.length} scope(s) missing
                </Badge>
              )}
            </InlineStack>
            <Text variant="bodySm" tone="subdued">{store.shopDomain}.myshopify.com</Text>
          </BlockStack>
          <InlineStack gap="200">
            {hasIssues && (
              <Button size="slim" icon={WrenchIcon} onClick={fix} loading={fixing} tone="critical">
                Fix
              </Button>
            )}
            <Button size="slim" icon={KeyIcon} onClick={checkToken} loading={checkingToken}>
              Check Token
            </Button>
            <Button size="slim" icon={SearchIcon} onClick={inspectOrders} loading={inspecting}>
              Inspect Orders
            </Button>
            <Button size="slim" icon={StatusActiveIcon} onClick={check} loading={checking}>
              {result ? 'Re-check' : 'Check'}
            </Button>
          </InlineStack>
        </InlineStack>

        {error && <Banner tone="critical">{error}</Banner>}

        {/* Order Inspector */}
        <BlockStack gap="200">
          <InlineStack gap="300" blockAlign="center">
            <div style={{flex: 1}}>
              <TextField
                label="Order number (optional)"
                labelHidden
                value={orderNumberSearch}
                onChange={setOrderNumberSearch}
                placeholder="Search by order # (e.g. 1001)"
                autoComplete="off"
                connectedRight={
                  <Button onClick={inspectOrders} loading={inspecting} icon={SearchIcon}>
                    Inspect
                  </Button>
                }
              />
            </div>
          </InlineStack>

          {orderError && <Banner tone="critical" onDismiss={() => setOrderError(null)}>{orderError}</Banner>}

          {orderData && (
            <BlockStack gap="100">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodySm" fontWeight="semibold">
                  Order Data ({orderData.length} orders) — check line_items[].properties
                </Text>
                <Button
                  size="slim"
                  plain
                  icon={showOrders ? ChevronUpIcon : ChevronDownIcon}
                  onClick={() => setShowOrders(v => !v)}
                >
                  {showOrders ? 'Hide' : 'Show'}
                </Button>
              </InlineStack>
              <Collapsible open={showOrders} id={`orders-${store.id}`}>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <pre style={{fontSize: 11, overflow: 'auto', maxHeight: 400, margin: 0, whiteSpace: 'pre-wrap'}}>
                    {JSON.stringify(orderData, null, 2)}
                  </pre>
                </Box>
              </Collapsible>
            </BlockStack>
          )}
        </BlockStack>

        {/* Token check result */}
        {tokenResult && (
          <Banner
            tone={tokenResult.valid ? 'success' : 'critical'}
            onDismiss={() => setTokenResult(null)}
          >
            {tokenResult.valid
              ? `Token valid ✓ — ${tokenResult.shopName || ''} (${tokenResult.tokenPrefix}) via ${tokenResult.installedVia}`
              : `Token invalid: ${tokenResult.reason}${tokenResult.tokenPrefix ? ` (${tokenResult.tokenPrefix})` : ''}`
            }
          </Banner>
        )}

        {checking && <SkeletonBodyText lines={3} />}

        {/* Results */}
        {result && !checking && (
          <BlockStack gap="200">
            <Divider />

            {/* Registered webhooks */}
            {result.registered?.length > 0 && (
              <BlockStack gap="150">
                <Text variant="bodySm" fontWeight="semibold">Registered webhooks:</Text>
                {result.registered.map(wh => (
                  <Box key={wh.id} padding="200" background="bg-surface-secondary" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center" wrap={false}>
                      <BlockStack gap="025">
                        <Text variant="bodySm" fontWeight="semibold">{wh.topic}</Text>
                        <Text variant="bodySm" tone="subdued" breakWord>
                          <code style={{fontSize: 11}}>{wh.address}</code>
                        </Text>
                      </BlockStack>
                      <Badge tone="success">Active</Badge>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            )}

            {/* Missing webhooks */}
            {result.missing?.length > 0 && (
              <BlockStack gap="150">
                <Text variant="bodySm" fontWeight="semibold" tone="critical">Missing webhooks:</Text>
                {result.missing.map(topic => (
                  <Box key={topic} padding="200" background="bg-surface-secondary" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="bodySm">{topic}</Text>
                      <Badge tone="critical">Missing</Badge>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            )}

            {/* Wrong address */}
            {result.wrongAddress?.length > 0 && (
              <BlockStack gap="150">
                <Text variant="bodySm" fontWeight="semibold" tone="caution">Wrong address:</Text>
                {result.wrongAddress.map(wh => (
                  <Box key={wh.topic} padding="200" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="100">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodySm" fontWeight="semibold">{wh.topic}</Text>
                        <Badge tone="warning">Wrong URL</Badge>
                      </InlineStack>
                      <Text variant="bodySm" tone="critical">
                        Current: <code style={{fontSize: 11}}>{wh.current}</code>
                      </Text>
                      <Text variant="bodySm" tone="success">
                        Expected: <code style={{fontSize: 11}}>{wh.expected}</code>
                      </Text>
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>
            )}

            {result.registered?.length === 0 && result.missing?.length === 0 && (
              <Text variant="bodySm" tone="subdued">No webhooks registered for this store.</Text>
            )}

            <Divider />

            {/* OAuth Scopes toggle */}
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="bodySm" fontWeight="semibold">
                OAuth Scopes {scopes ? `(${scopes.length})` : ''}
              </Text>
              <Button
                size="slim"
                plain
                icon={showScopes ? ChevronUpIcon : ChevronDownIcon}
                onClick={() => setShowScopes(v => !v)}
              >
                {showScopes ? 'Hide' : 'Show'}
              </Button>
            </InlineStack>

            <Collapsible open={showScopes} id={`scopes-${store.shopDomain}`}>
              {result?.scopesError && (
                <Banner tone="warning">{result.scopesError}</Banner>
              )}
              {scopes && !result?.scopesError ? (
                <BlockStack gap="200">
                  {result?.missingScopes?.length > 0 && (
                    <BlockStack gap="100">
                      <Text variant="bodySm" fontWeight="semibold" tone="critical">Missing scopes (need re-auth):</Text>
                      <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="100">
                          {result.missingScopes.map(scope => (
                            <InlineStack key={scope} gap="150" blockAlign="center">
                              <Badge tone="critical" size="small">{scope}</Badge>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </Box>
                    </BlockStack>
                  )}
                  <BlockStack gap="100">
                    <Text variant="bodySm" fontWeight="semibold">Granted scopes ({scopes.length}):</Text>
                    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                      <BlockStack gap="100">
                        {scopes.map(scope => (
                          <InlineStack key={scope} gap="150" blockAlign="center">
                            <Badge tone="info" size="small">{scope}</Badge>
                          </InlineStack>
                        ))}
                        {scopes.length === 0 && (
                          <Text variant="bodySm" tone="subdued">No scopes found.</Text>
                        )}
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </BlockStack>
              ) : !result?.scopesError ? (
                <Text variant="bodySm" tone="subdued">Click Check to load scopes.</Text>
              ) : null}
            </Collapsible>

            <Divider />

            {/* Register webhook (debug) */}
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="bodySm" fontWeight="semibold">Register Webhook (Debug)</Text>
              <Button
                size="slim"
                plain
                icon={showRegister ? ChevronUpIcon : ChevronDownIcon}
                onClick={() => setShowRegister(v => !v)}
              >
                {showRegister ? 'Hide' : 'Add'}
              </Button>
            </InlineStack>

            <Collapsible open={showRegister} id={`register-${store.shopDomain}`}>
              <BlockStack gap="200">
                <Select
                  label="Topic"
                  options={WEBHOOK_TOPICS}
                  value={webhookTopic}
                  onChange={setWebhookTopic}
                />
                <TextField
                  label="Webhook URL (e.g. ngrok)"
                  value={webhookUrl}
                  onChange={setWebhookUrl}
                  placeholder="https://xxxx.ngrok.io/api/orders/webhook"
                  autoComplete="off"
                />
                {registerMsg && (
                  <Banner tone={registerMsg.tone}>{registerMsg.text}</Banner>
                )}
                <Button
                  icon={PlusIcon}
                  onClick={registerWebhook}
                  loading={registering}
                  disabled={!webhookUrl.trim()}
                >
                  Register
                </Button>
              </BlockStack>
            </Collapsible>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}

export default function DevWebhooks() {
  const {stores, loading: loadingStores} = useStores();
  const [error, setError] = useState(null);

  return (
    <Page
      title="Dev: Webhook Checker"
      subtitle={`Admin only — ${stores.length} stores`}
      primaryAction={{
        content: 'Refresh',
        icon: RefreshIcon,
        onAction: () => window.location.reload()
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}

            {loadingStores && (
              <Card>
                <InlineStack gap="300" blockAlign="center">
                  <Spinner size="small" />
                  <Text variant="bodySm" tone="subdued">Loading stores...</Text>
                </InlineStack>
              </Card>
            )}

            {!loadingStores && stores.length === 0 && (
              <Card>
                <Text tone="subdued">No stores found.</Text>
              </Card>
            )}

            {stores.map(store => (
              <StoreWebhookRow key={store.id} store={store} />
            ))}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
