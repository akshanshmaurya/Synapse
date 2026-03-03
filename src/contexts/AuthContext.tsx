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
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingComplete: boolean;
  login: (email: string, password: string) => Promise<{ needsOnboarding: boolean }>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkOnboarding: () => Promise<boolean>;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = 'http://localhost:8000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Check for existing session on mount (cookie is sent automatically)
  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      // Check onboarding status using cookie auth
      checkOnboardingOnMount();
    } else {
      setIsLoading(false);
    }
  }, []);

  const checkOnboardingOnMount = async () => {
    try {
      const response = await fetch(`${API_URL}/api/onboarding/status`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOnboardingComplete(data.is_complete);
      } else if (response.status === 401) {
        // Cookie expired/invalid — clear local user data
        localStorage.removeItem('auth_user');
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to check onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOnboarding = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/onboarding/status`, {
        credentials: 'include',
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
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();

    setUser(data.user);
    localStorage.setItem('auth_user', JSON.stringify(data.user));

    // Check onboarding status
    const isComplete = await checkOnboarding();
    return { needsOnboarding: !isComplete };
  };

  const signup = async (email: string, password: string, name?: string) => {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Signup failed');
    }

    const data = await response.json();

    setUser(data.user);
    setOnboardingComplete(false);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Logout even if server call fails
    }
    setUser(null);
    setOnboardingComplete(false);
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
