
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
// Removed mockUsers import as login logic is now fully in AuthContext

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const authContext = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Local loading state for the form submission
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); // Use local isLoading for button disabling
    setError(null);

    // Call context's login, which now only handles auth logic and returns success/failure
    const success = await authContext.login(email, password);

    if (success) {
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push('/'); // Navigate to home page after successful login
    } else {
      const friendlyMessage = "Invalid email or password. Please try again.";
      setError(friendlyMessage);
      toast({ title: "Login Failed", description: friendlyMessage, variant: "destructive" });
    }
    setIsLoading(false); // Reset local isLoading
  };

  // If authContext.isLoading is true, it means AuthProvider is doing something global (like redirecting)
  // We might want to disable the form or show a different message, but for now, local isLoading handles the button.
  if (authContext.isLoading) {
    // This is a global loading state from AuthProvider, potentially during redirects or initial checks.
    // The login form might still be visible but less interactive or showing a global loader from AuthProvider.
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your LoanFlow account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || authContext.isLoading} // Disable if local or global loading
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || authContext.isLoading} // Disable if local or global loading
                className="text-base"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button type="submit" className="w-full text-lg py-3" disabled={isLoading || authContext.isLoading}>
              {isLoading ? ( // Prioritize local form submission loading indicator
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-5 w-5" />
              )}
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-sm">
          <p className="text-muted-foreground">
            Don&apos;t have an account? <Link href="#" className="font-medium text-primary hover:underline">Contact Admin</Link>
          </p>
           <p className="mt-4 text-xs text-muted-foreground">
            Note: User registration is not self-service.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
