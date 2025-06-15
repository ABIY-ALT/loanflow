
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { PERMISSIONS } from '@/lib/permissions'; // Added import

interface RegisterUserFormProps {
  registerUserAction: (formData: FormData) => Promise<{ success: boolean; message: string; errors?: any }>;
}

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(), // Making phone number optional for form validation
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export default function RegisterUserForm({ registerUserAction }: RegisterUserFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formDataState, setFormDataState] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string[] | undefined>>({});


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormDataState(prev => ({ ...prev, [name]: value }));
    // Clear specific field error on change
    if (formErrors[name]) {
        setFormErrors(prev => ({...prev, [name]: undefined}));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormErrors({}); // Clear previous errors
    
    const validationResult = userSchema.safeParse(formDataState);
    if (!validationResult.success) {
        const zodErrors = validationResult.error.flatten().fieldErrors;
        setFormErrors(zodErrors);
        toast({
            title: "Validation Failed",
            description: "Please check the form for errors.",
            variant: "destructive",
        });
        return;
    }

    setIsSubmitting(true);
    const formPayload = new FormData(e.currentTarget);
    // Ensure FormData reflects the state if state is the source of truth
    // Or ensure state is directly used if not using FormData propagation
    
    const result = await registerUserAction(formPayload);
    
    if (result.success) {
      toast({
        title: "User Registered",
        description: result.message || "The new user has been registered successfully.",
      });
      setFormDataState({ // Reset form
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: '',
        password: '',
      });
      setFormErrors({});
    } else {
      toast({
        title: "Registration Failed",
        description: result.message || "An error occurred during registration.",
        variant: "destructive",
      });
      if (result.errors) {
        setFormErrors(result.errors);
      }
    }
    setIsSubmitting(false);
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Register New User</CardTitle>
        <CardDescription>Enter the details for the new user. This action is restricted to administrators with the '{PERMISSIONS.MANAGE_USERS}' permission.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" value={formDataState.firstName} onChange={handleChange} disabled={isSubmitting} />
              {formErrors.firstName && <p className="text-xs text-destructive mt-1">{formErrors.firstName.join(', ')}</p>}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" name="lastName" value={formDataState.lastName} onChange={handleChange} disabled={isSubmitting} />
              {formErrors.lastName && <p className="text-xs text-destructive mt-1">{formErrors.lastName.join(', ')}</p>}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={formDataState.email} onChange={handleChange} disabled={isSubmitting} />
              {formErrors.email && <p className="text-xs text-destructive mt-1">{formErrors.email.join(', ')}</p>}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
              <Input id="phoneNumber" name="phoneNumber" value={formDataState.phoneNumber} onChange={handleChange} disabled={isSubmitting} />
              {formErrors.phoneNumber && <p className="text-xs text-destructive mt-1">{formErrors.phoneNumber.join(', ')}</p>}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" value={formDataState.password} onChange={handleChange} disabled={isSubmitting} />
              {formErrors.password && <p className="text-xs text-destructive mt-1">{formErrors.password.join(', ')}</p>}
            </div>
          </div>
          <Button type="submit" className="mt-6 w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register User
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
