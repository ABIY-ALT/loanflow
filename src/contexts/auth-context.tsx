
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect }from 'react';
import type { User as AppUser } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean; // This will reflect isProcessingAuth
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false); // For login/logout operations
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // This effect runs once on mount to indicate client is ready.
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
        setUser(foundUser); // State update: user is now set
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
      setIsProcessingAuth(false); // State update: processing is finished
    }
  };

  const logout = () => {
    setIsProcessingAuth(true);
    setUser(null); // State update
    // Navigation will be handled by useEffect below
    setIsProcessingAuth(false);
  };

  useEffect(() => {
    // Wait for initial client-side mount to complete.
    if (!isInitialLoadComplete) {
      return;
    }

    // If an auth operation (login/logout) is actively in progress, defer navigation.
    if (isProcessingAuth) {
      return;
    }

    // Navigation logic based on current state
    if (user && pathname === '/login') {
      // User is authenticated and on the login page (e.g., just logged in).
      router.replace('/');
    } else if (!user && pathname !== '/login') {
      // User is not authenticated and on a protected page.
      router.push('/login');
    }
    // Dependencies: user, pathname, router, isInitialLoadComplete.
    // isProcessingAuth is checked *inside* the effect.
  }, [user, pathname, router, isInitialLoadComplete, isProcessingAuth]); // Added isProcessingAuth back to ensure re-evaluation when it turns false

  // Render logic for AuthProvider
  if (!isInitialLoadComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Initializing application...</p>
      </div>
    );
  }

  if (isProcessingAuth) {
    // This covers the active period of login() or logout()
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }
  
  // If client is ready, not processing auth, but user is not set AND we are on a protected page
  if (!user && pathname !== '/login') {
    // This implies that the useEffect above is expected to perform a redirect.
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // If initial load is complete, not processing auth, and user is either authenticated OR on the login page:
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
