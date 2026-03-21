import {useState, useCallback} from 'react';
import {api} from '../helpers/api';

/**
 * Hook for Discord config and filter rules management
 * Watch is fully automatic — no manual management needed
 */
export function useDiscordConfig() {
  const [config, setConfig] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/discord/config');
      const result = await res.json();
      if (result.success) setConfig(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async data => {
    try {
      setLoading(true);
      const res = await api('/api/discord/config', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setConfig(result.data);
      return result.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const testConnection = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/api/discord/test', {method: 'POST'});
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const res = await api('/api/email-rules/rules');
      const result = await res.json();
      if (result.success) setRules(result.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const createRule = useCallback(
    async data => {
      const res = await api('/api/email-rules/rules', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      await fetchRules();
      return result.data;
    },
    [fetchRules]
  );

  const updateRule = useCallback(
    async (id, data) => {
      const res = await api(`/api/email-rules/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      await fetchRules();
      return result.data;
    },
    [fetchRules]
  );

  const deleteRule = useCallback(
    async id => {
      const res = await api(`/api/email-rules/rules/${id}`, {method: 'DELETE'});
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      await fetchRules();
    },
    [fetchRules]
  );

  const toggleRule = useCallback(
    async id => {
      const res = await api(`/api/email-rules/rules/${id}/toggle`, {method: 'POST'});
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      await fetchRules();
      return result.data;
    },
    [fetchRules]
  );

  return {
    config,
    rules,
    loading,
    error,
    setError,
    fetchConfig,
    saveConfig,
    testConnection,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule
  };
}
