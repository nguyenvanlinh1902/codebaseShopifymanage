import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {Modal, FormLayout, TextField, DatePicker, BlockStack, Text, Banner} from '@shopify/polaris';

export default function CreateKeyModal({open, onClose, onCreate, submitting}) {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [error, setError] = useState('');
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const reset = () => {
    setName('');
    setExpiresAt(null);
    setError('');
    setDatePickerOpen(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await onCreate({
        name: name.trim(),
        storeIds: [],
        expiresAt: expiresAt ? expiresAt.toISOString() : null
      });
      reset();
    } catch (e) {
      setError(e.message || 'Failed to create key');
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create Bot API Key"
      primaryAction={{content: 'Create', onAction: submit, loading: submitting}}
      secondaryActions={[{content: 'Cancel', onAction: handleClose}]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {error && <Banner tone="critical">{error}</Banner>}
          <FormLayout>
            <TextField
              label="Name"
              value={name}
              onChange={setName}
              placeholder="e.g. Gemini Bot"
              autoComplete="off"
              requiredIndicator
            />
            <Text as="p" tone="subdued">Expires (optional)</Text>
            <TextField
              label="Expires"
              labelHidden
              value={expiresAt ? expiresAt.toISOString().slice(0, 10) : ''}
              onFocus={() => setDatePickerOpen(true)}
              placeholder="YYYY-MM-DD"
              autoComplete="off"
              readOnly
              clearButton
              onClearButtonClick={() => setExpiresAt(null)}
            />
            {datePickerOpen && (
              <DatePicker
                month={month}
                year={year}
                selected={expiresAt || undefined}
                onChange={({start}) => {
                  setExpiresAt(start);
                  setDatePickerOpen(false);
                }}
                onMonthChange={(m, y) => {
                  setMonth(m);
                  setYear(y);
                }}
                disableDatesBefore={today}
              />
            )}
          </FormLayout>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

CreateKeyModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  submitting: PropTypes.bool
};
