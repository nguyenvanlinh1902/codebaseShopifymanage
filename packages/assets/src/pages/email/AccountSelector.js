import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {Select} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Dropdown selector for connected Outlook/Hotmail accounts
 */
export default function AccountSelector({selectedEmail, onSelect}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/outlook/accounts');
      const result = await res.json();
      if (result.success) {
        const all = result.data || [];
        setAccounts(all);
        if (!selectedEmail && all.length > 0) {
          onSelect(all[0].email, 'outlook');
        }
      }
    } catch (err) {
      console.error('Failed to fetch email accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmail, onSelect]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const options = [
    {label: 'Select an email account...', value: ''},
    ...accounts.map(a => ({label: a.email, value: a.email}))
  ];

  const handleChange = value => {
    onSelect(value, 'outlook');
  };

  return (
    <Select
      label="Email Account"
      options={options}
      value={selectedEmail || ''}
      onChange={handleChange}
      disabled={loading}
      helpText={
        accounts.length === 0 && !loading ? 'No accounts connected. Go to Accounts tab.' : ''
      }
    />
  );
}

AccountSelector.propTypes = {
  selectedEmail: PropTypes.string,
  onSelect: PropTypes.func.isRequired
};
