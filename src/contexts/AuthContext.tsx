import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  onboarding_complete?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingComplete: boolean;
  login: (email: string, password: string) => Promise<{ needsOnboarding: boolean }>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  checkOnboarding: () => Promise<boolean>;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = 'http://localhost:8000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Check onboarding status
      checkOnboardingWithToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const checkOnboardingWithToken = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/onboarding/status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOnboardingComplete(data.is_complete);
      }
    } catch (error) {
      console.error('Failed to check onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOnboarding = async (): Promise<boolean> => {
    if (!token) return false;
    try {
      const response = await fetch(`${API_URL}/api/onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOnboardingComplete(data.is_complete);
        return data.is_complete;
      }
    } catch (error) {
      console.error('Failed to check onboarding:', error);
    }
    return false;
  };

  const login = async (email: string, password: string): Promise<{ needsOnboarding: boolean }> => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();

    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));

    // Check onboarding status
    const isComplete = await checkOnboardingWithTokenAndReturn(data.access_token);
    return { needsOnboarding: !isComplete };
  };

  const checkOnboardingWithTokenAndReturn = async (authToken: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/onboarding/status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOnboardingComplete(data.is_complete);
        return data.is_complete;
      }
    } catch (error) {
      console.error('Failed to check onboarding:', error);
    }
    return false;
  };

  const signup = async (email: string, password: string, name?: string) => {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Signup failed');
    }

    const data = await response.json();

    setToken(data.access_token);
    setUser(data.user);
    setOnboardingComplete(false); // New users need onboarding
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOnboardingComplete(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        onboardingComplete,
        login,
        signup,
        logout,
        checkOnboarding,
        completeOnboarding: () => setOnboardingComplete(true),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
