import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  onAuthStateChanged
} from 'firebase/auth';
import {auth, api} from '@assets/helpers';
import {history} from '@assets/history';

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {string} role
 * @property {string} organizationId
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {AuthUser|null} user
 * @property {boolean} loading
 * @property {boolean} isAuthenticated
 * @property {Function} login
 * @property {Function} register
 * @property {Function} logout
 * @property {Function} forgotPassword
 * @property {Function} resetPassword
 * @property {Function} refreshUser
 */

/** @type {React.Context<AuthContextValue>} */
const AuthContext = createContext({});

/**
 * Hook to access auth context
 * @returns {AuthContextValue}
 */
export const useAuth = () => useContext(AuthContext);

/**
 * Auth provider component
 * Manages user authentication state and provides auth methods
 */
export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch user profile from backend
   */
  const fetchUserProfile = useCallback(async firebaseUser => {
    if (!firebaseUser) {
      setUser(null);
      return;
    }

    try {
      const response = await api('/api/v1/chatty/auth/me');
      if (response.success && response.data) {
        setUser({
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
          role: response.data.role,
          organizationId: response.data.organizationId,
          firebaseUid: firebaseUser.uid
        });
      } else {
        // User exists in Firebase but not in our backend
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      setLoading(true);
      await fetchUserProfile(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserProfile]);

  /**
   * Log in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      return {success: true};
    } catch (error) {
      let errorMessage = 'Login failed';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      return {success: false, error: errorMessage};
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Register a new user
   * @param {Object} data
   * @param {string} data.email
   * @param {string} data.password
   * @param {string} data.name
   * @param {string} [data.invitationToken]
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const register = useCallback(async ({email, password, name, invitationToken}) => {
    try {
      setLoading(true);

      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Register in backend
      const response = await api('/api/v1/chatty/auth/register', {
        method: 'POST',
        body: {
          email,
          name,
          firebaseUid: userCredential.user.uid,
          invitationToken
        }
      });

      if (!response.success) {
        // Rollback Firebase user if backend registration fails
        await userCredential.user.delete();
        return {success: false, error: response.error || 'Registration failed'};
      }

      return {success: true};
    } catch (error) {
      let errorMessage = 'Registration failed';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already registered';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters.';
      }
      return {success: false, error: errorMessage};
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Log out the current user
   */
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
      history.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  /**
   * Send password reset email
   * @param {string} email
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const forgotPassword = useCallback(async email => {
    try {
      await sendPasswordResetEmail(auth, email);
      return {success: true};
    } catch (error) {
      let errorMessage = 'Failed to send reset email';
      if (error.code === 'auth/user-not-found') {
        // Don't reveal if email exists
        return {success: true};
      }
      return {success: false, error: errorMessage};
    }
  }, []);

  /**
   * Reset password with code
   * @param {string} code
   * @param {string} newPassword
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const resetPassword = useCallback(async (code, newPassword) => {
    try {
      await confirmPasswordReset(auth, code, newPassword);
      return {success: true};
    } catch (error) {
      let errorMessage = 'Failed to reset password';
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Reset link has expired. Please request a new one.';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Invalid reset link. Please request a new one.';
      }
      return {success: false, error: errorMessage};
    }
  }, []);

  /**
   * Refresh user profile from backend
   */
  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      await fetchUserProfile(auth.currentUser);
    }
  }, [fetchUserProfile]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default AuthContext;
