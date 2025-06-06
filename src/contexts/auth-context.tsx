
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect }from 'react';
import type { User as AppUser } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean; // Reflects if an auth operation (login/logout) is actively processing
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Effect for initial client-side readiness
  useEffect(() => {
    setIsInitialLoadComplete(true);
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
        // Navigation is now handled by the useEffect hook reacting to the 'user' state change
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
    setUser(null); // Update user state
    // Navigation is now handled by the useEffect hook reacting to the 'user' state change
    setIsProcessingAuth(false);
  };

  // Effect for handling navigation based on auth state and path
  useEffect(() => {
    if (!isInitialLoadComplete || isProcessingAuth) {
      // Don't navigate if still initializing client-side or if an auth operation is actively processing.
      // Loaders in the render logic below will handle showing appropriate messages.
      return;
    }

    if (user) { // User is authenticated
      if (pathname === '/login') {
        // Authenticated user on login page, redirect to home
        router.replace('/');
      }
      // If user is authenticated and not on /login, they are on a protected page, no action needed here.
    } else { // User is NOT authenticated
      if (pathname !== '/login') {
        // Unauthenticated user on a protected page, redirect to login
        router.push('/login');
      }
      // If !user and on /login, no action needed here, they are on the correct page.
    }
  }, [user, isInitialLoadComplete, isProcessingAuth, pathname, router]);


  // ----- Render Logic for AuthProvider -----
  if (!isInitialLoadComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Initializing application...</p>
      </div>
    );
  }

  if (isProcessingAuth) {
    // This covers the active processing of login() or logout()
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }
  
  // This specific loader is for when a redirect to /login is expected because
  // initial load is complete, no auth is processing, but user is null and not on /login.
  if (!user && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // If none of the above loading/redirecting conditions are met, render the context provider and children.
  // This means:
  // 1. User is authenticated (and useEffect will ensure they are not on /login).
  // 2. User is not authenticated BUT is currently on the /login page.
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
