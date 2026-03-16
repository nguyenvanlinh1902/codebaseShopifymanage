import { useState, useCallback } from 'react';
import { api } from '../helpers/api';

const BASE = '/api/tracking-status';

async function callApi(url, options = {}) {
  const res = await api(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json;
}

/**
 * Hook for 17TRACK tracking status API operations.
 * Provides CRUD for API keys, status queries, and actions.
 */
export function useTrackingStatusApi() {
  // API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(false);

  // Statuses
  const [statuses, setStatuses] = useState([]);
  const [statusesLoading, setStatusesLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Actions
  const [actionLoading, setActionLoading] = useState(false);

  // ============ API KEYS ============

  const fetchApiKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const json = await callApi(`${BASE}/keys`);
      setApiKeys(json.data);
      return json.data;
    } finally {
      setKeysLoading(false);
    }
  }, []);

  const createApiKey = useCallback(async (keyData) => {
    const json = await callApi(`${BASE}/keys`, {
      method: 'POST',
      body: JSON.stringify(keyData)
    });
    return json.data;
  }, []);

  const updateApiKey = useCallback(async (id, updates) => {
    await callApi(`${BASE}/keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }, []);

  const deleteApiKey = useCallback(async (id) => {
    await callApi(`${BASE}/keys/${id}`, { method: 'DELETE' });
  }, []);

  const syncKeyQuota = useCallback(async (id) => {
    const json = await callApi(`${BASE}/keys/${id}/sync-quota`, { method: 'POST' });
    return json.data;
  }, []);

  const syncAllKeysQuota = useCallback(async () => {
    const json = await callApi(`${BASE}/keys/sync-all`, { method: 'POST' });
    return json.data;
  }, []);

  // ============ STATUSES ============

  const [statusPagination, setStatusPagination] = useState({page: 1, perPage: 10, total: 0, totalPages: 1});

  const fetchStatuses = useCallback(async (params = {}) => {
    setStatusesLoading(true);
    try {
      const qs = new URLSearchParams(params).toString();
      const json = await callApi(`${BASE}/statuses?${qs}`);
      setStatuses(json.data);
      if (json.pagination) setStatusPagination(json.pagination);
      return json;
    } finally {
      setStatusesLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const json = await callApi(`${BASE}/stats`);
      setStats(json.data);
      return json.data;
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ============ ACTIONS ============

  const triggerRecheck = useCallback(async (selectedStatuses) => {
    setActionLoading(true);
    try {
      // Send statuses as query param (primary) + body (fallback) for reliability
      const qs = selectedStatuses?.length
        ? `?statuses=${selectedStatuses.join(',')}`
        : '';
      const json = await callApi(`${BASE}/trigger${qs}`, {
        method: 'POST',
        body: JSON.stringify({ statuses: selectedStatuses?.length ? selectedStatuses : null })
      });
      return json.data;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const clearInvalid = useCallback(async () => {
    setActionLoading(true);
    try {
      const json = await callApi(`${BASE}/statuses/clear-invalid`, { method: 'POST' });
      return json.data;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const checkOrders = useCallback(async (body) => {
    const json = await callApi(`${BASE}/check-orders`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return json.data;
  }, []);

  const checkSingleTracking = useCallback(async (body) => {
    const json = await callApi(`${BASE}/check-single`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return json;
  }, []);

  const hideTracking = useCallback(async (id) => {
    await callApi(`${BASE}/statuses/${id}/hide`, { method: 'POST' });
  }, []);

  const unhideTracking = useCallback(async (id) => {
    await callApi(`${BASE}/statuses/${id}/unhide`, { method: 'POST' });
  }, []);

  return {
    // API Keys
    apiKeys, keysLoading, fetchApiKeys,
    createApiKey, updateApiKey, deleteApiKey,
    syncKeyQuota, syncAllKeysQuota,

    // Statuses
    statuses, statusesLoading, statusPagination, fetchStatuses,
    stats, statsLoading, fetchStats,

    // Actions
    actionLoading, triggerRecheck, clearInvalid,
    checkOrders, checkSingleTracking,
    hideTracking, unhideTracking
  };
}
