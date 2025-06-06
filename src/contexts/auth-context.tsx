
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { User as AppUser } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean; // Represents if initial auth check or login process is ongoing
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // True for initial app load/session check
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate initial session check. For this prototype, just finish "initial loading".
    // In a real app, this would be async and might set 'user' if a session exists.
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) {
      // If we are in the initial loading phase or an auth process is active,
      // don't attempt redirects yet.
      return;
    }

    // After initial loading is done (isLoading is false):
    if (user && pathname === '/login') {
      // If user is logged in and somehow on the login page, redirect to home.
      router.replace('/'); // Use replace to avoid back button going to login
    } else if (!user && pathname !== '/login') {
      // If user is not logged in and not on the login page, redirect to login.
      router.push('/login'); // Can be push or replace depending on desired back button behavior
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true); // Indicate authentication process is starting
    try {
      // Simulate API call or credential check
      // await new Promise(resolve => setTimeout(resolve, 300)); // Optional delay for testing

      const foundUser = mockUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (foundUser) {
        setUser(foundUser); // Set the user state. useEffect above will handle redirect.
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
      setIsLoading(false); // Authentication attempt finished
    }
  };

  const logout = () => {
    setUser(null); // Clear the user state. useEffect above will handle redirect.
  };

  // This is the primary gate for displaying content or a global loader.
  // Show loader if:
  // 1. `isLoading` is true (either initial app load or an auth process like login is active).
  // 2. OR initial loading is done (`isLoading` is false), but no user is set AND we are not on the login page
  //    (this implies a redirect to /login is pending or should be happening via the useEffect).
  if (isLoading || (!user && pathname !== '/login')) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Initializing...</p>
      </div>
    );
  }

  // If execution reaches here, it means:
  // - `isLoading` is false.
  // - AND (EITHER `user` is set (so we render children, which could be AppLayout for protected routes)
  //      OR `user` is null AND `pathname` IS '/login' (so we render children, which is LoginPage))
  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
