
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect }from 'react';
import type { User as AppUser } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean; // True ONLY during active login/logout process
  login: (email: string, password?: string) => Promise<boolean>; // Make login async
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false); // For active login/logout
  const [isInitialLoad, setIsInitialLoad] = useState(true); // For initial client-side check
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // On initial mount, simply mark initial load as complete.
    // In a real app, you might check localStorage for a persisted session here.
    setIsInitialLoad(false);
  }, []);

  const login = async (emailInput: string, passwordInput?: string): Promise<boolean> => {
    setIsProcessingAuth(true);
    try {
      // Simulate finding user
      const foundUser = mockUsers.find(
        (u) => u.email.toLowerCase() === emailInput.toLowerCase() && u.password === passwordInput
      );

      if (foundUser) {
        setUser(foundUser);
        return true;
      } else {
        setUser(null); // Ensure user is null on failed login
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
    setIsProcessingAuth(true); // Indicate processing has started
    setUser(null);
    // Redirection to /login will be handled by the useEffect below,
    // once isProcessingAuth becomes false and user is null.
    setIsProcessingAuth(false); // Indicate processing is finished
  };

  useEffect(() => {
    if (isInitialLoad || isProcessingAuth) {
      // Don't run navigation logic if initial load isn't complete or if auth is being processed
      return;
    }

    if (user && pathname === '/login') {
      router.replace('/');
    } else if (!user && pathname !== '/login') {
      router.push('/login');
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
    // This loader is for the duration of the login/logout async operations.
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }

  // If not initial load, not processing, no user, and not on login page -> means we should redirect.
  // The useEffect handles the push, this loader is for the interim before that effect runs or completes.
  if (!user && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  // Render children if:
  // - User is authenticated (and not initial load, not processing)
  // - OR on the login page (user is null, not initial load, not processing)
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
