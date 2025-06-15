
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types/loan'; // Updated User type
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { loginUser as serverLoginUser, logoutUser as serverLogoutUser, getCurrentUser as serverGetCurrentUser } from '@/app/auth/actions';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phoneNumber: string, password?: string) => Promise<{ success: boolean; error?: string; user?: User }>; // Return user on login
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
      const { user: currentUserData } = await serverGetCurrentUser();
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

  const loginContext = async (phoneNumberInput: string, passwordInput: string = ''): Promise<{ success: boolean; error?: string; user?: User }> => {
    setIsProcessingAuthAction(true);
    const result = await serverLoginUser(phoneNumberInput, passwordInput);
    if (result.success && result.user) {
      setUser(result.user);
    } else {
      setUser(null); // Ensure user is cleared on login failure
    }
    setIsProcessingAuthAction(false);
    return result; // Return the full result including user object
  };

  const logoutContext = async () => {
    setIsProcessingAuthAction(true);
    await serverLogoutUser();
    setUser(null);
    setIsProcessingAuthAction(false);
    // router.push('/login'); // Explicitly redirect after logout, though useEffect will also catch this
  };

  useEffect(() => {
    if (isInitialLoadingUser || isProcessingAuthAction) {
      return; // Don't run navigation logic while loading or processing
    }

    // If user is loaded and is on login page, redirect to dashboard
    if (user && pathname === '/login') {
      router.replace('/');
    } 
    // If no user and not on login page, redirect to login
    else if (!user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [user, pathname, router, isInitialLoadingUser, isProcessingAuthAction]);

  const isLoadingOverall = isInitialLoadingUser || isProcessingAuthAction;

  // Show a global loader if we're in a critical loading phase and not on the login page already
  if (isLoadingOverall && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          {isInitialLoadingUser ? "Loading user session..." : "Processing authentication..."}
        </p>
      </div>
    );
  }
  
  // If still loading but on login page, or if redirecting, let it render children (which might be the login page or null during redirect flicker)
  // This ensures login page can be displayed even during initial load.
  if (isLoadingOverall && pathname === '/login') {
     // Render children (login page) but provide context value
  } else if (!isInitialLoadingUser && !isProcessingAuthAction && !user && pathname !== '/login') {
    // This case should be caught by the useEffect redirect, but as a fallback screen:
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
