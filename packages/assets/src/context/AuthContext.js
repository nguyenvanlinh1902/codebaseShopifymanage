import React, {createContext, useContext, useState, useEffect, useCallback} from 'react';

const AuthContext = createContext(null);

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_REFRESH_TOKEN_KEY = 'auth_refresh_token';
const AUTH_USER_KEY = 'auth_user';

export function AuthProvider({children}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password})
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Login failed');
    }

    const userData = {
      id: result.data.id,
      username: result.data.username,
      displayName: result.data.displayName,
      role: result.data.role
    };
    localStorage.setItem(AUTH_TOKEN_KEY, result.data.token);
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, result.data.refreshToken);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);

    return result;
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userId = user?.id;

    if (token && userId) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-client-id': userId
          }
        });
      } catch (e) {
        // Ignore - still clear local state
      }
    }

    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
    setIsAuthenticated(false);
  }, [user]);

  return (
    <AuthContext.Provider value={{isAuthenticated, user, loading, login, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function getAuthHeaders() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userData = localStorage.getItem(AUTH_USER_KEY);
  const userId = userData ? JSON.parse(userData).id : null;
  if (!token || !userId) return {};
  return {
    Authorization: `Bearer ${token}`,
    'x-client-id': userId
  };
}

export function getRefreshToken() {
  return localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
}

export function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function saveTokens(token, refreshToken) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
}
