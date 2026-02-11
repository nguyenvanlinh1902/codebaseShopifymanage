import React, {useMemo} from 'react';
import {
  IndexFilters,
  Autocomplete,
  Tag,
  InlineStack,
  BlockStack,
  useSetIndexFiltersMode
} from '@shopify/polaris';

/**
 * Filter bar with search and niche filtering
 */
export default function StoresFilterBar({
  searchValue,
  onSearchChange,
  onSearchClear,
  nicheFilter,
  nicheInputValue,
  onNicheInputChange,
  allNiches,
  onNicheSelect,
  onNicheRemove,
  onClearAll
}) {
  const {mode, setMode} = useSetIndexFiltersMode();

  const nicheOptions = useMemo(() => {
    const filtered = nicheInputValue
      ? allNiches.filter(n => n.toLowerCase().includes(nicheInputValue.toLowerCase()))
      : allNiches;
    return filtered.filter(n => !nicheFilter.includes(n)).map(n => ({value: n, label: n}));
  }, [allNiches, nicheInputValue, nicheFilter]);

  const nicheFilterMarkup = (
    <BlockStack gap="200">
      <Autocomplete
        allowMultiple
        options={nicheOptions}
        selected={nicheFilter}
        onSelect={onNicheSelect}
        textField={
          <Autocomplete.TextField
            onChange={onNicheInputChange}
            value={nicheInputValue}
            placeholder="Search niches..."
            autoComplete="off"
          />
        }
      />
      <InlineStack gap="100" wrap>
        {nicheFilter.map(niche => (
          <Tag key={niche} onRemove={() => onNicheRemove(niche)}>
            {niche}
          </Tag>
        ))}
      </InlineStack>
    </BlockStack>
  );

  const filters = [
    {
      key: 'niche',
      label: 'Niche',
      filter: nicheFilterMarkup,
      shortcut: true
    }
  ];

  const appliedFilters =
    nicheFilter.length > 0
      ? [
          {
            key: 'niche',
            label: `Niche: ${nicheFilter.join(', ')}`,
            onRemove: () => onClearAll()
          }
        ]
      : [];

  return (
    <IndexFilters
      queryValue={searchValue}
      queryPlaceholder="Search by store name or domain..."
      onQueryChange={onSearchChange}
      onQueryClear={onSearchClear}
      filters={filters}
      appliedFilters={appliedFilters}
      onClearAll={onClearAll}
      mode={mode}
      setMode={setMode}
      cancelAction={{
        onAction: () => {
          onClearAll();
          setMode('DEFAULT');
        }
      }}
      tabs={[]}
      selected={0}
      canCreateNewView={false}
    />
  );
}
