import React, {useRef, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {Modal, Banner, TextField, BlockStack, Button, InlineStack, Text} from '@shopify/polaris';
import {ClipboardIcon} from '@shopify/polaris-icons';

/**
 * One-shot display of the raw bot API key.
 * IMPORTANT: after this modal closes the raw value is gone forever.
 */
export default function ShowRawKeyModal({open, rawKey, keyName, onClose}) {
  const copyBtnRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setCopied(false);
      setTimeout(() => copyBtnRef.current?.focus?.(), 0);
    }
  }, [open]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(rawKey || '');
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Your new API key${keyName ? ` — ${keyName}` : ''}`}
      primaryAction={{content: "I've saved it", onAction: onClose}}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Banner tone="warning" title="Copy this key now">
            <Text as="p">This key will never be shown again. Store it somewhere safe — treat it like a password.</Text>
          </Banner>
          <TextField
            label="API key"
            value={rawKey || ''}
            readOnly
            autoComplete="off"
            monospaced
            multiline={2}
          />
          <InlineStack gap="200">
            <Button ref={copyBtnRef} icon={ClipboardIcon} variant="primary" onClick={copyToClipboard}>
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </Button>
          </InlineStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

ShowRawKeyModal.propTypes = {
  open: PropTypes.bool.isRequired,
  rawKey: PropTypes.string,
  keyName: PropTypes.string,
  onClose: PropTypes.func.isRequired
};
