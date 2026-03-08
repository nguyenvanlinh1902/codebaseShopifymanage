import React from 'react';
import {
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  Card,
  Badge,
  Divider,
  SkeletonBodyText,
  Box
} from '@shopify/polaris';
import PropTypes from 'prop-types';

function fmt(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD'
  }).format(amount || 0);
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

const STATUS_TONE = {PAID: 'success', IN_TRANSIT: 'info', FAILED: 'critical', SCHEDULED: 'attention'};

export default function AnalyticsBalancePanel({balance: accountData, loading}) {
  if (loading) {
    return (
      <InlineGrid columns={{xs: 1, md: 2}} gap="400">
        <Card><SkeletonBodyText lines={4} /></Card>
        <Card><SkeletonBodyText lines={4} /></Card>
      </InlineGrid>
    );
  }

  if (!accountData || !accountData.balance) {
    const reason = accountData?.reason;
    return (
      <Card>
        <BlockStack gap="200">
          <Text variant="headingMd">Shopify Payments</Text>
          <Text tone="subdued">
            {reason || 'Balance data not available. Reconnect the store with updated scopes.'}
          </Text>
        </BlockStack>
      </Card>
    );
  }

  const {balance, payouts = []} = accountData;
  const balances = Array.isArray(balance) ? balance : [balance];
  const totalAmount = balances.reduce((s, b) => s + parseFloat(b.amount || 0), 0);
  const currency = balances[0]?.currency || balances[0]?.currencyCode || 'USD';

  // Pending = IN_TRANSIT payouts
  const pendingPayouts = payouts.filter(p => p.status === 'IN_TRANSIT');
  const pendingAmount = pendingPayouts.reduce(
    (s, p) => s + parseFloat(p.net?.amount || 0), 0
  );

  return (
    <BlockStack gap="400">
      <InlineGrid columns={{xs: 1, md: 2}} gap="400">
        {/* Left: Accounts */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">Accounts</Text>
            <Divider />
            {balances.map((b, i) => {
              const cur = b.currency || b.currencyCode || 'USD';
              return (
                <InlineStack key={i} align="space-between" blockAlign="center">
                  <Text variant="bodyMd">
                    {balances.length === 1 ? 'Main' : `Account ${i + 1}`} ({cur})
                  </Text>
                  <Text variant="bodyMd" fontWeight="semibold">{fmt(b.amount, cur)}</Text>
                </InlineStack>
              );
            })}
          </BlockStack>
        </Card>

        {/* Right: Available balance */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">Available balance</Text>
            <Text variant="heading2xl" as="p">{fmt(totalAmount, currency)}</Text>
            <Text variant="bodySm" tone="subdued">
              Pending: {fmt(pendingAmount, currency)}
            </Text>
          </BlockStack>
        </Card>
      </InlineGrid>

      {/* Transactions / Recent Payouts */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">Transactions</Text>
          <Divider />
          {payouts.length === 0 ? (
            <BlockStack gap="200">
              <Text variant="bodyMd" tone="subdued">There aren&apos;t any transactions yet</Text>
              <Text variant="bodySm" tone="subdued">
                When funds move in to or out of your account, those transactions will appear here
              </Text>
            </BlockStack>
          ) : (
            <BlockStack gap="200">
              {payouts.map((p, i) => (
                <Box key={p.id || i} paddingBlockStart="100" paddingBlockEnd="100">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="300" blockAlign="center">
                      <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                      <Text variant="bodySm" tone="subdued">{fmtDate(p.issuedAt)}</Text>
                    </InlineStack>
                    <Text variant="bodyMd" fontWeight="semibold">
                      {fmt(p.net?.amount, p.net?.currencyCode)}
                    </Text>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

AnalyticsBalancePanel.propTypes = {
  balance: PropTypes.shape({
    balance: PropTypes.oneOfType([
      PropTypes.shape({amount: PropTypes.string, currencyCode: PropTypes.string}),
      PropTypes.arrayOf(PropTypes.shape({amount: PropTypes.string, currencyCode: PropTypes.string}))
    ]),
    payouts: PropTypes.array,
    reason: PropTypes.string
  }),
  loading: PropTypes.bool
};
