import React, {useState, useCallback} from 'react';
import {Modal, TextField, Tag, InlineStack, BlockStack, Text} from '@shopify/polaris';

/**
 * Modal for adding or removing tags from selected products.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {'add'|'remove'} props.mode - "add" or "remove"
 * @param {number} props.productCount - number of selected products
 * @param {boolean} props.loading
 * @param {function} props.onClose
 * @param {function} props.onSubmit - called with tags array
 */
export default function BulkTagModal({open, mode, productCount, loading, onClose, onSubmit}) {
  const [inputValue, setInputValue] = useState('');
  const [tags, setTags] = useState([]);

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setInputValue('');
  }, [inputValue, tags]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd();
    }
  }, [handleAdd]);

  const handleRemoveTag = useCallback((tag) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const handleSubmit = useCallback(() => {
    if (tags.length === 0) return;
    onSubmit(tags);
    setTags([]);
    setInputValue('');
  }, [tags, onSubmit]);

  const handleClose = useCallback(() => {
    setTags([]);
    setInputValue('');
    onClose();
  }, [onClose]);

  const title = mode === 'add' ? 'Add tags' : 'Remove tags';
  const description = mode === 'add'
    ? `Add tags to ${productCount} selected product(s)`
    : `Remove tags from ${productCount} selected product(s)`;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      primaryAction={{content: title, onAction: handleSubmit, loading, disabled: tags.length === 0}}
      secondaryActions={[{content: 'Cancel', onAction: handleClose}]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text variant="bodySm" tone="subdued">{description}</Text>
          <TextField
            label="Tags"
            labelHidden
            value={inputValue}
            onChange={setInputValue}
            onKeyDown={handleKeyPress}
            onBlur={handleAdd}
            placeholder="Enter tag and press Enter"
            autoComplete="off"
            connectedRight={
              <button type="button" onClick={handleAdd} style={{padding: '6px 12px', cursor: 'pointer'}}>Add</button>
            }
          />
          {tags.length > 0 && (
            <InlineStack gap="200" wrap>
              {tags.map(tag => (
                <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>{tag}</Tag>
              ))}
            </InlineStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
