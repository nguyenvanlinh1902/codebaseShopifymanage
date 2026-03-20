import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {Select} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Dropdown selector for connected Gmail accounts
 */
export default function AccountSelector({selectedEmail, onSelect}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/gmail/accounts');
      const result = await res.json();
      if (result.success) {
        setAccounts(result.data || []);
        if (!selectedEmail && result.data?.length > 0) {
          onSelect(result.data[0].email);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Gmail accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmail, onSelect]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const options = [
    {label: 'Select a Gmail account...', value: ''},
    ...accounts.map(a => ({label: a.email, value: a.email}))
  ];

  return (
    <Select
      label="Gmail Account"
      options={options}
      value={selectedEmail || ''}
      onChange={onSelect}
      disabled={loading}
      helpText={accounts.length === 0 && !loading ? 'No accounts connected. Go to Accounts tab.' : ''}
    />
  );
}

AccountSelector.propTypes = {
  selectedEmail: PropTypes.string,
  onSelect: PropTypes.func.isRequired
};
