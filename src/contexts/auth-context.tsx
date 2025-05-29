
'use client';

import type React from 'react';
import { createContext, useContext, useState } from 'react';
// Firebase User type is no longer imported
// import { type User as FirebaseUser } from 'firebase/auth';
// import { auth } from '@/lib/firebase'; // Firebase auth is not used
import { Loader2 } from 'lucide-react';

// Using a simple mock user type or null if no user is simulated
type MockUser = { email: string } | null;

interface AuthContextType {
  user: MockUser;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MockUser>(null); // Default to no user
  const [isLoading, setIsLoading] = useState(false); // Not loading as auth is removed

  // Removed useEffect that subscribed to onAuthStateChanged from Firebase

  // The loading screen for auth initialization is removed as Firebase auth is not active.
  // If you want a generic app loading screen, it should be handled differently.

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // This might happen if a component tries to useAuth outside of AuthProvider
    // or if AuthProvider is removed from the layout.
    // console.warn('useAuth called outside of AuthProvider or AuthProvider is not set up.');
    // Return a default state to prevent errors in consuming components if they aren't updated.
    return { user: null, isLoading: false };
  }
  return context;
};
