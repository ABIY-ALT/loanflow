
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const handleAuthRedirects = useCallback(() => {
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
  }, [user, pathname, router]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { user: currentUser } = await serverGetCurrentUser();
        setUser(currentUser);
      } catch (e) {
        console.error("Failed to fetch current user", e);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      handleAuthRedirects();
    }
  }, [user, isLoading, handleAuthRedirects]);

  const loginContext = async (phoneNumberInput: string, passwordInput: string = ''): Promise<{ success: boolean; error?: string; user?: User }> => {
    setIsLoading(true);
    const result = await serverLoginUser(phoneNumberInput, passwordInput);
    if (result.success && result.user) {
      setUser(result.user);
    } else {
      setUser(null);
    }
    setIsLoading(false);
    return result;
  };
  
  const logoutContext = useCallback(async () => {
    setIsLoading(true);
    await serverLogoutUser();
    setUser(null);
    router.replace('/login');
    setIsLoading(false);
  }, [router]);

  const isAuthPage = pathname === '/login' || pathname === '/force-password-change';

  if (isLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  // If we are not loading, but we are on a protected page without a user,
  // show a loading screen while the redirect effect kicks in.
  if (!user && !isAuthPage) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">Redirecting to login...</p>
        </div>
      );
  }

  // If user needs to change password but is not on the correct page, show loading while redirecting.
  if (user && !user.isPasswordChanged && pathname !== '/force-password-change') {
       return (
        <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Redirecting to password change...</p>
        </div>
      );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login: loginContext, logout: logoutContext }}>
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
