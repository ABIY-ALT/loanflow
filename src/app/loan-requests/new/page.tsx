
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { DollarSign, User as UserIcon, Mail, Phone, Type, Info, Loader2, Landmark } from 'lucide-react'; 
import React, { useState, useEffect } from 'react';
import { addLoanRequest } from '@/services/loan-service'; 
import type { LoanRequest, User } from '@/types/loan'; 
import { UserRole } from '@/types/loan'; 
import { mockUsers } from '@/lib/mock-data'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const UNASSIGNED_MARKER = "---UNASSIGNED---";

const loanRequestFormSchema = z.object({
  customerName: z.string().min(2, {
    message: 'Customer name must be at least 2 characters.',
  }),
  customerEmail: z.string().email({
    message: 'Please enter a valid email address.',
  }),
  customerPhone: z.string().min(10, {
    message: 'Phone number must be at least 10 digits.',
  }),
  loanAmount: z.coerce.number().positive({
    message: 'Loan amount must be a positive number.',
  }),
  loanType: z.string().min(2, {
    message: 'Loan type is required.',
  }),
  loanPurpose: z.string().min(10, {
    message: 'Loan purpose must be at least 10 characters.',
  }),
  assignedTo: z.string().optional(), 
});

type LoanRequestFormValues = z.infer<typeof loanRequestFormSchema>;

export default function NewLoanRequestPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relationshipManagers, setRelationshipManagers] = useState<User[]>([]);

  useEffect(() => {
    const rMs = mockUsers.filter(user => user.role === UserRole.RELATIONSHIP_MANAGER);
    setRelationshipManagers(rMs);
  }, []);

  const form = useForm<LoanRequestFormValues>({
    resolver: zodResolver(loanRequestFormSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      loanAmount: 0,
      loanType: '',
      loanPurpose: '',
      assignedTo: UNASSIGNED_MARKER, // Default to unassigned marker
    },
  });

  async function onSubmit(data: LoanRequestFormValues) {
    setIsSubmitting(true);
    try {
      const assignedToValue = data.assignedTo === UNASSIGNED_MARKER ? undefined : data.assignedTo;

      const loanDataForService: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline'> & { assignedTo?: string } = {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        loanAmount: data.loanAmount,
        loanType: data.loanType,
        loanPurpose: data.loanPurpose,
        assignedTo: assignedToValue,
      };
      
      const result = await addLoanRequest(loanDataForService); 

      if (result.error) {
        toast({
          title: "Submission Error",
          description: `Failed to save loan request: ${result.error}`,
          variant: "destructive",
        });
         console.error("Full error result from addLoanRequest service on client:", result);
      } else if (result.id) {
        const assignedManagerName = assignedToValue 
          ? relationshipManagers.find(rm => rm.id === assignedToValue)?.name 
          : null;
        
        toast({
          title: "Loan Request Submitted (Mock)",
          description: `Request for ${data.customerName} has been submitted with ID: ${result.id}. Assigned to: ${assignedManagerName || 'Auto/Unassigned'}`,
        });
        form.reset();
        router.push('/loan-process');
      } else {
         toast({
          title: "Submission Error",
          description: "An unexpected issue occurred with submission (Mock).",
          variant: "destructive",
        });
      }
    } catch (error: any) { 
      console.error("Client-side error during loan request submission (outer catch):", error);
      console.error("Error name:", error?.name);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      console.error("Full error object (client):", error);
      toast({
        title: "Submission System Error (Mock)",
        description: `A client-side error occurred: ${error?.message || 'Please try again.'}. Check server terminal logs for more details if this persists.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Loan Request</h1>
        <p className="text-muted-foreground">
          Fill in the details below to submit a new loan application.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Applicant & Loan Information</CardTitle>
          <CardDescription>All fields are required unless marked optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="e.g., John Doe" {...field} className="pl-10" disabled={isSubmitting} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="email" placeholder="e.g., john.doe@example.com" {...field} className="pl-10" disabled={isSubmitting} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Phone</FormLabel>
                      <FormControl>
                        <div className="relative">
                           <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="tel" placeholder="e.g., (555) 123-4567" {...field} className="pl-10" disabled={isSubmitting} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="loanAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Amount ($)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="number" placeholder="e.g., 10000" {...field} className="pl-10" disabled={isSubmitting}/>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="loanType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Type</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="e.g., Personal, Mortgage, Auto" {...field} className="pl-10" disabled={isSubmitting} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Relationship Manager (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || UNASSIGNED_MARKER} disabled={isSubmitting}>
                        <FormControl>
                          <div className="relative">
                            <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <SelectTrigger className="pl-10">
                              <SelectValue placeholder="Select a manager or leave unassigned" />
                            </SelectTrigger>
                          </div>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_MARKER}>Unassigned / Auto-assign</SelectItem>
                          {relationshipManagers.map(manager => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="loanPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Purpose</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea
                          placeholder="Briefly describe the purpose of the loan..."
                          className="resize-none pl-10"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Provide a clear and concise reason for the loan application.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Submitting...' : 'Submit Loan Request'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
