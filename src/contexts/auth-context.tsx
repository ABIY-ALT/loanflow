
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@/types/loan';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { loginUser as serverLoginUser, logoutUser as serverLogoutUser, getCurrentUser as serverGetCurrentUser } from '@/app/auth/actions';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phoneNumber: string, password?: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const publicPaths = ['/login', '/force-password-change', '/track-loan'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const sessionFetchRequestIdRef = useRef(0);
  const router = useRouter();
  const pathname = usePathname();

  const fetchAndSetCurrentUser = useCallback(async () => {
    const requestId = ++sessionFetchRequestIdRef.current;
    setIsInitialLoading(true);
    try {
      const { user: currentUserData } = await serverGetCurrentUser();
      if (requestId !== sessionFetchRequestIdRef.current) return null;
      setUser(currentUserData);
      return currentUserData;
    } catch (error) {
      console.error("Error fetching current user:", error);
      if (requestId !== sessionFetchRequestIdRef.current) return null;
      setUser(null);
      return null;
    } finally {
      if (requestId !== sessionFetchRequestIdRef.current) return;
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndSetCurrentUser();
  }, [fetchAndSetCurrentUser]);

  const loginContext = async (phoneNumberInput: string, passwordInput: string = ''): Promise<{ success: boolean; error?: string; user?: User }> => {
    setIsProcessingAuth(true);
    const result = await serverLoginUser(phoneNumberInput, passwordInput);
    if (result.success && result.user) {
      await fetchAndSetCurrentUser();
    } else {
      setUser(null);
    }
    setIsProcessingAuth(false);
    return result;
  };

  const logoutContext = useCallback(async () => {
    setIsProcessingAuth(true);
    await serverLogoutUser();
    setUser(null);
    router.replace('/login');
    setIsProcessingAuth(false);
  }, [router]);

  useEffect(() => {
    if (isInitialLoading) {
      return;
    }

    const isPublicPage = publicPaths.some(p => pathname.startsWith(p));
    const isAuthPage = pathname === '/login' || pathname === '/force-password-change';
    const isPasswordChangePage = pathname === '/force-password-change';

    if (!user && !isPublicPage) {
      router.replace('/login');
    } else if (user) {
      if (!user.isPasswordChanged && !isPasswordChangePage) {
        router.replace('/force-password-change');
      } else if (user.isPasswordChanged && isAuthPage) {
        router.replace('/');
      }
    }
  }, [user, pathname, router, isInitialLoading]);

  const isLoadingOverall = isInitialLoading || isProcessingAuth;
  const isPublicPage = publicPaths.some(p => pathname.startsWith(p));

  // While initially loading, or if we are processing a login/logout, show a full-page loader.
  if (isLoadingOverall) {
     return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          {isInitialLoading ? "Loading user session..." : "Processing authentication..."}
        </p>
      </div>
    );
  }
  
  // If we have finished loading but there's no user, and we are not on an auth-exempt page, show a redirecting state.
  if (!user && !isPublicPage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // If user must change password and is not on the correct page, redirect.
  if (user && !user.isPasswordChanged && pathname !== '/force-password-change') {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Redirecting to password change...</p>
        </div>
      );
  }

  // Render children if all checks pass
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
