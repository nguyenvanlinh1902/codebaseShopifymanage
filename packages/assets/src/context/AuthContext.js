import React, {createContext, useContext} from 'react';

const AuthContext = createContext(null);

const DEFAULT_USER = {
  id: 'default-user',
  username: 'admin',
  displayName: 'Admin',
  role: 'admin'
};

export function AuthProvider({children}) {
  return (
    <AuthContext.Provider value={{isAuthenticated: true, user: DEFAULT_USER, loading: false}}>
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
    'x-client-id': DEFAULT_USER.id
  };
}

export function getRefreshToken() {
  return null;
}

export function clearAuth() {}

export function saveTokens() {}
