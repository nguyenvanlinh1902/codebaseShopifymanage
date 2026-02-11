import React, {createContext, useContext, useState, useCallback} from 'react';

const AuthContext = createContext(null);
const AUTH_KEY = 'sheetbridge_auth';

const ADMIN_USER = {
  id: 'default-user',
  username: 'admin',
  displayName: 'Admin',
  role: 'admin'
};

export function AuthProvider({children}) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(AUTH_KEY) === 'true'
  );

  const login = useCallback(() => {
    localStorage.setItem(AUTH_KEY, 'true');
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{isAuthenticated, user: ADMIN_USER, loading: false, login, logout}}
    >
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
  return {
    'x-client-id': ADMIN_USER.id
  };
}

export function getRefreshToken() {
  return null;
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function saveTokens() {}
