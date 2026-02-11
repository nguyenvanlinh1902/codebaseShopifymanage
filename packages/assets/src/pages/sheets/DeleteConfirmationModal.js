import React from 'react';
import PropTypes from 'prop-types';
import {Modal, Text} from '@shopify/polaris';

/**
 * Modal for confirming sheet deletion
 */
export default function DeleteConfirmationModal({
  open,
  onClose,
  onConfirm,
  loading,
  pendingDeleteTarget,
  pendingDeleteIds
}) {
  const message = pendingDeleteTarget
    ? `Are you sure you want to disconnect "${pendingDeleteTarget.name}"? This will remove the sheet connection but won't delete any data.`
    : `Are you sure you want to disconnect ${pendingDeleteIds.length} sheet(s)? This will remove the sheet connections but won't delete any data.`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Disconnect sheet(s)"
      primaryAction={{
        content: 'Disconnect',
        destructive: true,
        loading,
        onAction: onConfirm
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose
        }
      ]}
    >
      <Modal.Section>
        <Text as="p">{message}</Text>
      </Modal.Section>
    </Modal>
  );
}

DeleteConfirmationModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  pendingDeleteTarget: PropTypes.object,
  pendingDeleteIds: PropTypes.array
};

DeleteConfirmationModal.defaultProps = {
  pendingDeleteIds: []
};
