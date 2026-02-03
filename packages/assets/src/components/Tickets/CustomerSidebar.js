import React, {useState} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Avatar,
  Button,
  Collapsible,
  Badge,
  Link,
  Divider,
  Box,
  Spinner
} from '@shopify/polaris';
import {ChevronDownIcon, ChevronUpIcon, ExternalIcon} from '@shopify/polaris-icons';
import PropTypes from 'prop-types';
import {format} from 'date-fns';
import useFetchApi from '@assets/hooks/api/useFetchApi';

/**
 * Customer sidebar component for ticket detail view
 */
export default function CustomerSidebar({customer, ticketId}) {
  const [expandedOrders, setExpandedOrders] = useState({});

  const {data: sidebarData, loading} = useFetchApi({
    url: customer ? `/api/v1/chatty/customers/${customer.id}` : null,
    defaultData: {customer: null, orders: [], otherOpenTickets: 0},
    initLoad: !!customer
  });

  if (!customer) {
    return (
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">Customer</Text>
          <Text tone="subdued">Customer not found in Shopify</Text>
        </BlockStack>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div style={{padding: '40px', textAlign: 'center'}}>
          <Spinner size="large" />
        </div>
      </Card>
    );
  }

  const {orders, otherOpenTickets} = sidebarData;

  const toggleOrderExpanded = orderId => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  return (
    <BlockStack gap="400">
      {/* Customer Profile Card */}
      <Card>
        <BlockStack gap="300">
          <InlineStack gap="300" blockAlign="center">
            <Avatar
              size="lg"
              name={`${customer.firstName} ${customer.lastName}`}
              initials={getInitials(`${customer.firstName} ${customer.lastName}`)}
            />
            <BlockStack gap="0">
              <Text variant="headingMd">
                {customer.firstName} {customer.lastName}
              </Text>
              <Text variant="bodySm" tone="subdued">
                {customer.email}
              </Text>
              {customer.phone && (
                <Text variant="bodySm" tone="subdued">
                  {customer.phone}
                </Text>
              )}
            </BlockStack>
          </InlineStack>

          <Divider />

          <BlockStack gap="200">
            <InlineStack blockAlign="center">
              <Text variant="bodySm" tone="subdued">Customer since</Text>
              <div style={{flex: 1}} />
              <Text variant="bodySm">{format(new Date(customer.createdAtShopify), 'MMM d, yyyy')}</Text>
            </InlineStack>
            <InlineStack blockAlign="center">
              <Text variant="bodySm" tone="subdued">Total orders</Text>
              <div style={{flex: 1}} />
              <Text variant="bodySm">{customer.totalOrders}</Text>
            </InlineStack>
            <InlineStack blockAlign="center">
              <Text variant="bodySm" tone="subdued">Lifetime value</Text>
              <div style={{flex: 1}} />
              <Text variant="bodySm" fontWeight="semibold">
                {formatCurrency(customer.totalSpent, customer.currency)}
              </Text>
            </InlineStack>
            <InlineStack blockAlign="center">
              <Text variant="bodySm" tone="subdued">Avg order value</Text>
              <div style={{flex: 1}} />
              <Text variant="bodySm">{formatCurrency(customer.averageOrderValue, customer.currency)}</Text>
            </InlineStack>
          </BlockStack>

          {otherOpenTickets > 0 && (
            <>
              <Divider />
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="warning">{otherOpenTickets} other open ticket{otherOpenTickets > 1 ? 's' : ''}</Badge>
              </InlineStack>
            </>
          )}
        </BlockStack>
      </Card>

      {/* Orders */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">Recent Orders</Text>

          {orders.length === 0 ? (
            <Text tone="subdued">No orders found</Text>
          ) : (
            <BlockStack gap="200">
              {orders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  expanded={expandedOrders[order.id]}
                  onToggle={() => toggleOrderExpanded(order.id)}
                  formatCurrency={formatCurrency}
                />
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

function OrderCard({order, expanded, onToggle, formatCurrency}) {
  const fulfillmentBadge = {
    fulfilled: {tone: 'success', children: 'Fulfilled'},
    partial: {tone: 'warning', children: 'Partial'},
    unfulfilled: {tone: 'attention', children: 'Unfulfilled'}
  }[order.fulfillmentStatus] || {children: order.fulfillmentStatus || 'Pending'};

  return (
    <Box
      padding="300"
      background="bg-surface-secondary"
      borderRadius="200"
    >
      <BlockStack gap="200">
        {/* Order header - clickable */}
        <div
          onClick={onToggle}
          style={{cursor: 'pointer'}}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onToggle()}
        >
          <InlineStack gap="200" blockAlign="center">
            <BlockStack gap="0">
              <Text variant="bodyMd" fontWeight="semibold">
                {order.orderNumber}
              </Text>
              <Text variant="bodySm" tone="subdued">
                {format(new Date(order.createdAtShopify), 'MMM d, yyyy')}
              </Text>
            </BlockStack>
            <div style={{flex: 1}} />
            <Text variant="bodyMd" fontWeight="semibold">
              {formatCurrency(order.totalPrice, order.currency)}
            </Text>
            <Badge {...fulfillmentBadge} />
            <Button
              icon={expanded ? ChevronUpIcon : ChevronDownIcon}
              variant="plain"
              accessibilityLabel={expanded ? 'Collapse' : 'Expand'}
            />
          </InlineStack>
        </div>

        {/* Expanded details */}
        <Collapsible open={expanded}>
          <BlockStack gap="200">
            <Divider />

            {/* Line items */}
            {order.lineItems?.map((item, index) => (
              <InlineStack key={index} gap="200" blockAlign="start">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    style={{width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px'}}
                  />
                )}
                <BlockStack gap="0">
                  <Text variant="bodySm">{item.title}</Text>
                  {item.variantTitle && (
                    <Text variant="bodySm" tone="subdued">{item.variantTitle}</Text>
                  )}
                </BlockStack>
                <div style={{flex: 1}} />
                <Text variant="bodySm">× {item.quantity}</Text>
                <Text variant="bodySm">{formatCurrency(item.price * item.quantity, order.currency)}</Text>
              </InlineStack>
            ))}

            {/* Shipping address */}
            {order.shippingAddress && (
              <>
                <Divider />
                <BlockStack gap="100">
                  <Text variant="bodySm" fontWeight="semibold">Shipping</Text>
                  <Text variant="bodySm">{order.shippingAddress.name}</Text>
                  <Text variant="bodySm">{order.shippingAddress.address1}</Text>
                  {order.shippingAddress.address2 && (
                    <Text variant="bodySm">{order.shippingAddress.address2}</Text>
                  )}
                  <Text variant="bodySm">
                    {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.zip}
                  </Text>
                </BlockStack>
              </>
            )}

            {/* Tracking info */}
            {order.trackingInfo?.length > 0 && (
              <>
                <Divider />
                <BlockStack gap="100">
                  <Text variant="bodySm" fontWeight="semibold">Tracking</Text>
                  {order.trackingInfo.map((tracking, index) => (
                    <InlineStack key={index} gap="200" blockAlign="center">
                      <Text variant="bodySm">{tracking.carrier}</Text>
                      {tracking.url ? (
                        <Link url={tracking.url} external>
                          {tracking.number}
                        </Link>
                      ) : (
                        <Text variant="bodySm">{tracking.number}</Text>
                      )}
                      {tracking.status && (
                        <Badge>{tracking.status}</Badge>
                      )}
                    </InlineStack>
                  ))}
                </BlockStack>
              </>
            )}
          </BlockStack>
        </Collapsible>
      </BlockStack>
    </Box>
  );
}

function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

CustomerSidebar.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    totalOrders: PropTypes.number,
    totalSpent: PropTypes.number,
    averageOrderValue: PropTypes.number,
    currency: PropTypes.string,
    createdAtShopify: PropTypes.string
  }),
  ticketId: PropTypes.string.isRequired
};

OrderCard.propTypes = {
  order: PropTypes.object.isRequired,
  expanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  formatCurrency: PropTypes.func.isRequired
};
