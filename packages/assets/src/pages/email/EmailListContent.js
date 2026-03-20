import React, {useRef, useCallback} from 'react';
import PropTypes from 'prop-types';
import {useVirtualizer} from '@tanstack/react-virtual';
import {Text, InlineStack, Box, Spinner} from '@shopify/polaris';

const ROW_HEIGHT = 76;

/**
 * Virtualized email list with infinite scroll, hover + selected states
 */
export default function EmailListContent({emails, loading, hasMore, onFetchMore, onSelectMessage, selectedId}) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5
  });

  const handleScroll = useCallback(() => {
    if (!parentRef.current || loading || !hasMore) return;
    const {scrollTop, scrollHeight, clientHeight} = parentRef.current;
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      onFetchMore();
    }
  }, [loading, hasMore, onFetchMore]);

  if (emails.length === 0 && !loading) {
    return (
      <Box padding="400" background="bg-surface" borderRadius="300">
        <Text as="p" tone="subdued" alignment="center">No emails found</Text>
      </Box>
    );
  }

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      style={{
        height: 'calc(100vh - 300px)',
        overflow: 'auto',
        borderRadius: 12,
        border: '1px solid var(--p-color-border-secondary)'
      }}
    >
      <div style={{height: virtualizer.getTotalSize(), width: '100%', position: 'relative'}}>
        {virtualizer.getVirtualItems().map(virtualRow => {
          const email = emails[virtualRow.index];
          const isUnread = !email.isRead;
          const isSelected = email.id === selectedId;

          return (
            <div
              key={email.id}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onSelectMessage(email.id)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
                borderBottom: '1px solid var(--p-color-border-secondary)',
                padding: '10px 16px',
                cursor: 'pointer',
                backgroundColor: isSelected
                  ? 'var(--p-color-bg-surface-selected)'
                  : isUnread
                    ? 'var(--p-color-bg-surface)'
                    : 'transparent',
                transition: 'background-color 150ms ease-out'
              }}
              onClick={() => onSelectMessage(email.id)}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--p-color-bg-surface-hover)';
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = isUnread
                    ? 'var(--p-color-bg-surface)'
                    : 'transparent';
                }
              }}
            >
              <div style={{overflow: 'hidden'}}>
                <InlineStack align="space-between" blockAlign="start">
                  <Text as="span" fontWeight={isUnread ? 'bold' : 'regular'} truncate>
                    {email.from?.replace(/<.*>/, '').trim() || 'Unknown'}
                  </Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {formatDate(email.date)}
                  </Text>
                </InlineStack>
                <Text as="p" fontWeight={isUnread ? 'semibold' : 'regular'} truncate>
                  {email.subject || '(no subject)'}
                </Text>
                <Text as="p" tone="subdued" variant="bodySm" truncate>
                  {email.snippet}
                </Text>
              </div>
            </div>
          );
        })}
      </div>
      {loading && (
        <Box padding="400" background="bg-surface">
          <InlineStack align="center" gap="200">
            <Spinner size="small" />
            <Text as="span" tone="subdued">Loading emails...</Text>
          </InlineStack>
        </Box>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
  } catch {
    return '';
  }
}

EmailListContent.propTypes = {
  emails: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  hasMore: PropTypes.bool,
  onFetchMore: PropTypes.func.isRequired,
  onSelectMessage: PropTypes.func.isRequired,
  selectedId: PropTypes.string
};
