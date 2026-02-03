import React from 'react';
import {Box, InlineStack, Text, Link, Thumbnail, Icon} from '@shopify/polaris';
import {AttachmentIcon, ImageIcon, NoteIcon} from '@shopify/polaris-icons';
import PropTypes from 'prop-types';

const FILE_ICONS = {
  'image/jpeg': ImageIcon,
  'image/png': ImageIcon,
  'image/gif': ImageIcon,
  'application/pdf': NoteIcon,
  default: AttachmentIcon
};

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(contentType) {
  return contentType?.startsWith('image/');
}

/**
 * Attachment preview component
 * Shows thumbnail for images, icon for documents
 */
export default function AttachmentPreview({attachment, showSize = true}) {
  const IconComponent = FILE_ICONS[attachment.contentType] || FILE_ICONS.default;

  return (
    <Link url={attachment.storageUrl} external removeUnderline>
      <Box
        padding="200"
        background="bg-surface-secondary"
        borderRadius="200"
        borderWidth="025"
        borderColor="border"
      >
        <InlineStack gap="200" blockAlign="center">
          {isImageType(attachment.contentType) ? (
            <Thumbnail
              source={attachment.storageUrl}
              alt={attachment.filename}
              size="small"
            />
          ) : (
            <div
              style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f6f6f7',
                borderRadius: '4px'
              }}
            >
              <Icon source={IconComponent} tone="subdued" />
            </div>
          )}
          <div style={{flex: 1, minWidth: 0}}>
            <Text variant="bodySm" truncate>
              {attachment.filename}
            </Text>
            {showSize && (
              <Text variant="bodySm" tone="subdued">
                {formatFileSize(attachment.size)}
              </Text>
            )}
          </div>
        </InlineStack>
      </Box>
    </Link>
  );
}

AttachmentPreview.propTypes = {
  attachment: PropTypes.shape({
    id: PropTypes.string.isRequired,
    filename: PropTypes.string.isRequired,
    contentType: PropTypes.string.isRequired,
    size: PropTypes.number.isRequired,
    storageUrl: PropTypes.string.isRequired
  }).isRequired,
  showSize: PropTypes.bool
};

/**
 * Component for displaying a list of attachments
 */
export function AttachmentList({attachments}) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <InlineStack gap="200" wrap>
      {attachments.map(attachment => (
        <AttachmentPreview key={attachment.id} attachment={attachment} />
      ))}
    </InlineStack>
  );
}

AttachmentList.propTypes = {
  attachments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      filename: PropTypes.string.isRequired,
      contentType: PropTypes.string.isRequired,
      size: PropTypes.number.isRequired,
      storageUrl: PropTypes.string.isRequired
    })
  )
};
