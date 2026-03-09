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
    setLoading(true);
    // Fetch independently so a groups failure doesn't wipe out stores
    const [storesRes, groupsRes] = await Promise.allSettled([
      api('/api/stores?limit=200').then(r => r.json()).catch(() => null),
      api('/api/store-groups').then(r => r.json()).catch(() => null)
    ]);
    if (storesRes.value?.success) setStores(storesRes.value.data || []);
    if (groupsRes.value?.success) setGroups(groupsRes.value.data || []);
    setLoading(false);
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
