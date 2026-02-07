import {useState, useEffect, useCallback} from 'react';
import {fetchApi} from '../helpers/fetchApi';

export function useGoogleAuth() {
  const [authenticated, setAuthenticated] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchApi(`/api/google/status`);
      const result = await response.json();

      if (result.success && result.data.authenticated) {
        setAuthenticated(true);
        setGoogleEmail(result.data.googleEmail || '');
      } else {
        setAuthenticated(false);
        setGoogleEmail('');
      }
    } catch (err) {
      setError('Failed to check authentication status');
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const startAuth = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetchApi(`/api/google/auth-url`);
        const result = await response.json();
        if (!result.success) {
          setError(result.error || 'Failed to get authorization URL');
          reject(new Error(result.error || 'Failed to get authorization URL'));
          return;
        }

        // Open centered popup window
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          result.data.authUrl,
          'google-auth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        // Listen for message from popup (no strict origin check — popup may be on a different origin)
        const handleMessage = event => {
          if (event.data?.type === 'google-auth-callback') {
            window.removeEventListener('message', handleMessage);
            clearInterval(checkClosed);
            if (event.data.success) {
              setAuthenticated(true);
              setGoogleEmail(event.data.googleEmail || '');
              resolve({googleEmail: event.data.googleEmail || ''});
            } else {
              setError(event.data.error || 'Failed to connect Google account');
              reject(new Error(event.data.error || 'Failed to connect Google account'));
            }
          }
        };
        window.addEventListener('message', handleMessage);

        // Cleanup if popup is closed without completing
        const checkClosed = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            reject(new Error('Authentication window was closed'));
          }
        }, 500);
      } catch (err) {
        setError('Failed to start authorization');
        reject(err);
      }
    });
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const response = await fetchApi('/api/google/disconnect', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({})
      });
      const result = await response.json();
      if (result.success) {
        setAuthenticated(false);
        setGoogleEmail('');
      }
    } catch (err) {
      setError('Failed to disconnect');
    }
  }, []);

  const startAuthForNewAccount = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await fetchApi(`/api/google/auth-url?mode=temp`);
        const result = await response.json();
        if (!result.success) {
          reject(new Error(result.error || 'Failed to get authorization URL'));
          return;
        }

        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          result.data.authUrl,
          'google-auth-temp',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        const handleMessage = event => {
          if (event.data?.type === 'google-auth-temp') {
            window.removeEventListener('message', handleMessage);
            clearInterval(checkClosed);
            if (event.data.success) {
              resolve({
                accessToken: event.data.accessToken,
                refreshToken: event.data.refreshToken,
                googleEmail: event.data.googleEmail
              });
            } else {
              reject(new Error(event.data.error || 'Failed to authenticate'));
            }
          }
        };
        window.addEventListener('message', handleMessage);

        const checkClosed = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', handleMessage);
            reject(new Error('Authentication window was closed'));
          }
        }, 500);
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  const getPickerToken = useCallback(async () => {
    try {
      const response = await fetchApi(`/api/google/picker-token`);
      const result = await response.json();
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error || 'Failed to get picker token');
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  return {
    authenticated,
    googleEmail,
    loading,
    error,
    setError,
    startAuth,
    startAuthForNewAccount,
    disconnect,
    getPickerToken,
    checkAuth
  };
}
