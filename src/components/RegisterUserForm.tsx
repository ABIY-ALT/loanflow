'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { z } from 'zod'; // Assuming you have zod for schema validation

interface RegisterUserFormProps {
  registerUserAction: (formData: FormData) => Promise<any>; // Define the type for the server action prop
}

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export default function RegisterUserForm({ registerUserAction }: RegisterUserFormProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    console.log("user : " + user)
    if (!loading && user && user.role !== 'Admin2') {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      // Client-side validation (optional but recommended)
      userSchema.parse(formData);

      const form = new FormData(e.currentTarget);
      const result = await registerUserAction(form);
      if (result.isSuccess) {
        // Handle successful registration (e.g., show a success message, clear form)
        alert('User registered successfully!');
        setFormData({
          firstName: '',
          lastName: '',
          phoneNumber: '',
          email: '',
          password: '',
        });
      } else {
        // Handle registration errors
        alert(`Registration failed: ${result.errors?.join(', ')}`);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        alert('Validation failed: ' + error.errors.map(err => err.message).join(', '));
      } else {
        alert('An unexpected error occurred during registration.');
      }
      console.error('Registration error:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || user.role !== 'ADMIN') {
    return null; // Or a message indicating unauthorized access
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Register New User</CardTitle>
        <CardDescription>Enter the details for the new user.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange} required />
            </div>
          </div>
          <Button type="submit" className="mt-6 w-full">Register User</Button>
        </form>
      </CardContent>
      {/* <CardFooter>
        Optional footer content
      </CardFooter> */}
    </Card>
  );
}