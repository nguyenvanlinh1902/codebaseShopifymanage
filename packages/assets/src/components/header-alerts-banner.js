import {useState, useEffect} from 'react';
import {api} from '../helpers/api';

/**
 * Hook that fetches full alert data for all stores + disputes.
 * Returns store alerts with full details (messages, actions, events, disputes).
 */
export function useStoreAlerts() {
  const [storeAlerts, setStoreAlerts] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const totalAlerts = storeAlerts.reduce(
    (sum, s) => sum + s.alerts.length + s.events.filter(e => e.critical).length,
    0
  );
  const totalEvents = storeAlerts.reduce((sum, s) => sum + s.events.length, 0);
  const totalDisputes = disputes.length;

  return {storeAlerts, disputes, totalAlerts, totalEvents, totalDisputes, loading};
}
