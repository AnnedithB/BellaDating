import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, tokenStorage } from '../services/api';
import { disconnectSocket } from '../services/socket';

// Dynamically import call service and IAP (they may not be available in Expo Go)
let disconnectCallSocket = null;
let endIAP = null;

try {
  const callService = require('../services/callService');
  disconnectCallSocket = callService.disconnectCallSocket;
} catch (error) {
  // Call service not available
}

try {
  const iapService = require('../services/iap');
  endIAP = iapService.endIAP;
} catch (error) {
  // IAP service not available
}

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const [justRegistered, setJustRegistered] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      const token = await tokenStorage.getToken();

      if (token) {
        // Always fetch fresh user data from backend to ensure we have latest verification status
        // Don't rely on localStorage - always get the truth from the server
        try {
          const userData = await authAPI.getCurrentUser();
          
          // Update localStorage with fresh data from backend
          await tokenStorage.setUser(userData);
          
          setUser(userData);
          setIsAuthenticated(true);
        } catch (err) {
          // Token invalid or expired, clear it
          await tokenStorage.clear();
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      setIsLoading(true);

      const result = await authAPI.login(email, password);

      // Always fetch fresh user data from backend after login to ensure we have latest verification status
      try {
        const freshUserData = await authAPI.getCurrentUser();
        await tokenStorage.setUser(freshUserData);
        setUser(freshUserData);
        setIsAuthenticated(true);
        return { success: true, user: freshUserData };
      } catch (fetchError) {
        // Fallback to login response if getCurrentUser fails
        console.warn('Failed to fetch fresh user data after login, using login response:', fetchError);
        setUser(result.user);
        setIsAuthenticated(true);
        return { success: true, user: result.user };
      }
    } catch (err) {
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      setIsLoading(true);

      const result = await authAPI.register(userData);

      // Always fetch fresh user data from backend after registration to ensure we have latest verification status
      try {
        const freshUserData = await authAPI.getCurrentUser();
        await tokenStorage.setUser(freshUserData);
        setUser(freshUserData);
        setIsAuthenticated(true);
        setJustRegistered(true); // Mark that user just registered
        return { success: true, user: freshUserData };
      } catch (fetchError) {
        // Fallback to register response if getCurrentUser fails
        console.warn('Failed to fetch fresh user data after registration, using register response:', fetchError);
        setUser(result.user);
        setIsAuthenticated(true);
        setJustRegistered(true);
        return { success: true, user: result.user };
      }
    } catch (err) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Disconnect all connections
      try {
        disconnectSocket();
      } catch (socketError) {
        console.error('Error disconnecting socket:', socketError);
      }
      
      // Disconnect call socket if available
      try {
        if (disconnectCallSocket) {
          disconnectCallSocket();
        }
      } catch (callError) {
        console.error('Error disconnecting call socket:', callError);
      }
      
      // End IAP connection if available
      try {
        if (endIAP) {
          await endIAP();
        }
      } catch (iapError) {
        console.error('Error ending IAP connection:', iapError);
      }
      
      // Call logout API
      try {
        await authAPI.logout();
      } catch (apiError) {
        console.error('Logout API error:', apiError);
        // Continue with logout even if API call fails
      }
      
      // Clear subscription-related localStorage items
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('stripe_checkout_session_id');
          localStorage.removeItem('subscription_verification_complete');
        } catch (e) {
          console.error('Error clearing subscription localStorage:', e);
        }
      }
      
      // Clear all auth state
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      
    } catch (err) {
      console.error('Logout error:', err);
      // Still clear state even if there's an error
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (userData) => {
    setUser((prev) => ({ ...prev, ...userData }));
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    error,
    justRegistered,
    login,
    register,
    logout,
    updateUser,
    clearError,
    checkAuthState,
    clearJustRegistered: () => setJustRegistered(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
