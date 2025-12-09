
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, LogOut, XCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { changePasswordAction } from './actions';
import { cn } from '@/lib/utils';


const passwordSchema = new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$');
const passwordRequirements = [
    { id: 'length', text: 'At least 8 characters long', regex: /.{8,}/ },
    { id: 'lowercase', text: 'At least one lowercase letter', regex: /[a-z]/ },
    { id: 'uppercase', text: 'At least one uppercase letter', regex: /[A-Z]/ },
    { id: 'number', text: 'At least one number', regex: /\d/ },
    { id: 'special', text: 'At least one special character (@$!%*?&)', regex: /[@$!%*?&]/ },
];

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, logout, isLoading } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // If user is loaded and their password IS already changed, redirect them away.
    if (user && user.isPasswordChanged) {
      router.replace('/');
    }
  }, [user, router]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    
    if (!passwordSchema.test(newPassword)) {
        setError("Password does not meet the strength requirements.");
        return;
    }

    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('oldPassword', oldPassword);
    formData.append('newPassword', newPassword);

    const result = await changePasswordAction(formData);

    if (result.success) {
      toast({ title: "Password Changed", description: "Your password has been successfully updated. Please log in again." });
      await logout(); // Logout the user to force a re-login with the new password
      // The logout function and AuthContext will handle the redirect to /login
    } else {
      setError(result.message);
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };
  
  const handleLogout = async () => {
    await logout();
    toast({ title: "Logged Out", description: "You have been logged out." });
  };


  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Change Your Password</CardTitle>
          <CardDescription>For your security, you must change your temporary password before you can proceed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Old Password</Label>
              <div className="relative">
                <Input
                  id="oldPassword"
                  type={showOldPassword ? 'text' : 'password'}
                  placeholder="Enter your current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                 <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 h-full px-3"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  disabled={isSubmitting}
                >
                  {showOldPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                  <span className="sr-only">{showOldPassword ? 'Hide password' : 'Show password'}</span>
                </Button>
              </div>
            </div>
             <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={isSubmitting}
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                  <span className="sr-only">{showNewPassword ? 'Hide password' : 'Show password'}</span>
                </Button>
              </div>
            </div>

            {newPassword && (
                <div className="space-y-2 text-xs p-3 bg-muted rounded-lg">
                    <p className="font-medium text-sm">Password must contain:</p>
                    {passwordRequirements.map(req => {
                        const isValid = req.regex.test(newPassword);
                        return (
                            <div key={req.id} className={cn("flex items-center gap-2", isValid ? "text-green-600" : "text-destructive")}>
                                {isValid ? <CheckCircle className="h-4 w-4"/> : <XCircle className="h-4 w-4"/>}
                                <span>{req.text}</span>
                            </div>
                        )
                    })}
                </div>
            )}

             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                  <span className="sr-only">{showConfirmPassword ? 'Hide password' : 'Show password'}</span>
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button type="submit" className="w-full text-lg py-3" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-5 w-5" />
              )}
              Update Password
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-sm">
             <Button variant="link" onClick={handleLogout} className="text-muted-foreground hover:text-primary">
                 <LogOut className="mr-2 h-4 w-4"/> Logout
             </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
