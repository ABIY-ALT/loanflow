
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { User as AppUser } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean; // True during initial app load/session check OR active auth process (login/logout)
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true for initial load/session check
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate initial session check. For this prototype, just finish "initial loading".
    // In a real app, this would be async and might set 'user' if a session exists.
    // For now, we assume no pre-existing session.
    setIsLoading(false);
  }, []); // Runs once on mount to signify initial app data loading is complete.

  useEffect(() => {
    // This effect handles redirection logic based on auth state and current path.
    // It should only run after the initial isLoading phase is complete.
    if (isLoading) {
      return; // Don't redirect if we are still in an initial loading or active auth process state
    }

    if (user && pathname === '/login') {
      router.replace('/'); // User is logged in and on login page, redirect to home
    } else if (!user && pathname !== '/login') {
      router.push('/login'); // User is not logged in and not on login page, redirect to login
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true); // Indicate an authentication process is starting
    try {
      // Simulate API call or credential check
      // await new Promise(resolve => setTimeout(resolve, 300)); // Optional delay

      const foundUser = mockUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (foundUser) {
        setUser(foundUser); // This will trigger the useEffect above for redirection
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
      setIsLoading(false); // Authentication attempt finished
    }
  };

  const logout = () => {
    setIsLoading(true); // Indicate an authentication process is starting
    setUser(null); // This will trigger the useEffect above for redirection
    // router.push('/login') is handled by the useEffect now
    setIsLoading(false); // Authentication attempt finished
  };

  // Primary gate for displaying global loaders or the application content.
  if (isLoading) {
    // This covers initial app load (first useEffect setting isLoading to false)
    // AND active authentication processes (login/logout setting isLoading true/false).
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Initializing application...</p>
      </div>
    );
  }

  // If initial loading is done (isLoading is false), and no user is authenticated,
  // and we are not on the login page, a redirect to /login is imminent via useEffect.
  // Show a loader for this transient state.
  if (!user && pathname !== '/login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  // If we reach here, it means:
  // - isLoading is false.
  // - AND (user is authenticated OR (user is null AND pathname IS '/login'))
  // So, render the children (which could be LoginPage or AppLayout for protected routes).
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
