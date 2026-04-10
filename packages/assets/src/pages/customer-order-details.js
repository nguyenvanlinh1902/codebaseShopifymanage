import React, {useEffect, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Badge,
  Text,
  Link,
  Button,
  BlockStack,
  InlineStack,
  Thumbnail,
  Divider,
  SkeletonBodyText,
  Banner,
  Box,
  Modal,
  TextField,
  Toast
} from '@shopify/polaris';
import {ImageIcon, LocationIcon} from '@shopify/polaris-icons';
import {api} from '../helpers/api';

import {FULFILLMENT_TONE, FINANCIAL_TONE} from '../helpers/order-status-tones';

const fmtMoney = m => {
  if (!m) return '-';
  const num = parseFloat(m.amount || 0);
  const sym = m.currency === 'USD' ? '$' : `${m.currency} `;
  return `${sym}${num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
};

export default function CustomerOrderDetails() {
  const {storeId, orderId} = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [toast, setToast] = useState('');

  const openNoteModal = () => {
    setNoteDraft(detail?.note || '');
    setNoteModalOpen(true);
  };

  const saveNote = async () => {
    setSavingNote(true);
    try {
      const res = await api('/api/analytics/order-note', {
        method: 'PUT',
        body: JSON.stringify({storeId, orderId, note: noteDraft})
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Failed to save note');
      setDetail(d => ({...d, note: result.data.note}));
      setNoteModalOpen(false);
      setToast('Note updated');
    } catch (e) {
      setToast(e.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        // orderId in URL is numeric; backend accepts numeric or GID
        const params = new URLSearchParams({storeId, orderId});
        const res = await api(`/api/analytics/order-details?${params}`);
        const result = await res.json();
        if (cancelled) return;
        if (result.success) setDetail(result.data);
        else setError(result.error || 'Failed to load order');
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, orderId]);

  if (loading) {
    return (
      <Page title="Order details" backAction={{content: 'Back', onAction: () => navigate(-1)}}>
        <Card>
          <SkeletonBodyText lines={12} />
        </Card>
      </Page>
    );
  }

  if (error || !detail) {
    return (
      <Page title="Order details" backAction={{content: 'Back', onAction: () => navigate(-1)}}>
        <Banner tone="critical">{error || 'Order not found'}</Banner>
      </Page>
    );
  }

  const itemCount = detail.lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0);

  return (
    <Page
      backAction={{content: 'Customer Search', onAction: () => navigate('/customer-search')}}
      title={detail.name}
      subtitle={`${new Date(detail.createdAt).toLocaleString()} • ${detail.store?.name || detail.store?.shopDomain}`}
      titleMetadata={
        <InlineStack gap="200">
          <Badge tone={FINANCIAL_TONE[detail.financialStatus] || 'new'}>
            {detail.financialStatus}
          </Badge>
          <Badge tone={FULFILLMENT_TONE[detail.fulfillmentStatus] || 'new'}>
            {detail.fulfillmentStatus}
          </Badge>
        </InlineStack>
      }
      primaryAction={{
        content: 'Open in Shopify',
        url: detail.adminUrl,
        external: true
      }}
    >
      <Layout>
        {/* LEFT — items + payment */}
        <Layout.Section>
          <BlockStack gap="400">
            {/* Fulfillment card */}
            <Card padding="0">
              <Box padding="400">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={FULFILLMENT_TONE[detail.fulfillmentStatus] || 'attention'}>
                    {`${detail.fulfillmentStatus} (${itemCount})`}
                  </Badge>
                  <Badge icon={LocationIcon}>Shop location</Badge>
                </InlineStack>
              </Box>
              <Divider />
              <BlockStack gap="0">
                {detail.lineItems.map((li, idx) => (
                  <React.Fragment key={li.id}>
                    {idx > 0 && <Divider />}
                    <Box padding="400">
                      <InlineStack gap="300" blockAlign="center" wrap={false}>
                        <Thumbnail source={li.image || ImageIcon} alt={li.title} size="small" />
                        <div style={{flex: 1}}>
                          <Text variant="bodyMd" fontWeight="semibold">
                            {li.title}
                          </Text>
                          {li.variantTitle && (
                            <Text tone="subdued" variant="bodySm">
                              {li.variantTitle}
                            </Text>
                          )}
                          {li.sku && (
                            <Text tone="subdued" variant="bodySm">
                              SKU: {li.sku}
                            </Text>
                          )}
                        </div>
                        <Text variant="bodyMd">{fmtMoney(li.discountedUnitPrice)}</Text>
                        <Text variant="bodyMd" tone="subdued">× {li.quantity}</Text>
                        <Text variant="bodyMd" fontWeight="semibold">
                          {fmtMoney({
                            amount: (parseFloat(li.discountedUnitPrice.amount) * li.quantity).toFixed(2),
                            currency: li.discountedUnitPrice.currency
                          })}
                        </Text>
                      </InlineStack>
                    </Box>
                  </React.Fragment>
                ))}
              </BlockStack>
            </Card>

            {/* Fulfillments / tracking */}
            {detail.fulfillments.length > 0 && (
              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd">Fulfillments</Text>
                  {detail.fulfillments.map((f, i) => (
                    <BlockStack key={i} gap="100">
                      <InlineStack gap="200">
                        <Badge tone="success">{f.status}</Badge>
                        <Text tone="subdued">
                          {new Date(f.createdAt).toLocaleDateString()}
                        </Text>
                      </InlineStack>
                      {f.tracking.map((t, j) => (
                        <Text key={j} tone="subdued">
                          {t.company} {t.number}{' '}
                          {t.url && (
                            <Link url={t.url} external>
                              Track
                            </Link>
                          )}
                        </Text>
                      ))}
                    </BlockStack>
                  ))}
                </BlockStack>
              </Card>
            )}

            {/* Payment summary */}
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200">
                  <Badge tone={FINANCIAL_TONE[detail.financialStatus] || 'new'}>
                    {detail.financialStatus}
                  </Badge>
                </InlineStack>
                <Divider />
                <BlockStack gap="150">
                  <InlineStack align="space-between">
                    <Text>Subtotal</Text>
                    <Text tone="subdued">{itemCount} items</Text>
                    <Text>{fmtMoney(detail.totals.subtotal)}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text>Shipping</Text>
                    <Text>{fmtMoney(detail.totals.shipping)}</Text>
                  </InlineStack>
                  {parseFloat(detail.totals.tax.amount) > 0 && (
                    <InlineStack align="space-between">
                      <Text>Tax</Text>
                      <Text>{fmtMoney(detail.totals.tax)}</Text>
                    </InlineStack>
                  )}
                  {parseFloat(detail.totals.discount.amount) > 0 && (
                    <InlineStack align="space-between">
                      <Text>Discount</Text>
                      <Text>- {fmtMoney(detail.totals.discount)}</Text>
                    </InlineStack>
                  )}
                  <InlineStack align="space-between">
                    <Text variant="headingMd">Total</Text>
                    <Text variant="headingMd">{fmtMoney(detail.totals.total)}</Text>
                  </InlineStack>
                </BlockStack>
                <Divider />
                <InlineStack align="space-between">
                  <Text fontWeight="semibold">
                    {detail.financialStatus === 'PAID' ? 'Paid' : 'Amount'}
                  </Text>
                  <Text fontWeight="semibold">{fmtMoney(detail.totals.total)}</Text>
                </InlineStack>
                {parseFloat(detail.totals.refunded.amount) > 0 && (
                  <InlineStack align="space-between">
                    <Text tone="critical">Refunded</Text>
                    <Text tone="critical">- {fmtMoney(detail.totals.refunded)}</Text>
                  </InlineStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* RIGHT — Notes, Customer, Address */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="150">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd">Notes</Text>
                  <Button variant="plain" onClick={openNoteModal}>
                    Edit
                  </Button>
                </InlineStack>
                <Text tone={detail.note ? undefined : 'subdued'}>
                  {detail.note || 'No notes from customer'}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="150">
                <Text variant="headingMd">Tags</Text>
                {detail.tags && detail.tags.length > 0 ? (
                  <InlineStack gap="100" wrap>
                    {detail.tags.map(t => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </InlineStack>
                ) : (
                  <Text tone="subdued">No tags</Text>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Customer</Text>
                {detail.customer ? (
                  <>
                    <Link url="#" removeUnderline>
                      {detail.customer.name}
                    </Link>

                    <Divider />
                    <BlockStack gap="100">
                      <Text variant="headingSm">Contact information</Text>
                      {detail.customer.email ? (
                        <Link url={`mailto:${detail.customer.email}`}>
                          {detail.customer.email}
                        </Link>
                      ) : (
                        <Text tone="subdued">No email</Text>
                      )}
                      <Text tone="subdued">
                        {detail.customer.phone || 'No phone number'}
                      </Text>
                    </BlockStack>
                  </>
                ) : (
                  <Text tone="subdued">No customer info</Text>
                )}

                {detail.shippingAddress && (
                  <>
                    <Divider />
                    <BlockStack gap="100">
                      <Text variant="headingSm">Shipping address</Text>
                      <Text>{detail.shippingAddress.name}</Text>
                      {detail.shippingAddress.address1 && (
                        <Text>{detail.shippingAddress.address1}</Text>
                      )}
                      {detail.shippingAddress.address2 && (
                        <Text>{detail.shippingAddress.address2}</Text>
                      )}
                      <Text>
                        {[
                          detail.shippingAddress.city,
                          detail.shippingAddress.province,
                          detail.shippingAddress.zip
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </Text>
                      <Text>{detail.shippingAddress.country}</Text>
                    </BlockStack>
                  </>
                )}

                {detail.billingAddress && (
                  <>
                    <Divider />
                    <BlockStack gap="100">
                      <Text variant="headingSm">Billing address</Text>
                      {detail.shippingAddress &&
                       detail.billingAddress.address1 === detail.shippingAddress.address1 &&
                       detail.billingAddress.city === detail.shippingAddress.city &&
                       detail.billingAddress.zip === detail.shippingAddress.zip ? (
                        <Text tone="subdued">Same as shipping address</Text>
                      ) : (
                        <>
                          <Text>{detail.billingAddress.name}</Text>
                          {detail.billingAddress.address1 && <Text>{detail.billingAddress.address1}</Text>}
                          <Text>
                            {[detail.billingAddress.city, detail.billingAddress.province, detail.billingAddress.zip]
                              .filter(Boolean).join(' ')}
                          </Text>
                          <Text>{detail.billingAddress.country}</Text>
                        </>
                      )}
                    </BlockStack>
                  </>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      <Modal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        title="Edit note"
        primaryAction={{content: 'Save', onAction: saveNote, loading: savingNote}}
        secondaryActions={[{content: 'Cancel', onAction: () => setNoteModalOpen(false)}]}
      >
        <Modal.Section>
          <TextField
            label="Note"
            value={noteDraft}
            onChange={setNoteDraft}
            multiline={4}
            autoComplete="off"
            placeholder="Add a note for this order"
          />
        </Modal.Section>
      </Modal>

      {toast && <Toast content={toast} onDismiss={() => setToast('')} />}
    </Page>
  );
}
