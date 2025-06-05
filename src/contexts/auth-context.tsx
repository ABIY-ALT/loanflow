
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { User as AppUser } from '@/types/loan';
import { UserRole } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation'; // Import useRouter

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>; // Modified to handle mock auth
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter(); // Get router instance

  useEffect(() => {
    // Simulate checking for an existing session (e.g., from localStorage or a cookie)
    // For this prototype, we'll just start with no user logged in.
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    // Simulate network delay for login
    await new Promise(resolve => setTimeout(resolve, 500));

    const foundUser = mockUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (foundUser) {
      setUser(foundUser);
      setIsLoading(false);
      router.push('/'); // Redirect to dashboard after successful login
      return true;
    } else {
      setUser(null);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    router.push('/login'); // Redirect to login page immediately after clearing user
  };

  if (isLoading && !user) { // Show loading only on initial load or during login process
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Initializing...</p>
      </div>
    );
  }

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
