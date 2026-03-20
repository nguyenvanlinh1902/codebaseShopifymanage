import React, {useMemo, useRef} from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';
import {
  Card, Text, InlineStack, Tag, Button, BlockStack, Box,
  SkeletonBodyText, SkeletonDisplayText, Divider, Icon
} from '@shopify/polaris';
import {EmailIcon} from '@shopify/polaris-icons';

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'img', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody',
    'td', 'th', 'thead', 'tr', 'ul', 'center', 'hr', 'blockquote',
    'sup', 'sub', 'u', 'i', 'font', 'small', 'big'
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'width', 'height', 'style',
    'class', 'align', 'valign', 'bgcolor', 'color', 'border',
    'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'target',
    'dir', 'lang'
  ],
  FORBID_TAGS: ['script', 'form', 'embed', 'object', 'applet'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus']
};

/**
 * Email detail panel with sanitized HTML body in sandboxed iframe
 */
export default function EmailDetailPanel({message, loading, onClose}) {
  const iframeRef = useRef(null);

  const cleanHTML = useMemo(() => {
    if (!message?.bodyHtml) return '';
    const html = message.bodyHtml.slice(0, 100000);
    return DOMPurify.sanitize(html, PURIFY_CONFIG);
  }, [message?.bodyHtml]);

  if (loading) {
    return (
      <Card>
        <BlockStack gap="400">
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={2} />
          <Divider />
          <SkeletonBodyText lines={8} />
        </BlockStack>
      </Card>
    );
  }

  if (!message) {
    return (
      <Card>
        <Box padding="800">
          <BlockStack gap="200" inlineAlign="center">
            <Icon source={EmailIcon} tone="subdued" />
            <Text as="p" tone="subdued" alignment="center">
              Select an email to read
            </Text>
          </BlockStack>
        </Box>
      </Card>
    );
  }

  const fromName = message.from?.replace(/<.*>/, '').trim() || 'Unknown';
  const fromEmail = message.from?.match(/<(.+?)>/)?.[1] || message.from || '';

  // Iframe HTML with proper email rendering styles
  const iframeSrcDoc = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
    margin: 0;
    padding: 16px;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  img { max-width: 100%; height: auto; display: block; }
  a { color: #006fbb; }
  table { max-width: 100% !important; border-collapse: collapse; }
  td, th { padding: 4px 8px; }
  /* Fix email marketing layouts */
  body > div, body > table { max-width: 100% !important; }
  * { box-sizing: border-box; }
</style>
</head><body>${cleanHTML}</body></html>`;

  return (
    <div style={{
      height: 'calc(100vh - 140px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Card>
        <BlockStack gap="300">
          {/* Header */}
          <InlineStack align="space-between" blockAlign="start">
            <div style={{flex: 1, minWidth: 0}}>
              <Text as="h2" variant="headingLg">{message.subject || '(no subject)'}</Text>
            </div>
            <Button onClick={onClose} variant="plain" size="slim">Close</Button>
          </InlineStack>

          {/* Metadata */}
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="100">
              <InlineStack gap="200">
                <Text as="span" fontWeight="semibold" variant="bodySm">From:</Text>
                <Text as="span" variant="bodySm">{fromName}</Text>
                {fromEmail && fromEmail !== fromName && (
                  <Text as="span" tone="subdued" variant="bodySm">&lt;{fromEmail}&gt;</Text>
                )}
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" fontWeight="semibold" variant="bodySm">To:</Text>
                <Text as="span" variant="bodySm">{message.to}</Text>
              </InlineStack>
              <InlineStack gap="200">
                <Text as="span" fontWeight="semibold" variant="bodySm">Date:</Text>
                <Text as="span" variant="bodySm">
                  {message.date ? new Date(message.date).toLocaleString() : ''}
                </Text>
              </InlineStack>
            </BlockStack>
          </Box>

          {/* Labels */}
          {message.labels?.length > 0 && (
            <InlineStack gap="100" wrap>
              {message.labels.map(label => (
                <Tag key={label}>{label}</Tag>
              ))}
            </InlineStack>
          )}
        </BlockStack>
      </Card>

      {/* Body — fills remaining height, iframe scrolls internally */}
      <div style={{
        flex: 1,
        marginTop: 8,
        border: '1px solid var(--p-color-border-secondary)',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        minHeight: 0
      }}>
        {cleanHTML ? (
          <iframe
            ref={iframeRef}
            srcDoc={iframeSrcDoc}
            title="Email body"
            sandbox="allow-same-origin allow-popups"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block'
            }}
          />
        ) : (
          <Box padding="400">
            <Text as="p" variant="bodyMd" breakWord>
              {message.bodyText || message.snippet || '(no content)'}
            </Text>
          </Box>
        )}
      </div>
    </div>
  );
}

EmailDetailPanel.propTypes = {
  message: PropTypes.object,
  loading: PropTypes.bool,
  onClose: PropTypes.func.isRequired
};
