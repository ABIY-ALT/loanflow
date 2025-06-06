
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect }from 'react';
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
  const [isInitialLoad, setIsInitialLoad] = useState(true); // True until client-side mount and initial checks
  const [isProcessingAuth, setIsProcessingAuth] = useState(false); // True during active login/logout async operations
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate initial check (e.g., for a persisted session)
    // For this mock setup, we just mark initial load as complete after mount.
    setIsInitialLoad(false);
  }, []);

  const login = async (emailInput: string, passwordInput?: string): Promise<boolean> => {
    setIsProcessingAuth(true);
    try {
      // Defensively ensure emailInput is a string before calling toLowerCase
      const emailToCompare = String(emailInput || '').toLowerCase();
      const foundUser = mockUsers.find(
        (u) => u.email.toLowerCase() === emailToCompare && u.password === passwordInput
      );

      if (foundUser) {
        setUser(foundUser);
        // router.push('/'); // Navigation is now handled by useEffect based on user state change
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
    // router.push('/login'); // Navigation is now handled by useEffect
    setIsProcessingAuth(false);
  };

  useEffect(() => {
    if (isInitialLoad || isProcessingAuth) {
      return; // Don't run navigation logic during initial load or active auth processing
    }

    if (user && pathname === '/login') {
      router.replace('/'); // If user is logged in and on login page, redirect to home
    } else if (!user && pathname !== '/login') {
      router.push('/login'); // If user is not logged in and not on login page, redirect to login
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

  if (isProcessingAuth) { // Loader during active login/logout attempt
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  // Loader for when redirection to login is imminent due to lack of user session on a protected route
  if (!user && pathname !== '/login' && !isInitialLoad && !isProcessingAuth) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

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

