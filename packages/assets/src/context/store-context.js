import React, {createContext, useContext, useState, useEffect, useCallback} from 'react';
import PropTypes from 'prop-types';
import {api} from '../helpers/api';

const StoreContext = createContext(null);

StoreProvider.propTypes = {children: PropTypes.node.isRequired};

export function StoreProvider({children}) {
  const [stores, setStores] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [storesRes, groupsRes] = await Promise.all([
        api('/api/stores?limit=200').then(r => r.json()),
        api('/api/store-groups').then(r => r.json())
      ]);
      if (storesRes.success) setStores(storesRes.data || []);
      if (groupsRes.success) setGroups(groupsRes.data || []);
    } catch {
      // silent — components handle empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <StoreContext.Provider value={{stores, groups, loading, refetch: fetchAll}}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStores() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStores must be used within StoreProvider');
  }
  return context;
}
