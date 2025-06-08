
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect }from 'react';
import type { User as AppUser } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
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
        setUser(foundUser);
        // Navigation will be handled by the component calling login or by useEffect
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
    // Navigation will be handled by useEffect
    setIsProcessingAuth(false);
  };

  useEffect(() => {
    if (!isInitialLoadComplete || isProcessingAuth) {
      // Don't navigate if still initializing client-side or if an auth operation is actively processing.
      return;
    }

    if (user && pathname === '/login') {
      // Authenticated user on login page, redirect to home
      router.replace('/');
    } else if (!user && pathname !== '/login') {
      // Unauthenticated user on a protected page, redirect to login
      router.push('/login');
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
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Processing authentication...</p>
      </div>
    );
  }
  
  // This handles the case where useEffect will redirect to login
  if (!user && pathname !== '/login' && isInitialLoadComplete && !isProcessingAuth) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }
  
  // Render children if:
  // 1. Client is ready AND
  // 2. Not actively processing auth AND
  // 3. (User is authenticated OR current page is /login)
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
