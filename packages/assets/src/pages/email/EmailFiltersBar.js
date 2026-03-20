import React, {useState, useEffect, useRef, useCallback} from 'react';
import PropTypes from 'prop-types';
import {InlineStack, TextField, Select} from '@shopify/polaris';

/**
 * Search + label filter bar for email list
 */
export default function EmailFiltersBar({labels, onFilter}) {
  const [query, setQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const debounceRef = useRef(null);

  const triggerFilter = useCallback((q, l) => {
    onFilter({query: q, label: l});
  }, [onFilter]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerFilter(query, selectedLabel);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, selectedLabel, triggerFilter]);

  const labelOptions = [
    {label: 'All labels', value: ''},
    ...labels.map(l => ({label: l.name, value: l.id}))
  ];

  return (
    <InlineStack gap="300" blockAlign="end">
      <div style={{minWidth: 300}}>
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
      <div style={{minWidth: 200}}>
        <Select
          label="Label"
          options={labelOptions}
          value={selectedLabel}
          onChange={setSelectedLabel}
        />
      </div>
    </InlineStack>
  );
}

EmailFiltersBar.propTypes = {
  labels: PropTypes.array.isRequired,
  onFilter: PropTypes.func.isRequired
};
