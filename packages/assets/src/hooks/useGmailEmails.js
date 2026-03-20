import {useState, useCallback} from 'react';
import {api} from '../helpers/api';

/**
 * Hook for Gmail email operations
 */
export function useGmailEmails(selectedEmail) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageToken, setPageToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [labels, setLabels] = useState([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentLabel, setCurrentLabel] = useState('');

  const fetchEmails = useCallback(async (query = '', label = '', token = null) => {
    if (!token) {
      setCurrentQuery(query);
      setCurrentLabel(label);
    }
    if (!selectedEmail) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({email: selectedEmail, maxResults: '50'});
      if (query) params.set('q', query);
      if (label) params.set('label', label);
      if (token) params.set('pageToken', token);

      const res = await api(`/api/gmail/emails?${params}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      if (token) {
        setEmails(prev => [...prev, ...result.data]);
      } else {
        setEmails(result.data);
      }
      setPageToken(result.pagination?.pageToken || null);
      setHasMore(!!result.pagination?.pageToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEmail]);

  const fetchMore = useCallback(() => {
    if (pageToken && !loading) {
      fetchEmails(currentQuery, currentLabel, pageToken);
    }
  }, [pageToken, loading, fetchEmails, currentQuery, currentLabel]);

  const fetchMessage = useCallback(async (messageId) => {
    if (!selectedEmail) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({email: selectedEmail});
      const res = await api(`/api/gmail/emails/${messageId}?${params}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setSelectedMessage(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEmail]);

  const fetchLabels = useCallback(async () => {
    if (!selectedEmail) return;
    try {
      const params = new URLSearchParams({email: selectedEmail});
      const res = await api(`/api/gmail/labels?${params}`);
      const result = await res.json();
      if (result.success) setLabels(result.data);
    } catch (err) {
      console.error('Failed to fetch labels:', err);
    }
  }, [selectedEmail]);

  return {
    emails, loading, error, hasMore, pageToken,
    selectedMessage, setSelectedMessage, labels,
    fetchEmails, fetchMore, fetchMessage, fetchLabels
  };
}
