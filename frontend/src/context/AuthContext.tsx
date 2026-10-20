import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { authApi, getStoredToken, clearStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  register: (data: { email: string; password: string; full_name: string; phone_number?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch {
      clearStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    // Listen for auth expired event from API client (e.g. 30m inactivity or 401)
    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<User | null> => {
    await authApi.login(email, password);
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      return null;
    }
  };

  const register = async (data: { email: string; password: string; full_name: string; phone_number?: string }) => {
    await authApi.register(data);
    await login(data.email, data.password);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  const isAuthenticated = !!user;
  const isStaff = user?.role === 'staff' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        isStaff,
        isAdmin,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
