import {useState, useEffect} from 'react';
import {api} from '../../helpers/api';

export function useStores() {
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setStoresLoading(true);
      const res = await api('/api/stores?limit=50');
      const data = await res.json();
      if (data.success) {
        setStores(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load stores:', err);
    } finally {
      setStoresLoading(false);
    }
  };

  return {stores, storesLoading, loadStores};
}
