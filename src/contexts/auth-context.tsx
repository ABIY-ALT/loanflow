
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types/loan'; // User type is updated based on JWT
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { loginUser, logoutUser, getCurrentUser } from '@/app/auth/actions'; // Import server actions

interface AuthContextType {
  user: User | null;
  isLoading: boolean; // Reflects combined loading states
  login: (phoneNumber: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoadingUser, setIsInitialLoadingUser] = useState(true); // For fetching user on mount
  const [isProcessingAuthAction, setIsProcessingAuthAction] = useState(false); // For login/logout actions
  const router = useRouter();
  const pathname = usePathname();

  const fetchAndSetCurrentUser = useCallback(async () => {
    setIsInitialLoadingUser(true);
    try {
      const { user: currentUserData } = await getCurrentUser(); // Server action call
      setUser(currentUserData);
    } catch (error) {
      console.error("Error fetching current user:", error);
      setUser(null); // Ensure user is null if fetch fails
    } finally {
      setIsInitialLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    fetchAndSetCurrentUser();
  }, [fetchAndSetCurrentUser]);

  const loginContext = async (phoneNumberInput: string, passwordInput: string = ''): Promise<{ success: boolean; error?: string }> => {
    setIsProcessingAuthAction(true);
    const result = await loginUser(phoneNumberInput, passwordInput); // Call server action
    if (result.success && result.user) {
      setUser(result.user);
    } else {
      setUser(null); // Ensure user is null on login failure
    }
    setIsProcessingAuthAction(false);
    return { success: result.success, error: result.error };
  };

  const logoutContext = async () => {
    setIsProcessingAuthAction(true);
    await logoutUser(); // Call server action
    setUser(null);
    // Navigation will be handled by useEffect below
    setIsProcessingAuthAction(false);
  };

  useEffect(() => {
    if (isInitialLoadingUser || isProcessingAuthAction) {
      return; // Don't navigate while loading or processing
    }

    if (user && pathname === '/login') {
      router.replace('/');
    } else if (!user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, pathname, router, isInitialLoadingUser, isProcessingAuthAction]);

  const isLoadingOverall = isInitialLoadingUser || isProcessingAuthAction;

  if (isInitialLoadingUser && pathname !== '/login') { // Show full screen loader only if not on login and still fetching user
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


  // If initial load is complete, not processing auth, but user is not set AND we are on a protected page (and not initial load for user)
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
