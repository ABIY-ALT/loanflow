
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


  const loginContext = async (phoneNumberInput: string, passwordInput: string = ''): Promise<{ success: boolean; error?: string; user?: User }> => {
    setIsLoading(true);
    const result = await serverLoginUser(phoneNumberInput, passwordInput);
    
    if (result.success && result.user) {
      setUser(result.user);
      // The middleware will handle the redirect after the state is set and page reloads
      if (!result.user.isPasswordChanged) {
        router.push('/force-password-change');
      } else {
        router.push('/');
      }
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
    router.push('/login');
    setIsLoading(false);
  }, [router]);

  const isPublicPage = pathname === '/login' || pathname === '/force-password-change';

  // While checking the session, show a loader on all pages
  if (isLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading session...</p>
      </div>
    );
  }
  
  // If loading is finished and we're on a public page, it's safe to render (middleware handles redirects away from here if logged in)
  if (isPublicPage) {
     return (
        <AuthContext.Provider value={{ user, isLoading, login: loginContext, logout: logoutContext }}>
            {children}
        </AuthContext.Provider>
    );
  }

  // If loading is finished, not a public page, and no user, show nothing/loader until middleware redirects
  if (!user && !isPublicPage) {
     return (
       <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Verifying session...</p>
      </div>
    );
  }


  // Otherwise, we have a user on a protected page, so render the app
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
