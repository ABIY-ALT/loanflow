
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types/loan';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { loginUser as serverLoginUser, logoutUser as serverLogoutUser, getCurrentUser as serverGetCurrentUser } from '@/app/auth/actions';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phoneNumber: string, password?: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoadingUser, setIsInitialLoadingUser] = useState(true);
  const [isProcessingAuthAction, setIsProcessingAuthAction] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

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
      setUser(null);
    }
    setIsProcessingAuthAction(false);
    return result;
  };
  
  const logoutContext = useCallback(async () => {
    setIsProcessingAuthAction(true);
    await serverLogoutUser();
    setUser(null);
    // After state is cleared, force redirect to login
    router.replace('/login');
    setIsProcessingAuthAction(false);
  }, [router]);


  useEffect(() => {
    if (isInitialLoadingUser) {
      return;
    }
  
    const isAuthPage = pathname === '/login' || pathname === '/force-password-change';
  
    if (!user && !isAuthPage) {
      router.replace('/login');
    } else if (user) {
      if (!user.isPasswordChanged && pathname !== '/force-password-change') {
        router.replace('/force-password-change');
      } else if (user.isPasswordChanged && isAuthPage) {
        router.replace('/');
      }
    }
  }, [user, pathname, router, isInitialLoadingUser]);


  const isLoadingOverall = isInitialLoadingUser || isProcessingAuthAction;
  
  // These pages have their own layout and loading states.
  if (pathname === '/login' || pathname === '/force-password-change') {
      return (
        <AuthContext.Provider value={{ user, isLoading: isLoadingOverall, login: loginContext, logout: logoutContext }}>
            {children}
        </AuthContext.Provider>
    );
  }

  // If still loading, or if user is null and we are not on an auth page, show a global loading screen.
  // This prevents the main app layout from flashing before a redirect.
  if (isLoadingOverall || !user) {
     return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">
          {isInitialLoadingUser ? "Loading user session..." : (isProcessingAuthAction ? "Processing authentication..." : "Redirecting...")}
        </p>
      </div>
    );
  }
  
  // If user needs to change password but is trying to access other pages, keep showing loading screen until redirect happens.
  if (!user.isPasswordChanged) {
     return (
        <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Redirecting to password change...</p>
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
