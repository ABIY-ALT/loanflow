

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
import { DollarSign, User as UserIcon, Mail, Phone, Type, Info, Loader2, ListFilter, Briefcase } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { addLoanRequest, getAvailableLoanTypesForWorkflow } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const loanRequestFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  loanAmount: z.coerce.number().positive({ message: 'Loan amount must be a positive number.' }),
  loanType: z.string().min(1, { message: 'Loan type is required.' }),
  loanPurpose: z.string().min(10, { message: 'Loan purpose must be at least 10 characters.' }),
  customerBranch: z.string().min(1, { message: 'Customer branch is required.' }),
});

type LoanRequestFormValues = z.infer<typeof loanRequestFormSchema>;

const MOCK_BRANCHES = ['Main Office', 'North Branch', 'South Branch', 'Online Origination'];

export default function NewLoanRequestPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableLoanTypes, setAvailableLoanTypes] = useState<string[]>([]);
  const [isLoadingLoanTypes, setIsLoadingLoanTypes] = useState(true);
  const [loanTypesError, setLoanTypesError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLoanTypes() {
      setIsLoadingLoanTypes(true);
      setLoanTypesError(null);
      try {
        const result = await getAvailableLoanTypesForWorkflow();
        if (result.error) {
          setLoanTypesError(result.error);
          setAvailableLoanTypes([]);
        } else if (result.loanTypes) {
          setAvailableLoanTypes(result.loanTypes);
        } else {
          setLoanTypesError("No loan types with associated workflows found.");
          setAvailableLoanTypes([]);
        }
      } catch (err: any) {
        setLoanTypesError(err.message || "Failed to fetch available loan types.");
        setAvailableLoanTypes([]);
      } finally {
        setIsLoadingLoanTypes(false);
      }
    }
    fetchLoanTypes();
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
      customerBranch: '',
    },
  });

  async function onSubmit(data: LoanRequestFormValues) {
    setIsSubmitting(true);
    try {
      const result = await addLoanRequest(data);

      if (result.error) {
        toast({
          title: "Submission Error",
          description: result.error,
          variant: "destructive",
          duration: 9000,
        });
      } else if (result.id) {
        toast({
          title: "Loan Request Submitted",
          description: `Request for ${data.customerName} submitted and routed to its initial department.`,
        });
        form.reset();
        router.push('/loan-process');
      } else {
         toast({
          title: "Submission Error",
          description: "An unexpected issue occurred with submission.",
          variant: "destructive",
          duration: 9000,
        });
      }
    } catch (error: any) {
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      toast({
        title: "Submission Failed",
        description: `Error: ${errorMessage}`,
        variant: "destructive",
        duration: 9000,
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
          Fill in the details below to submit a new loan application. The loan type will determine its starting department and workflow.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Applicant & Loan Information</CardTitle>
          <CardDescription>All fields are required. Select a loan type to begin the process.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <FormField control={form.control} name="customerName" render={({ field }) => ( <FormItem> <FormLabel>Customer Name</FormLabel> <FormControl> <div className="relative"> <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input placeholder="e.g., John Doe" {...field} className="pl-10" disabled={isSubmitting} /> </div> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="customerEmail" render={({ field }) => ( <FormItem> <FormLabel>Customer Email</FormLabel> <FormControl> <div className="relative"> <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input type="email" placeholder="e.g., john.doe@example.com" {...field} className="pl-10" disabled={isSubmitting} /> </div> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="customerPhone" render={({ field }) => ( <FormItem> <FormLabel>Customer Phone</FormLabel> <FormControl> <div className="relative"> <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input type="tel" placeholder="e.g., (555) 123-4567" {...field} className="pl-10" disabled={isSubmitting} /> </div> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="customerBranch" render={({ field }) => ( <FormItem> <FormLabel>Customer Branch</FormLabel> <div className="relative"> <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting} > <FormControl> <SelectTrigger className="pl-10"> <SelectValue placeholder="Select customer branch" /> </SelectTrigger> </FormControl> <SelectContent> {MOCK_BRANCHES.map(branch => ( <SelectItem key={branch} value={branch}>{branch}</SelectItem> ))} </SelectContent> </Select> </div> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="loanAmount" render={({ field }) => ( <FormItem> <FormLabel>Loan Amount ($)</FormLabel> <FormControl> <div className="relative"> <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input type="number" placeholder="e.g., 10000" {...field} className="pl-10" disabled={isSubmitting}/> </div> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="loanType" render={({ field }) => ( <FormItem> <FormLabel>Loan Type</FormLabel> <div className="relative"> <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingLoanTypes || isSubmitting || availableLoanTypes.length === 0} > <FormControl> <SelectTrigger className="pl-10"> <SelectValue placeholder={isLoadingLoanTypes ? "Loading loan types..." : "Select loan type"} /> </SelectTrigger> </FormControl> <SelectContent> {availableLoanTypes.map(type => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))} {availableLoanTypes.length === 0 && !isLoadingLoanTypes && ( <SelectItem value="no-types" disabled>No loan types with workflows found</SelectItem> )} </SelectContent> </Select> </div> {loanTypesError && <FormMessage>{loanTypesError}</FormMessage>} {!loanTypesError && availableLoanTypes.length === 0 && !isLoadingLoanTypes && ( <p className="text-sm text-muted-foreground">No loan types with active workflows are configured. Please contact an admin.</p> )} <FormMessage /> </FormItem> )} />
              </div>

              <FormField control={form.control} name="loanPurpose" render={({ field }) => ( <FormItem> <FormLabel>Loan Purpose</FormLabel> <FormControl> <div className="relative"> <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /> <Textarea placeholder="Briefly describe the purpose of the loan..." className="resize-none pl-10" {...field} disabled={isSubmitting} /> </div> </FormControl> <FormDescription> Provide a clear and concise reason for the loan application. </FormDescription> <FormMessage /> </FormItem> )} />
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || isLoadingLoanTypes || availableLoanTypes.length === 0 || (form.formState.isSubmitted && !form.formState.isValid)} > {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isSubmitting ? 'Submitting...' : 'Submit Loan Request'} </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
