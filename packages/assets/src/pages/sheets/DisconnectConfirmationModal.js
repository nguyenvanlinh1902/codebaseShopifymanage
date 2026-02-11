import React from 'react';
import PropTypes from 'prop-types';
import {Modal, Text} from '@shopify/polaris';

/**
 * Modal for confirming account disconnection
 */
export default function DisconnectConfirmationModal({
  open,
  onClose,
  onConfirm,
  loading,
  pendingDisconnectEmail,
  pendingDisconnectEmails
}) {
  const message =
    pendingDisconnectEmails.length > 0
      ? `Are you sure you want to disconnect ${pendingDisconnectEmails.length} account(s)? This will remove the accounts and all sheets connected through them.`
      : `Are you sure you want to disconnect ${pendingDisconnectEmail}? This will remove the account and all sheets connected through it.`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Disconnect account(s)"
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

DisconnectConfirmationModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  pendingDisconnectEmail: PropTypes.string,
  pendingDisconnectEmails: PropTypes.array
};

DisconnectConfirmationModal.defaultProps = {
  pendingDisconnectEmails: []
};
