import {useState, useCallback} from 'react';
import {api} from '../helpers/api';

/** Lightweight hook for API calls with shared loading + error state. */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const request = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await api(url, options);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Request failed');
      return json.data;
    } catch (err) {
      const msg = err.message || 'Something went wrong';
      setError(msg);
      throw err; // re-throw so callers can react (e.g. keep modal open)
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(url => request(url), [request]);
  const post = useCallback((url, body) => request(url, {method: 'POST', body: JSON.stringify(body)}), [request]);
  const put = useCallback((url, body) => request(url, {method: 'PUT', body: JSON.stringify(body)}), [request]);
  const del = useCallback(url => request(url, {method: 'DELETE'}), [request]);

  const clearError = useCallback(() => setError(''), []);

  return {loading, error, clearError, request, get, post, put, del};
}
