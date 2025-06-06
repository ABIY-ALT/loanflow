
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect, useRef }from 'react';
import type { User as AppUser } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean; // Reflects if an auth operation (login/logout) is in progress
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate initial client-side readiness. In a real app, you might check for a persisted session here.
    setIsInitialLoad(false);
  }, []);

  const login = async (emailInput: string, passwordInput?: string): Promise<boolean> => {
    setIsProcessingAuth(true);
    try {
      const emailToCompare = String(emailInput || '').toLowerCase();
      const foundUser = mockUsers.find(
        (u) => u.email.toLowerCase() === emailToCompare && u.password === passwordInput
      );

      if (foundUser) {
        setUser(foundUser); // Update user state
        // Navigation will be handled by useEffect reacting to user state change
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error("Error during login process in AuthContext:", error);
      setUser(null);
      return false;
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const logout = () => {
    setIsProcessingAuth(true);
    setUser(null);
    // Navigation to /login will be handled by useEffect
    setIsProcessingAuth(false);
  };

  useEffect(() => {
    if (isInitialLoad || isProcessingAuth) {
      return; // Don't run navigation logic during initial load or active auth processing
    }

    // User is authenticated
    if (user) {
      if (pathname === '/login') {
        router.replace('/'); // Authenticated user on login page, redirect to home
      }
      // If user is authenticated and not on /login, they are on a protected page, no action needed here.
    }
    // User is NOT authenticated
    else {
      if (pathname !== '/login') {
        router.push('/login'); // Unauthenticated user on a protected page, redirect to login
      }
      // If !user and on /login, no action needed here, they are on the correct page.
    }
  }, [user, isInitialLoad, isProcessingAuth, pathname, router]);


  // ----- Render Logic for AuthProvider -----
  if (isInitialLoad) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Initializing...</p>
      </div>
    );
  }

  if (isProcessingAuth) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  // If not initial load AND not processing auth:
  // Check if a redirect to login is needed (and will be actioned by useEffect)
  if (!user && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // If user is authenticated OR if user is not authenticated but on the login page:
  // Render children with AuthContext.Provider
  // The isLoading prop of the context is isProcessingAuth
  return (
    <AuthContext.Provider value={{ user, isLoading: isProcessingAuth, login, logout }}>
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
