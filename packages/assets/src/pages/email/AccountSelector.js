import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {Select} from '@shopify/polaris';
import {api} from '../../helpers/api';

/**
 * Dropdown selector for connected email accounts (Gmail + Outlook)
 */
export default function AccountSelector({selectedEmail, onSelect}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const [gmailRes, outlookRes] = await Promise.all([
        api('/api/gmail/accounts').then(r => r.json()),
        api('/api/outlook/accounts').then(r => r.json())
      ]);

      const gmail = (gmailRes.success ? gmailRes.data : []).map(a => ({
        ...a,
        provider: 'gmail'
      }));
      const outlook = (outlookRes.success ? outlookRes.data : []).map(a => ({
        ...a,
        provider: 'outlook'
      }));
      const all = [...gmail, ...outlook];
      setAccounts(all);

      if (!selectedEmail && all.length > 0) {
        onSelect(all[0].email, all[0].provider);
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
    ...accounts.map(a => ({
      label: `${a.email} (${a.provider === 'outlook' ? 'Outlook' : 'Gmail'})`,
      value: a.email
    }))
  ];

  const handleChange = value => {
    const account = accounts.find(a => a.email === value);
    onSelect(value, account?.provider || 'gmail');
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
