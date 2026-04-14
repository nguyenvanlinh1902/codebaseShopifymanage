import React, {useState, useEffect, useRef, useCallback} from 'react';
import PropTypes from 'prop-types';
import {InlineStack, TextField, Select, ButtonGroup, Button} from '@shopify/polaris';

/**
 * Search + label + inbox type filter bar for email list
 */
export default function EmailFiltersBar({labels, onFilter}) {
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [inboxType, setInboxType] = useState('all');
  const debounceRef = useRef(null);

  const triggerFilter = useCallback((q, l, t) => {
    onFilter({query: q, label: l, inboxType: t});
  }, [onFilter]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerFilter(query, selectedLabel, inboxType);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, selectedLabel, inboxType, triggerFilter]);

  const labelOptions = [
    {label: 'All labels', value: ''},
    ...labels.map(l => ({label: l.name, value: l.id}))
  ];

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
      <ButtonGroup variant="segmented">
        {['all', 'focused', 'other'].map(type => (
          <Button
            key={type}
            pressed={inboxType === type}
            onClick={() => setInboxType(type)}
          >
            {type === 'all' ? 'All' : type === 'focused' ? 'Focused' : 'Other'}
          </Button>
        ))}
      </ButtonGroup>
      <InlineStack gap="300" blockAlign="end" wrap>
        <div className="filter-item filter-item--lg">
          <TextField
            label="Search"
            value={query}
            onChange={setQuery}
            placeholder="Search emails..."
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setQuery('')}
          />
        </div>
        <div className="filter-item filter-item--md">
          <Select
            label="Label"
            options={labelOptions}
            value={selectedLabel}
            onChange={setSelectedLabel}
          />
        </div>
      </InlineStack>
    </div>
  );
}

EmailFiltersBar.propTypes = {
  labels: PropTypes.array.isRequired,
  onFilter: PropTypes.func.isRequired
};
