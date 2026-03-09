import {useState, useEffect, useMemo} from 'react';
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import {useStores} from '../context/store-context';

/**
 * Hook that fetches alert data for stores + disputes.
 * Filters results by user's assigned stores (admin sees all).
 */
export function useStoreAlerts() {
  const {user} = useAuth();
  const {stores: allStores} = useStores();
  const isAdmin = user?.role === 'admin';

  const [storeAlerts, setStoreAlerts] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Permitted store domains for filtering
  const permittedDomains = useMemo(() => {
    if (isAdmin) return null; // null = no filtering
    const assigned = user?.assignedStores || [];
    return new Set(allStores.filter(s => assigned.includes(s.id)).map(s => s.shopDomain));
  }, [isAdmin, user?.assignedStores, allStores]);

  const permittedStoreIds = useMemo(() => {
    if (isAdmin) return null;
    return new Set(user?.assignedStores || []);
  }, [isAdmin, user?.assignedStores]);

  useEffect(() => {
    Promise.all([fetchAlerts(), fetchDisputes()]).finally(() => setLoading(false));
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await api('/api/analytics/alerts');
      const result = await res.json();
      if (!result.success) return;

      const parsed = (result.data || []).map(store => {
        const name = store.name || store.shopDomain;
        const alerts = (store.alerts || []).map(a => ({
          type: 'alert',
          message: a.description,
          action: a.action
        }));
        const events = (store.events || []).map(e => ({
          type: 'event',
          message: e.message,
          critical: e.critical,
          date: e.createdAt,
          subjectType: e.subjectType
        }));
        return {name, shopDomain: store.shopDomain, alerts, events};
      });

      setStoreAlerts(parsed);
    } catch {
      // silent
    }
  };

  const fetchDisputes = async () => {
    try {
      const res = await api('/api/analytics/disputes');
      const result = await res.json();
      if (result.success) setDisputes(result.data || []);
    } catch {
      // silent
    }
  };

  // Filter by permitted stores for non-admin
  const filteredAlerts = useMemo(() => {
    if (!permittedDomains) return storeAlerts;
    return storeAlerts.filter(s => permittedDomains.has(s.shopDomain));
  }, [storeAlerts, permittedDomains]);

  const filteredDisputes = useMemo(() => {
    if (!permittedStoreIds) return disputes;
    return disputes.filter(d => permittedStoreIds.has(d.storeId));
  }, [disputes, permittedStoreIds]);

  const totalAlerts = filteredAlerts.reduce(
    (sum, s) => sum + s.alerts.length + s.events.filter(e => e.critical).length,
    0
  );
  const totalEvents = filteredAlerts.reduce((sum, s) => sum + s.events.length, 0);
  const totalDisputes = filteredDisputes.length;

  return {
    storeAlerts: filteredAlerts,
    disputes: filteredDisputes,
    totalAlerts,
    totalEvents,
    totalDisputes,
    loading
  };
}
