import React from 'react';
import PropTypes from 'prop-types';
import {Modal, Text, BlockStack, Banner} from '@shopify/polaris';

export default function RevokeConfirmationModal({open, keyName, keyPrefix, onConfirm, onClose, submitting}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Revoke API key"
      primaryAction={{content: 'Revoke', destructive: true, onAction: onConfirm, loading: submitting}}
      secondaryActions={[{content: 'Cancel', onAction: onClose}]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Banner tone="warning">Revoking is immediate and cannot be undone. Any bot using this key will start getting 401 errors.</Banner>
          <Text as="p">
            Revoke <strong>{keyName || '(unnamed)'}</strong> (<code>bot_{keyPrefix}…</code>)?
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

RevokeConfirmationModal.propTypes = {
  open: PropTypes.bool.isRequired,
  keyName: PropTypes.string,
  keyPrefix: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  submitting: PropTypes.bool
};
