import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import type { User, UserRole } from '../types';

// Roles permitted to access the administrative portal. Students and parents
// share the same login endpoint (for the application-status portal) but must
// never be allowed into the admin dashboard.
export const ADMIN_ROLES: UserRole[] = ['ADMIN', 'STAFF', 'TEACHER'];

export const isAdminRole = (role?: UserRole): boolean =>
  !!role && ADMIN_ROLES.includes(role);

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      authService.setToken(storedToken);
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const userData = await authService.getMe();
      if (!isAdminRole(userData.role)) {
        // A non-admin (e.g. student/parent) token must not grant portal access.
        localStorage.removeItem('token');
        authService.setToken(null);
        setToken(null);
        setUser(null);
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);

    if (!isAdminRole(response.user.role)) {
      // Reject students/parents before storing any session state.
      authService.setToken(null);
      throw new Error('This portal is for staff only. Please use the application status portal to view your application.');
    }

    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('token', response.token);
    authService.setToken(response.token);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    authService.setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};





