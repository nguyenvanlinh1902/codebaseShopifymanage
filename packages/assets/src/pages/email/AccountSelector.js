import React, {useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {api} from '../../helpers/api';
import StoreSelector from '../../components/store-selector';

/**
 * Dropdown selector scoped to a single provider ('outlook' | 'gmail').
 * Lists all accounts the current user may access (derived server-side from
 * assignedStores, so no storeId param is passed).
 */
export default function AccountSelector({provider = 'outlook', selectedEmail, onSelect}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = provider === 'gmail' ? '/api/gmail' : '/api/outlook';

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api(`${base}/accounts`);
      const result = await res.json();
      if (result.success) {
        const all = result.data || [];
        setAccounts(all);
        if (!selectedEmail && all.length > 0) {
          onSelect(all[0].email, provider);
        }
      }
    } catch (err) {
      console.error('Failed to fetch email accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [base, provider, selectedEmail, onSelect]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const options = accounts.map(a => {
    const storeLabel = a.storeName ? ` — ${a.storeName}` : '';
    return {label: `${a.email}${storeLabel}`, value: a.email};
  });

  return (
    <StoreSelector
      label={`${provider === 'gmail' ? 'Gmail' : 'Outlook'} Account`}
      placeholder="Select an email account..."
      options={options}
      value={selectedEmail || ''}
      onChange={v => onSelect(v, provider)}
      disabled={loading}
      pinnedValues={[]}
      helpText={
        accounts.length === 0 && !loading
          ? 'No accounts accessible with your current permissions.'
          : ''
      }
    />
  );
}

AccountSelector.propTypes = {
  provider: PropTypes.oneOf(['outlook', 'gmail']),
  selectedEmail: PropTypes.string,
  onSelect: PropTypes.func.isRequired
};
