import React from 'react';
import {Modal, Text} from '@shopify/polaris';

export default function DeleteThemeModal({
  confirmDelete,
  setConfirmDelete,
  handleDelete,
  actionLoading
}) {
  return (
    <Modal
      open={!!confirmDelete}
      onClose={() => setConfirmDelete(null)}
      title="Delete Theme"
      primaryAction={{
        content: 'Delete',
        destructive: true,
        onAction: () => handleDelete(confirmDelete?.id),
        loading: actionLoading === confirmDelete?.id
      }}
      secondaryActions={[{content: 'Cancel', onAction: () => setConfirmDelete(null)}]}
    >
      <Modal.Section>
        <Text>
          Are you sure you want to delete the theme <strong>{confirmDelete?.name}</strong>? This
          action cannot be undone.
        </Text>
      </Modal.Section>
    </Modal>
  );
}
