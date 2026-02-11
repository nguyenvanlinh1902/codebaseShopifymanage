import React from 'react';
import {Modal, Text} from '@shopify/polaris';

/**
 * Modal for confirming store deletion
 */
export default function DeleteConfirmationModal({
  active,
  onClose,
  onConfirm,
  deleting,
  deleteTarget,
  selectedCount
}) {
  const message = deleteTarget
    ? `Are you sure you want to delete this store? This will also remove all associated webhooks and sync configurations.`
    : `Are you sure you want to delete ${selectedCount} store(s)? This will also remove all associated webhooks and sync configurations.`;

  return (
    <Modal
      open={active}
      onClose={onClose}
      title="Delete store(s)"
      primaryAction={{
        content: 'Delete',
        onAction: onConfirm,
        loading: deleting,
        destructive: true
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose
        }
      ]}
    >
      <Modal.Section>
        <Text>{message}</Text>
      </Modal.Section>
    </Modal>
  );
}
