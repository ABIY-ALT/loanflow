
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types/loan';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { loginUser, logoutUser, getCurrentUser } from '@/app/auth/actions';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phoneNumber: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoadingUser, setIsInitialLoadingUser] = useState(true);
  const [isProcessingAuthAction, setIsProcessingAuthAction] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchAndSetCurrentUser = useCallback(async () => {
    setIsInitialLoadingUser(true);
    try {
      const { user: currentUserData } = await getCurrentUser();
      setUser(currentUserData);
    } catch (error) {
      console.error("Error fetching current user:", error);
      setUser(null);
    } finally {
      setIsInitialLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    fetchAndSetCurrentUser();
  }, [fetchAndSetCurrentUser]);

  const loginContext = async (phoneNumberInput: string, passwordInput: string = ''): Promise<{ success: boolean; error?: string }> => {
    setIsProcessingAuthAction(true);
    const result = await loginUser(phoneNumberInput, passwordInput);
    if (result.success && result.user) {
      setUser(result.user);
    } else {
      setUser(null);
    }
    setIsProcessingAuthAction(false);
    return { success: result.success, error: result.error };
  };

  const logoutContext = async () => {
    setIsProcessingAuthAction(true);
    await logoutUser();
    setUser(null);
    setIsProcessingAuthAction(false);
  };

  useEffect(() => {
    if (isInitialLoadingUser || isProcessingAuthAction) {
      return;
    }

    if (user && pathname === '/login') {
      router.replace('/');
    } else if (!user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, pathname, router, isInitialLoadingUser, isProcessingAuthAction]);

  const isLoadingOverall = isInitialLoadingUser || isProcessingAuthAction;

  if (isInitialLoadingUser && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading user session...</p>
      </div>
    );
  }
   if (isProcessingAuthAction) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  if (!isInitialLoadingUser && !user && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading: isLoadingOverall, login: loginContext, logout: logoutContext }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
