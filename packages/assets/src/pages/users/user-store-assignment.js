import React, {useMemo} from 'react';
import PropTypes from 'prop-types';
import SearchableChoiceList from '../../components/searchable-choice-list';

export default function UserStoreAssignment({stores, selectedStoreIds, onChange}) {
  // Support both legacy string[] and current {id, shopDomain}[] formats
  const selectedIds = useMemo(
    () => selectedStoreIds.map(s => (typeof s === 'string' ? s : s.id)),
    [selectedStoreIds]
  );

  const choices = useMemo(
    () =>
      stores.map(s => ({
        label: `${s.name || s.shopDomain} (${s.shopDomain})`,
        value: s.id
      })),
    [stores]
  );

  const handleChange = ids => {
    onChange(
      ids.map(id => {
        const store = stores.find(s => s.id === id);
        return {id, shopDomain: store?.shopDomain || ''};
      })
    );
  };

  return (
    <SearchableChoiceList
      title="Assigned Stores"
      helperText="Empty = no store access"
      choices={choices}
      selected={selectedIds}
      onChange={handleChange}
      showSelectAll
      searchPlaceholder="Search stores..."
      emptyText="No stores available"
    />
  );
}

UserStoreAssignment.propTypes = {
  stores: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      shopDomain: PropTypes.string
    })
  ).isRequired,
  selectedStoreIds: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.arrayOf(PropTypes.shape({id: PropTypes.string, shopDomain: PropTypes.string}))
  ]).isRequired,
  onChange: PropTypes.func.isRequired
};
