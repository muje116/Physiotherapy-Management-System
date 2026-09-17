'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUser, setUser, clearTokens, setTokens } from '@/lib/auth';
import api from '@/lib/api';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  permissions?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getUser();
    if (stored) {
      setUserState(stored);
      api.get('/auth/me').then(res => {
        setUserState(res.data.data);
        setUser(res.data.data);
      }).catch(() => {
        clearTokens();
        setUserState(null);
      });
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, tenantSlug?: string) => {
    const res = await api.post('/auth/login', { email, password, tenantSlug });
    const { accessToken, refreshToken, user: userData } = res.data.data;
    setTokens(accessToken, refreshToken);
    setUser(userData);
    setUserState(userData);
  };

  const logout = () => {
    clearTokens();
    setUserState(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
