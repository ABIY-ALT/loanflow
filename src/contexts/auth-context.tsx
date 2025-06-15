
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@/types/loan';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { loginUser as serverLoginUser, logoutUser as serverLogoutUser, getCurrentUser as serverGetCurrentUser, refreshAccessToken } from '@/app/auth/actions';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phoneNumber: string, password?: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 12 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoadingUser, setIsInitialLoadingUser] = useState(true);
  const [isProcessingAuthAction, setIsProcessingAuthAction] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const refreshTokenIntervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const clearRefreshTokenInterval = useCallback(() => {
    if (refreshTokenIntervalIdRef.current) {
      clearInterval(refreshTokenIntervalIdRef.current);
      refreshTokenIntervalIdRef.current = null;
      console.log('Refresh token interval cleared.');
    }
  }, []);

  const logoutContext = useCallback(async (showToast = true, toastMessage?: string) => {
    setIsProcessingAuthAction(true);
    clearRefreshTokenInterval();
    await serverLogoutUser();
    setUser(null);
    setIsProcessingAuthAction(false);
    if (showToast) {
      toast({
        title: toastMessage ? 'Session Ended' : 'Signed Out',
        description: toastMessage || 'You have been successfully signed out.',
        variant: toastMessage ? 'destructive' : 'default',
      });
    }
    // Navigation to /login is handled by the other useEffect
  }, [clearRefreshTokenInterval, toast]);

  const fetchAndSetCurrentUser = useCallback(async () => {
    setIsInitialLoadingUser(true);
    try {
      const { user: currentUserData } = await serverGetCurrentUser();
      setUser(currentUserData);
      if (!currentUserData) { // If no user, ensure interval is cleared
        clearRefreshTokenInterval();
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
      setUser(null);
      clearRefreshTokenInterval();
    } finally {
      setIsInitialLoadingUser(false);
    }
  }, [clearRefreshTokenInterval]);

  useEffect(() => {
    fetchAndSetCurrentUser();
  }, [fetchAndSetCurrentUser]);

  const loginContext = async (phoneNumberInput: string, passwordInput: string = ''): Promise<{ success: boolean; error?: string; user?: User }> => {
    setIsProcessingAuthAction(true);
    const result = await serverLoginUser(phoneNumberInput, passwordInput);
    if (result.success && result.user) {
      setUser(result.user);
    } else {
      setUser(null);
      clearRefreshTokenInterval();
    }
    setIsProcessingAuthAction(false);
    return result;
  };

  useEffect(() => {
    if (user && !isProcessingAuthAction) {
      const handleAutoRefreshToken = async () => {
        console.log('Attempting automatic token refresh...');
        try {
          const response = await refreshAccessToken()
          if (!response.success) {
            await logoutContext(true, 'Your session has expired. Please log in again.');
          }
          console.log('Token refresh successful via API route.');
          // New tokens are set in HttpOnly cookies by the API route.
          // Subsequent calls to getCurrentUser (e.g., on page navigation or by fetchAndSetCurrentUser) will pick them up.
        } catch (error: any) {
          await logoutContext(true, 'Your session has expired. Please log in again.');
        }
      };

      clearRefreshTokenInterval(); // Clear any existing interval
      refreshTokenIntervalIdRef.current = setInterval(handleAutoRefreshToken, REFRESH_INTERVAL_MS);
      console.log('Refresh token interval started.');

    } else if (!user) { // If user becomes null (e.g. after logout or initial load with no session)
      clearRefreshTokenInterval();
    }

    return () => { // Cleanup function for when the component unmounts or dependencies change
      clearRefreshTokenInterval();
    };
  }, [user, isProcessingAuthAction, clearRefreshTokenInterval, logoutContext, toast]);


  useEffect(() => {
    if (isInitialLoadingUser || isProcessingAuthAction) {
      return;
    }
    if (user && pathname === '/login') {
      router.replace('/');
    } else if (!user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [user, pathname, router, isInitialLoadingUser, isProcessingAuthAction]);

  const isLoadingOverall = isInitialLoadingUser || isProcessingAuthAction;

  if (isLoadingOverall && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          {isInitialLoadingUser ? "Loading user session..." : "Processing authentication..."}
        </p>
      </div>
    );
  } else if (!isInitialLoadingUser && !isProcessingAuthAction && !user && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading: isLoadingOverall, login: loginContext, logout: () => logoutContext(true) }}>
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
