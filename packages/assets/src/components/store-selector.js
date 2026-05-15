import React, {useState, useMemo, useCallback, useEffect} from 'react';
import {Autocomplete, Icon} from '@shopify/polaris';
import {SearchIcon} from '@shopify/polaris-icons';

/**
 * StoreSelector — searchable single-select with A-Z sorting.
 * Built on Polaris Autocomplete so it renders as a labelled TextField
 * matching surrounding Select/TextField form fields.
 *
 * Props:
 * - label (string): field label (shown above the input unless labelHidden).
 * - options ([{label, value}]): items to choose from.
 * - value (string): currently selected value.
 * - onChange (fn): called with selected value.
 * - pinnedValues (string[]): values kept on top of the list (e.g., "All Stores"
 *   sentinels). Defaults cover common project conventions.
 * - placeholder, labelHidden, disabled, helpText, requiredIndicator: passed
 *   through to the underlying Autocomplete.TextField.
 */
export default function StoreSelector({
  label = 'Select',
  options = [],
  value,
  onChange,
  pinnedValues = ['all', '__all__', ''],
  placeholder = 'Search...',
  labelHidden,
  disabled,
  helpText,
  requiredIndicator
}) {
  // Selected option's display label drives the input value when not actively
  // searching. We track input separately so user can type to filter.
  const selectedLabel = useMemo(
    () => options.find(o => o.value === value)?.label || '',
    [options, value]
  );

  const [inputValue, setInputValue] = useState(selectedLabel);

  // Keep input synced when the selected value changes externally
  // (e.g., parent resets filter, group filter narrows store list).
  useEffect(() => {
    setInputValue(selectedLabel);
  }, [selectedLabel]);

  // Sort A-Z (case-insensitive); keep pinned values on top in declared order.
  const sortedOptions = useMemo(() => {
    const pinned = [];
    const rest = [];
    for (const opt of options) {
      if (pinnedValues.includes(opt.value)) pinned.push(opt);
      else rest.push(opt);
    }
    pinned.sort((a, b) => pinnedValues.indexOf(a.value) - pinnedValues.indexOf(b.value));
    rest.sort((a, b) =>
      String(a.label).localeCompare(String(b.label), undefined, {sensitivity: 'base'})
    );
    return [...pinned, ...rest];
  }, [options, pinnedValues]);

  // Filter based on input text. When input equals the currently selected
  // option's label, show full list (user just opened the dropdown again).
  const filteredOptions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q || inputValue === selectedLabel) return sortedOptions;
    return sortedOptions.filter(o => String(o.label).toLowerCase().includes(q));
  }, [sortedOptions, inputValue, selectedLabel]);

  const handleSelect = useCallback(
    selected => {
      const next = selected[0];
      onChange?.(next);
      const matched = options.find(o => o.value === next);
      setInputValue(matched?.label || '');
    },
    [options, onChange]
  );

  const handleInputChange = useCallback(v => setInputValue(v), []);

  // Restore selected label on blur if user typed without picking anything.
  const handleBlur = useCallback(() => {
    setInputValue(selectedLabel);
  }, [selectedLabel]);

  const textField = (
    <Autocomplete.TextField
      label={label}
      labelHidden={labelHidden}
      value={inputValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      prefix={<Icon source={SearchIcon} tone="subdued" />}
      autoComplete="off"
      disabled={disabled}
      helpText={helpText}
      requiredIndicator={requiredIndicator}
    />
  );

  return (
    <Autocomplete
      options={filteredOptions}
      selected={value ? [value] : []}
      onSelect={handleSelect}
      textField={textField}
      emptyState={
        <div style={{padding: '12px 16px', color: 'var(--p-color-text-secondary)'}}>
          No matches
        </div>
      }
    />
  );
}
