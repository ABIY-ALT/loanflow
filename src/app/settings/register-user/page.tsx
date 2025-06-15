
// This page component will now be simpler, mainly for structure and permissions check
'use client'; // This page uses client components

import RegisterUserForm from '@/components/RegisterUserForm';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { registerUserAction as serverRegisterUserAction } from './actions'; // Import the renamed server action

export default function RegisterUserPageClient() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading user data...</p>
      </div>
    );
  }

  if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to register new users. This requires the '{PERMISSIONS.MANAGE_USERS}' permission.</p>
        <Link href="/settings" passHref>
          <Button variant="outline">Back to Settings</Button>
        </Link>
      </div>
    );
  }

  return <RegisterUserForm registerUserAction={serverRegisterUserAction} />;
}
