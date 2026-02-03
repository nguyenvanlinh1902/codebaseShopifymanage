import React from 'react';
import {useNavigate} from 'react-router-dom';
import {Box, InlineStack, BlockStack, Text, Badge, Avatar} from '@shopify/polaris';
import PropTypes from 'prop-types';
import {formatDistanceToNow} from 'date-fns';

const STATUS_BADGE_MAP = {
  open: {tone: 'critical', children: 'Open'},
  pending: {tone: 'warning', children: 'Pending'},
  resolved: {tone: 'success', children: 'Resolved'},
  closed: {children: 'Closed'}
};

const PRIORITY_BADGE_MAP = {
  urgent: {tone: 'critical', children: 'Urgent'},
  high: {tone: 'warning', children: 'High'},
  normal: null,
  low: {children: 'Low'}
};

/**
 * Ticket card component for list view
 */
export default function TicketCard({ticket}) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/tickets/${ticket.id}`);
  };

  const statusBadge = STATUS_BADGE_MAP[ticket.status];
  const priorityBadge = PRIORITY_BADGE_MAP[ticket.priority];
  const timeAgo = formatDistanceToNow(new Date(ticket.lastMessageAt || ticket.createdAt), {addSuffix: true});

  return (
    <Box
      padding="400"
      borderBlockEndWidth="025"
      borderColor="border"
      background={ticket.status === 'open' ? 'bg-surface-secondary' : 'bg-surface'}
    >
      <div
        onClick={handleClick}
        style={{cursor: 'pointer'}}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleClick()}
      >
        <InlineStack gap="400" blockAlign="start" wrap={false}>
          {/* Status indicator */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: ticket.status === 'open' ? '#D82C0D' : '#8C9196',
              marginTop: '6px',
              flexShrink: 0
            }}
          />

          {/* Main content */}
          <BlockStack gap="100" inlineAlign="start">
            <InlineStack gap="200" wrap={false}>
              <Text variant="bodyMd" fontWeight="semibold" truncate>
                {ticket.subject}
              </Text>
              <Badge {...statusBadge} />
              {priorityBadge && <Badge {...priorityBadge} />}
            </InlineStack>

            <Text variant="bodySm" tone="subdued">
              {ticket.customerName} &lt;{ticket.customerEmail}&gt;
            </Text>

            <InlineStack gap="200" blockAlign="center">
              <Text variant="bodySm" tone="subdued">
                #{ticket.number}
              </Text>
              <Text variant="bodySm" tone="subdued">
                •
              </Text>
              <Text variant="bodySm" tone="subdued">
                {timeAgo}
              </Text>
              {ticket.messageCount > 1 && (
                <>
                  <Text variant="bodySm" tone="subdued">
                    •
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    {ticket.messageCount} messages
                  </Text>
                </>
              )}
            </InlineStack>
          </BlockStack>

          {/* Assignee avatar */}
          <div style={{marginLeft: 'auto', flexShrink: 0}}>
            {ticket.assignee ? (
              <Avatar
                size="sm"
                name={ticket.assignee.name}
                initials={getInitials(ticket.assignee.name)}
              />
            ) : (
              <Avatar size="sm" />
            )}
          </div>
        </InlineStack>
      </div>
    </Box>
  );
}

function getInitials(name) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

TicketCard.propTypes = {
  ticket: PropTypes.shape({
    id: PropTypes.string.isRequired,
    number: PropTypes.number.isRequired,
    subject: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['open', 'pending', 'resolved', 'closed']).isRequired,
    priority: PropTypes.oneOf(['low', 'normal', 'high', 'urgent']).isRequired,
    customerEmail: PropTypes.string.isRequired,
    customerName: PropTypes.string.isRequired,
    messageCount: PropTypes.number,
    lastMessageAt: PropTypes.string,
    createdAt: PropTypes.string.isRequired,
    assignee: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string
    })
  }).isRequired
};
