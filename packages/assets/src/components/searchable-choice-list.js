import React, {useMemo, useState} from 'react';
import {ChoiceList, BlockStack, TextField, Icon, Text, InlineStack, Button} from '@shopify/polaris';
import {SearchIcon} from '@shopify/polaris-icons';

const DEFAULT_SEARCH_THRESHOLD = 8;
const DEFAULT_MAX_HEIGHT = 320;

/**
 * SearchableChoiceList — Polaris ChoiceList with search box + A-Z sort.
 *
 * Selections from filtered-out items are preserved when user types in the
 * search box, so filtering never silently deselects anything.
 *
 * Props:
 * - title (string): heading shown above search box (optional).
 * - choices ([{label, value, disabled?}]): full list of choices.
 * - selected (string[]): currently selected values.
 * - onChange (fn): called with new array of selected values.
 * - allowMultiple (bool): default true.
 * - showSelectAll (bool): show "Select All / Deselect All" toggle. Default false.
 * - searchThreshold (int): show search box when choices.length >= threshold.
 * - searchPlaceholder (string)
 * - maxHeight (number): scrollable area max-height in px. Default 320.
 * - emptyText (node): rendered when choices is empty (before filter).
 * - helperText (node): rendered between header and search box.
 * - disabled (bool)
 */
export default function SearchableChoiceList({
  title,
  choices = [],
  selected = [],
  onChange,
  allowMultiple = true,
  showSelectAll = false,
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
  searchPlaceholder = 'Search...',
  maxHeight = DEFAULT_MAX_HEIGHT,
  emptyText,
  helperText,
  disabled
}) {
  const [query, setQuery] = useState('');

  const sortedChoices = useMemo(() => {
    const list = [...choices];
    list.sort((a, b) =>
      String(a.label).localeCompare(String(b.label), undefined, {sensitivity: 'base'})
    );
    return list;
  }, [choices]);

  const filteredChoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedChoices;
    return sortedChoices.filter(c => String(c.label).toLowerCase().includes(q));
  }, [sortedChoices, query]);

  const allValues = useMemo(() => choices.map(c => c.value), [choices]);
  const allSelected = choices.length > 0 && selected.length === choices.length;

  const toggleAll = () => {
    if (!onChange) return;
    onChange(allSelected ? [] : allValues);
  };

  // Polaris ChoiceList already preserves hidden selections: its onChange
  // returns the full `selected` array with the toggled value added/removed.
  // Forward it as-is — merging again would duplicate hidden items.
  const handleChange = nextSelected => {
    if (!onChange) return;
    onChange(nextSelected);
  };

  if (choices.length === 0 && emptyText) {
    return (
      <Text tone="subdued" variant="bodySm">
        {emptyText}
      </Text>
    );
  }

  const showSearch = choices.length >= searchThreshold;

  return (
    <BlockStack gap="200">
      {(title || showSelectAll) && (
        <InlineStack align="space-between" blockAlign="center">
          {title ? <Text variant="headingSm">{title}</Text> : <span />}
          {showSelectAll && (
            <Button variant="plain" onClick={toggleAll} disabled={disabled}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </InlineStack>
      )}
      {helperText && (
        <Text variant="bodySm" tone="subdued">
          {helperText}
        </Text>
      )}
      {showSearch && (
        <TextField
          label="Search"
          labelHidden
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder}
          prefix={<Icon source={SearchIcon} tone="subdued" />}
          autoComplete="off"
          clearButton
          onClearButtonClick={() => setQuery('')}
          disabled={disabled}
        />
      )}
      <div style={{maxHeight, overflowY: 'auto'}}>
        <ChoiceList
          allowMultiple={allowMultiple}
          title=""
          titleHidden
          choices={filteredChoices}
          selected={selected}
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
      {query && (
        <Text variant="bodySm" tone="subdued">
          Showing {filteredChoices.length} of {choices.length}
          {selected.length > 0 ? ` · ${selected.length} selected` : ''}
        </Text>
      )}
    </BlockStack>
  );
}
