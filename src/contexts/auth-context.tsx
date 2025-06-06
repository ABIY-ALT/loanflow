
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { User as AppUser } from '@/types/loan';
// UserRole is not directly used here but good for context if needed later
// import { UserRole } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Simulate checking for an existing session (e.g., from localStorage or a cookie)
    // For this prototype, we'll just start with no user logged in.
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Simulate network delay - can be removed if not needed for testing
      // await new Promise(resolve => setTimeout(resolve, 500));

      const foundUser = mockUsers.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );

      if (foundUser) {
        setUser(foundUser);
        router.push('/'); // Navigate on success
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error("Error during login process in AuthContext:", error);
      setUser(null); // Ensure user is null on error
      return false;   // Indicate login failure
    } finally {
      setIsLoading(false); // CRITICAL: Ensure isLoading is set to false
    }
  };

  const logout = () => {
    setUser(null);
    router.push('/login'); // Redirect to login page immediately after clearing user
  };

  if (isLoading) { // Simplified condition: if isLoading is true, show loader.
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
