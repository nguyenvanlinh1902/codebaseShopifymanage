import {useState, useEffect} from 'react';
import {api} from '../helpers/api';

/**
 * Hook that fetches full alert data for all stores.
 * Returns store alerts with full details (messages, actions, events).
 */
export function useStoreAlerts() {
  const [storeAlerts, setStoreAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
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
    } finally {
      setLoading(false);
    }
  };

  // Total counts for badge
  const totalAlerts = storeAlerts.reduce(
    (sum, s) => sum + s.alerts.length + s.events.filter(e => e.critical).length,
    0
  );
  const totalEvents = storeAlerts.reduce((sum, s) => sum + s.events.length, 0);

  return {storeAlerts, totalAlerts, totalEvents, loading};
}
