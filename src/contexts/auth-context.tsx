
'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { User as AppUser } from '@/types/loan'; // Renamed to AppUser to avoid conflict
import { UserRole } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data';
import { Loader2 } from 'lucide-react';

// For demonstration, let's set a default mock logged-in user ID.
// You can change this ID to test different roles:
// 'user-admin-alice' (ADMIN)
// 'user-manager-mike' (UNDERWRITER - Manager)
// 'user-jane-doe' (RELATIONSHIP_MANAGER - Staff/Officer)
const MOCK_CURRENT_USER_ID = 'user-manager-mike'; 

interface AuthContextType {
  user: AppUser | null; // User can be null if not found or initially
  isLoading: boolean;
  // Helper function to easily switch mock user for testing (optional enhancement)
  // switchMockUser: (userId: string) => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching the current user's details
    setIsLoading(true);
    const currentUserData = mockUsers.find(u => u.id === MOCK_CURRENT_USER_ID);
    if (currentUserData) {
      setUser(currentUserData);
    } else {
      console.warn(`Mock user with ID "${MOCK_CURRENT_USER_ID}" not found in mockUsers. Defaulting to null user.`);
      setUser(null); // Or set to a guest user if you have one
    }
    setIsLoading(false);
  }, []); // Runs once on mount

  // Placeholder for a user switching mechanism for easier testing.
  // const switchMockUser = (userId: string) => {
  //   setIsLoading(true);
  //   const newUserData = mockUsers.find(u => u.id === userId);
  //   setUser(newUserData || null);
  //   setIsLoading(false);
  // };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Initializing user session...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // This might happen if a component tries to useAuth outside of AuthProvider.
    // Return a default "guest" state to prevent errors.
    return { user: null, isLoading: false };
  }
  return context;
};

