import {useState, useCallback} from 'react';
import {api} from '../helpers/api';

/**
 * Hook for email operations — supports both Outlook (Microsoft Graph) and Gmail providers.
 * Endpoints are routed per `provider` ('outlook' | 'gmail').
 */
export function useGmailEmails(selectedEmail, provider = 'outlook') {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageToken, setPageToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [labels, setLabels] = useState([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentLabel, setCurrentLabel] = useState('');

  const base = provider === 'gmail' ? '/api/gmail' : '/api/outlook';
  const labelParam = provider === 'gmail' ? 'label' : 'folder';
  const labelsPath = provider === 'gmail' ? 'labels' : 'folders';

  const fetchEmails = useCallback(
    async (query = '', label = '', token = null) => {
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
        if (label) params.set(labelParam, label);
        if (token) params.set('pageToken', token);

        const res = await api(`${base}/emails?${params}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        const messages = result.data?.messages || result.data || [];
        const nextToken = result.data?.nextPageToken || result.pagination?.pageToken || null;

        if (token) {
          setEmails(prev => [...prev, ...messages]);
        } else {
          setEmails(messages);
        }
        setPageToken(nextToken);
        setHasMore(!!nextToken);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedEmail, base, labelParam]
  );

  const fetchMore = useCallback(() => {
    if (pageToken && !loading) {
      fetchEmails(currentQuery, currentLabel, pageToken);
    }
  }, [pageToken, loading, fetchEmails, currentQuery, currentLabel]);

  const fetchMessage = useCallback(
    async messageId => {
      if (!selectedEmail) return;
      try {
        setLoading(true);
        const params = new URLSearchParams({email: selectedEmail});
        const res = await api(`${base}/emails/${messageId}?${params}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
        setSelectedMessage(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedEmail, base]
  );

  const fetchLabels = useCallback(async () => {
    if (!selectedEmail) return;
    try {
      const params = new URLSearchParams({email: selectedEmail});
      const res = await api(`${base}/${labelsPath}?${params}`);
      const result = await res.json();
      if (result.success) setLabels(result.data);
    } catch (err) {
      console.error('Failed to fetch labels/folders:', err);
    }
  }, [selectedEmail, base, labelsPath]);

  return {
    emails,
    loading,
    error,
    hasMore,
    pageToken,
    selectedMessage,
    setSelectedMessage,
    labels,
    fetchEmails,
    fetchMore,
    fetchMessage,
    fetchLabels
  };
}
