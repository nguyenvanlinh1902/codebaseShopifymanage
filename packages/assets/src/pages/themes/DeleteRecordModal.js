import React from 'react';
import {Modal, Text} from '@shopify/polaris';

export default function DeleteRecordModal({
  confirmDeleteRecord,
  setConfirmDeleteRecord,
  handleDeleteRecord,
  actionLoading
}) {
  return (
    <Modal
      open={!!confirmDeleteRecord}
      onClose={() => setConfirmDeleteRecord(null)}
      title="Delete Saved Theme"
      primaryAction={{
        content: 'Delete',
        destructive: true,
        onAction: () => handleDeleteRecord(confirmDeleteRecord?.id),
        loading: actionLoading === confirmDeleteRecord?.id
      }}
      secondaryActions={[{content: 'Cancel', onAction: () => setConfirmDeleteRecord(null)}]}
    >
      <Modal.Section>
        <Text>
          Delete <strong>{confirmDeleteRecord?.themeName}</strong> from server? The file will be
          removed from storage permanently.
        </Text>
      </Modal.Section>
    </Modal>
  );
}
