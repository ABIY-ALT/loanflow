
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { User as AppUser } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean; // True ONLY during active login/logout process
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false); // For active login/logout
  const [isClientSideReady, setIsClientSideReady] = useState(false); // For initial mount/hydration
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // This effect runs once on mount to indicate client is ready
    setIsClientSideReady(true);
  }, []);

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsProcessingAuth(true);
    try {
      // Simulate finding user
      const foundUser = mockUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (foundUser) {
        setUser(foundUser); // This will trigger the redirection useEffect
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
    setUser(null); // This will trigger the redirection useEffect
    // router.push('/login') is handled by the useEffect
    setIsProcessingAuth(false);
  };

  useEffect(() => {
    if (!isClientSideReady || isProcessingAuth) {
      // Wait for client hydration AND for any active login/logout process to finish
      return;
    }

    if (user && pathname === '/login') {
      router.replace('/'); // User is logged in and on login page, redirect to home
    } else if (!user && pathname !== '/login') {
      router.push('/login'); // User is not logged in and not on login page, redirect to login
    }
  }, [user, isClientSideReady, isProcessingAuth, pathname, router]);


  // ----- Render Logic for AuthProvider -----

  if (!isClientSideReady) {
    // Initializing phase, client not yet ready (e.g., during SSR hydration mismatch checks)
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Initializing...</p>
      </div>
    );
  }

  if (isProcessingAuth) {
    // Active login or logout process is running
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  // Client is ready and no auth process is active.
  // Now decide based on user and pathname whether to redirect or render children.
  if (!user && pathname !== '/login') {
    // Redirect to login is expected because user is not set and we are not on the login page.
    // AuthProvider shows its own loader for this transient state.
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  // If we reach here, it means:
  // - Client is ready (isClientSideReady is true).
  // - No authentication process is active (isProcessingAuth is false).
  // - AND (user is authenticated OR (user is null AND pathname IS '/login'))
  // So, render the children (which could be LoginPage or AppLayout for protected routes).
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
