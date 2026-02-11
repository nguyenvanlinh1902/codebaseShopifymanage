import {useState, useEffect, useRef} from 'react';
import {api} from '../../helpers/api';

const PAGE_LIMIT = 10;

/**
 * Custom hook for managing stores data fetching and state
 */
export function useStoresData() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({page: 1, total: 0, totalPages: 0});
  const [error, setError] = useState(null);
  const lastStoresFetchKeyRef = useRef(null);

  const fetchStores = async (page = 1, search = '', niches = []) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT)
      });
      if (search) params.set('search', search);
      if (niches.length > 0) params.set('niche', niches.join(','));

      const response = await api(`/api/stores?${params}`);
      const result = await response.json();
      if (result.success) {
        setStores(result.data || []);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  return {
    stores,
    loading,
    pagination,
    error,
    setError,
    fetchStores,
    lastStoresFetchKeyRef
  };
}
