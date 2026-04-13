import React from 'react';
import PropTypes from 'prop-types';
import {
  BlockStack,
  InlineStack,
  RadioButton,
  Select,
  TextField,
  Button,
  Text
} from '@shopify/polaris';
import {DeleteIcon, PlusIcon} from '@shopify/polaris-icons';

const COLUMN_OPTIONS = [
  {label: 'Title', value: 'TITLE'},
  {label: 'Vendor', value: 'VENDOR'},
  {label: 'Tag', value: 'TAG'},
  {label: 'Type', value: 'TYPE'},
  {label: 'Price', value: 'VARIANT_PRICE'},
  {label: 'Inventory stock', value: 'VARIANT_INVENTORY'}
];

const RELATION_OPTIONS = [
  {label: 'is equal to', value: 'EQUALS'},
  {label: 'is not equal to', value: 'NOT_EQUALS'},
  {label: 'contains', value: 'CONTAINS'},
  {label: 'does not contain', value: 'NOT_CONTAINS'},
  {label: 'starts with', value: 'STARTS_WITH'},
  {label: 'ends with', value: 'ENDS_WITH'},
  {label: 'is greater than', value: 'GREATER_THAN'},
  {label: 'is less than', value: 'LESS_THAN'}
];

const DEFAULT_RULE = {column: 'TITLE', relation: 'EQUALS', condition: ''};

export default function SmartRuleBuilder({rules, disjunctive, onChange}) {
  const handleAddRule = () => {
    onChange([...rules, {...DEFAULT_RULE}], disjunctive);
  };

  const handleRemoveRule = index => {
    onChange(
      rules.filter((_, i) => i !== index),
      disjunctive
    );
  };

  const handleRuleChange = (index, field, value) => {
    const updated = rules.map((r, i) => (i === index ? {...r, [field]: value} : r));
    onChange(updated, disjunctive);
  };

  return (
    <BlockStack gap="300">
      <InlineStack gap="300" blockAlign="center" wrap={false}>
        <Text as="p" variant="bodySm" fontWeight="medium">
          Products must match:
        </Text>
        <RadioButton
          label="all conditions"
          checked={!disjunctive}
          id="all-conditions"
          name="matchType"
          onChange={() => onChange(rules, false)}
        />
        <RadioButton
          label="any condition"
          checked={disjunctive}
          id="any-condition"
          name="matchType"
          onChange={() => onChange(rules, true)}
        />
      </InlineStack>

      {rules.length === 0 && (
        <Text as="p" tone="subdued" variant="bodySm">
          No conditions yet. Add a condition to filter products automatically.
        </Text>
      )}

      {rules.map((rule, index) => (
        <InlineStack key={index} gap="200" blockAlign="center" wrap={false}>
          <div style={{flex: '0 0 150px'}}>
            <Select
              label="Column"
              labelHidden
              options={COLUMN_OPTIONS}
              value={rule.column}
              onChange={v => handleRuleChange(index, 'column', v)}
            />
          </div>
          <div style={{flex: '0 0 160px'}}>
            <Select
              label="Relation"
              labelHidden
              options={RELATION_OPTIONS}
              value={rule.relation}
              onChange={v => handleRuleChange(index, 'relation', v)}
            />
          </div>
          <div style={{flex: 1}}>
            <TextField
              label="Value"
              labelHidden
              value={rule.condition}
              onChange={v => handleRuleChange(index, 'condition', v)}
              placeholder="Value"
              autoComplete="off"
            />
          </div>
          <Button
            icon={DeleteIcon}
            variant="plain"
            tone="critical"
            onClick={() => handleRemoveRule(index)}
            accessibilityLabel="Remove condition"
          />
        </InlineStack>
      ))}

      <div>
        <Button icon={PlusIcon} onClick={handleAddRule} variant="plain">
          Add another condition
        </Button>
      </div>
    </BlockStack>
  );
}

SmartRuleBuilder.propTypes = {
  rules: PropTypes.array.isRequired,
  disjunctive: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired
};
