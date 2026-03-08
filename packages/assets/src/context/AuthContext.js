import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import PropTypes from 'prop-types';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  token: 'app_token',
  refreshToken: 'app_refresh_token',
  user: 'app_user'
};

function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

AuthProvider.propTypes = {children: PropTypes.node.isRequired};

export function AuthProvider({children}) {
  const [user, setUser] = useState(getStoredUser);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem(STORAGE_KEYS.token) && !!getStoredUser()
  );
  // true while fetching fresh profile — prevents stale permissions flash
  const [syncing, setSyncing] = useState(
    () => !!localStorage.getItem(STORAGE_KEYS.token) && !!getStoredUser()
  );

  const login = useCallback((userData, token, refreshToken) => {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.user);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Sync user profile on mount to pick up permission changes (role, allowedFeatures, etc.)
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem(STORAGE_KEYS.token);
    if (!token) { setSyncing(false); return; }
    fetch('/api/users/me', {headers: getAuthHeaders()})
      .then(r => {
        if (r.status === 401) { logout(); return null; }
        return r.ok ? r.json() : null;
      })
      .then(data => {
        if (data?.success && data.data) {
          localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.data));
          setUser(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [isAuthenticated, logout]);

  // Auto-refresh token before expiry (every 20 hours for 2d tokens)
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(refreshTokenSilent, 20 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider value={{isAuthenticated, user, syncing, login, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

async function refreshTokenSilent() {
  const token = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!token) return;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({refreshToken: token})
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        localStorage.setItem(STORAGE_KEYS.token, data.data.token);
        localStorage.setItem(STORAGE_KEYS.refreshToken, data.data.refreshToken);
      }
    }
  } catch {
    // silent fail — user will be prompted on next 401
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function getAuthHeaders() {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const user = getStoredUser();
  return {
    ...(token ? {Authorization: `Bearer ${token}`} : {}),
    ...(user ? {'x-client-id': user.id} : {})
  };
}

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
}
