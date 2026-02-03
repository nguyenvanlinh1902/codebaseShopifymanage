import React from 'react';
import {Box, InlineStack, BlockStack, Text, Avatar} from '@shopify/polaris';
import PropTypes from 'prop-types';
import {format} from 'date-fns';

/**
 * Message bubble component for conversation view
 */
export default function MessageBubble({message}) {
  const isCustomer = message.senderType === 'customer';
  const isInternal = message.isInternal;
  const timestamp = format(new Date(message.createdAt), 'MMM d, yyyy h:mm a');

  return (
    <Box
      padding="400"
      background={isInternal ? 'bg-surface-warning' : isCustomer ? 'bg-surface-secondary' : 'bg-surface'}
      borderRadius="200"
      borderWidth={isInternal ? '025' : '0'}
      borderColor={isInternal ? 'border-warning' : undefined}
    >
      <BlockStack gap="200">
        {/* Header */}
        <InlineStack gap="200" blockAlign="center">
          <Avatar
            size="sm"
            name={message.senderName}
            initials={getInitials(message.senderName)}
          />
          <BlockStack gap="0">
            <InlineStack gap="100" blockAlign="center">
              <Text variant="bodyMd" fontWeight="semibold">
                {message.senderName}
              </Text>
              {isCustomer && (
                <Text variant="bodySm" tone="subdued">
                  (Customer)
                </Text>
              )}
              {isInternal && (
                <Text variant="bodySm" tone="caution">
                  Internal Note
                </Text>
              )}
            </InlineStack>
            <Text variant="bodySm" tone="subdued">
              {timestamp}
            </Text>
          </BlockStack>
        </InlineStack>

        {/* Content */}
        <Box paddingInlineStart="800">
          {message.contentHtml ? (
            <div
              dangerouslySetInnerHTML={{__html: message.contentHtml}}
              style={{
                fontSize: '14px',
                lineHeight: '1.5',
                wordBreak: 'break-word'
              }}
            />
          ) : (
            <Text variant="bodyMd">
              {message.contentText.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < message.contentText.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </Text>
          )}
        </Box>
      </BlockStack>
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

MessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    senderType: PropTypes.oneOf(['customer', 'agent']).isRequired,
    senderName: PropTypes.string.isRequired,
    senderEmail: PropTypes.string,
    contentText: PropTypes.string.isRequired,
    contentHtml: PropTypes.string,
    isInternal: PropTypes.bool,
    createdAt: PropTypes.string.isRequired
  }).isRequired
};
