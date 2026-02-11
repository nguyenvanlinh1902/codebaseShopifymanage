import {useState, useEffect, useRef} from 'react';
import {api} from '../../helpers/api';

/**
 * Custom hook for managing niches data
 */
export function useNichesData() {
  const [allNiches, setAllNiches] = useState([]);
  const nichesFetchedRef = useRef(false);

  const fetchNiches = async () => {
    try {
      const response = await api('/api/stores/niches');
      const result = await response.json();
      if (result.success) {
        setAllNiches(result.data);
      }
    } catch (err) {
      console.error('Error fetching niches:', err);
    }
  };

  useEffect(() => {
    if (nichesFetchedRef.current) return;
    nichesFetchedRef.current = true;
    fetchNiches();
  }, []);

  return {allNiches, fetchNiches};
}
