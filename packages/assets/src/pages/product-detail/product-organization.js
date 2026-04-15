/* eslint-disable react/prop-types */
import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Tag,
  Autocomplete,
  TextField,
  Listbox,
  Combobox,
  Icon,
  EmptySearchResult
} from '@shopify/polaris';
import {SearchIcon, PlusCircleIcon} from '@shopify/polaris-icons';
import {api} from '../../helpers/api';

function useAutocomplete(endpoint, storeId) {
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [filtered, setFiltered] = useState([]);
  const cacheRef = useRef(null);

  useEffect(() => {
    if (!storeId || !endpoint || cacheRef.current) return;
    api(`${endpoint}?storeId=${storeId}`)
      .then(r => r.json())
      .then(result => {
        if (result.success) {
          const items = (result.data || []).map(v => ({label: v, value: v}));
          cacheRef.current = items;
          setOptions(items);
          setFiltered(items);
        }
      })
      .catch(() => {});
  }, [storeId, endpoint]);

  const handleInput = useCallback(
    value => {
      setInputValue(value);
      const src = cacheRef.current || options;
      setFiltered(
        value ? src.filter(o => o.label.toLowerCase().includes(value.toLowerCase())) : src
      );
    },
    [options]
  );

  return {options: filtered, inputValue, setInputValue: handleInput};
}

function CollectionsPicker({selected, onChange, storeId}) {
  const [query, setQuery] = useState('');
  const [allCollections, setAllCollections] = useState([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!storeId || loadedRef.current) return;
    loadedRef.current = true;
    api(`/api/shopify-products/collections?storeId=${storeId}`)
      .then(r => r.json())
      .then(result => {
        if (result.success) setAllCollections(result.data || []);
      })
      .catch(() => {});
  }, [storeId]);

  const selectedIds = useMemo(
    () => new Set((selected || []).map(c => c.id || c)),
    [selected]
  );

  const filtered = useMemo(() => {
    if (!query) return allCollections;
    const q = query.toLowerCase();
    return allCollections.filter(c => (c.title || '').toLowerCase().includes(q));
  }, [allCollections, query]);

  const toggle = col => {
    const id = col.id;
    const exists = (selected || []).some(c => (c.id || c) === id);
    if (exists) {
      onChange(
        'collections',
        (selected || []).filter(c => (c.id || c) !== id)
      );
    } else {
      onChange('collections', [...(selected || []), {id: col.id, title: col.title}]);
    }
  };

  const removeChip = id => {
    onChange('collections', (selected || []).filter(c => (c.id || c) !== id));
  };

  const textField = (
    <Combobox.TextField
      prefix={<Icon source={SearchIcon} />}
      onChange={setQuery}
      label="Collections"
      labelHidden
      value={query}
      placeholder="Search collections"
      autoComplete="off"
    />
  );

  const optionMarkup = filtered.length > 0
    ? filtered.map(col => (
        <Listbox.Option
          key={col.id}
          value={col.id}
          selected={selectedIds.has(col.id)}
          accessibilityLabel={col.title}
        >
          <Listbox.TextOption selected={selectedIds.has(col.id)}>
            {col.title}
          </Listbox.TextOption>
        </Listbox.Option>
      ))
    : null;

  const emptyMarkup =
    query && filtered.length === 0 ? (
      <EmptySearchResult title="No collections" description="Try a different search" withIllustration={false} />
    ) : null;

  return (
    <BlockStack gap="150">
      <Text as="p" variant="bodySm" fontWeight="medium">
        Collections
      </Text>
      <Combobox activator={textField} allowMultiple>
        {optionMarkup || emptyMarkup ? (
          <Listbox onSelect={id => {
            const col = allCollections.find(c => c.id === id);
            if (col) toggle(col);
          }}>
            {optionMarkup}
          </Listbox>
        ) : null}
      </Combobox>
      {(selected || []).length > 0 && (
        <InlineStack gap="150" wrap>
          {(selected || []).map(c => (
            <Tag key={c.id || c} onRemove={() => removeChip(c.id || c)}>
              {c.title || c.id || c}
            </Tag>
          ))}
        </InlineStack>
      )}
    </BlockStack>
  );
}

export default function ProductOrganization({formData, onChange, storeId}) {
  const typeAC = useAutocomplete('/api/shopify-products/product-types', storeId);
  const vendorAC = useAutocomplete('/api/shopify-products/vendors', storeId);

  const tags = Array.isArray(formData.tags)
    ? formData.tags
    : formData.tags
    ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    const val = tagInput.trim();
    if (!val || tags.includes(val)) {
      setTagInput('');
      return;
    }
    onChange('tags', [...tags, val]);
    setTagInput('');
  };

  const handleTagKeyDown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = tag => {
    onChange('tags', tags.filter(t => t !== tag));
  };

  const handleTypeSelect = ([value]) => {
    typeAC.setInputValue(value);
    onChange('productType', value);
  };

  const handleVendorSelect = ([value]) => {
    vendorAC.setInputValue(value);
    onChange('vendor', value);
  };

  useEffect(() => {
    if (formData.productType) typeAC.setInputValue(formData.productType);
  }, []);

  useEffect(() => {
    if (formData.vendor) vendorAC.setInputValue(formData.vendor);
  }, []);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">
          Product organization
        </Text>

        <Autocomplete
          options={typeAC.options}
          selected={formData.productType ? [formData.productType] : []}
          onSelect={handleTypeSelect}
          textField={
            <Autocomplete.TextField
              label="Product type"
              value={typeAC.inputValue}
              onChange={v => {
                typeAC.setInputValue(v);
                onChange('productType', v);
              }}
              autoComplete="off"
              placeholder="e.g. Snowboard"
            />
          }
        />

        <Autocomplete
          options={vendorAC.options}
          selected={formData.vendor ? [formData.vendor] : []}
          onSelect={handleVendorSelect}
          textField={
            <Autocomplete.TextField
              label="Vendor"
              value={vendorAC.inputValue}
              onChange={v => {
                vendorAC.setInputValue(v);
                onChange('vendor', v);
              }}
              autoComplete="off"
              placeholder="e.g. Burton"
            />
          }
        />

        <CollectionsPicker
          selected={formData.collections || []}
          onChange={onChange}
          storeId={storeId}
        />

        <BlockStack gap="100">
          <Text as="p" variant="bodySm" fontWeight="medium">
            Tags
          </Text>
          <div style={{flex: 1}}>
            <TextField
              label="Add tag"
              labelHidden
              value={tagInput}
              onChange={setTagInput}
              onKeyDown={handleTagKeyDown}
              onBlur={handleAddTag}
              placeholder="Add tag and press Enter"
              autoComplete="off"
            />
          </div>
          {tags.length > 0 && (
            <InlineStack gap="200" wrap>
              {tags.map(tag => (
                <Tag key={tag} onRemove={() => handleRemoveTag(tag)}>
                  {tag}
                </Tag>
              ))}
            </InlineStack>
          )}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
