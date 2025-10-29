

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
import { DollarSign, User as UserIcon, Mail, Phone, Type, Info, Loader2, ListFilter, Building } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { addLoanRequest, getActiveWorkflowsForCreate } from '@/services/loan-service-prisma';
import { getBranches } from '@/services/branch-service';
import type { LoanRequest, ActiveWorkflow, Branch } from '@/types/loan';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const loanRequestFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  customerBranch: z.string().min(1, { message: 'A branch must be selected.' }),
  loanAmount: z.coerce.number().positive({ message: 'Loan amount must be a positive number.' }),
  workflowVersionId: z.string().min(1, { message: 'A workflow must be selected.' }),
  loanPurpose: z.string().min(10, { message: 'Loan purpose must be at least 10 characters.' }),
});

type LoanRequestFormValues = z.infer<typeof loanRequestFormSchema>;

export default function NewLoanRequestPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState<ActiveWorkflow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPageData() {
      setIsLoading(true);
      setError(null);
      try {
        const [workflowsResult, branchesResult] = await Promise.all([
          getActiveWorkflowsForCreate(),
          getBranches()
        ]);
        
        if (workflowsResult.error) {
          setError(prev => (prev ? `${prev}\n` : '') + `Workflows: ${workflowsResult.error}`);
          setAvailableWorkflows([]);
        } else {
          setAvailableWorkflows(workflowsResult.activeWorkflows || []);
        }

        if (branchesResult.error) {
           setError(prev => (prev ? `${prev}\n` : '') + `Branches: ${branchesResult.error}`);
           setBranches([]);
        } else {
           setBranches(branchesResult.branches || []);
        }
        
      } catch (err: any) {
        setError(err.message || "Failed to fetch required data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
  }, []);

  const form = useForm<LoanRequestFormValues>({
    resolver: zodResolver(loanRequestFormSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerBranch: '',
      loanAmount: 0,
      workflowVersionId: '',
      loanPurpose: '',
    },
  });

  async function onSubmit(data: LoanRequestFormValues) {
    setIsSubmitting(true);
    try {
      const payload = { ...data, loanType: '' };
      
      const result = await addLoanRequest(payload);

      if (result.error) {
        toast({ title: "Submission Error", description: result.error, variant: "destructive", duration: 9000 });
      } else if (result.id) {
        toast({ title: "Loan Request Submitted", description: `Request for ${data.customerName} submitted successfully.` });
        form.reset();
        router.push('/loan-process');
      } else {
         toast({ title: "Submission Error", description: "An unexpected issue occurred.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Submission Failed", description: `Error: ${error.message || 'Unexpected error'}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Loan Request</h1>
        <p className="text-muted-foreground">
          Fill in the details below to submit a new loan application. A customer profile will be created if the email is new.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Applicant & Loan Information</CardTitle>
          <CardDescription>All fields are required unless marked otherwise.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <FormField control={form.control} name="customerName" render={({ field }) => ( <FormItem> <FormLabel>Customer Full Name</FormLabel> <div className="relative"> <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <FormControl> <Input placeholder="e.g., John Doe" {...field} className="pl-10" disabled={isSubmitting} /> </FormControl> </div> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="customerEmail" render={({ field }) => ( <FormItem> <FormLabel>Customer Email</FormLabel> <div className="relative"> <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <FormControl> <Input type="email" placeholder="e.g., john.doe@example.com" {...field} className="pl-10" disabled={isSubmitting} /> </FormControl> </div> <FormDescription>A new customer profile will be created if this email is not found.</FormDescription> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="customerPhone" render={({ field }) => ( <FormItem> <FormLabel>Customer Phone</FormLabel> <div className="relative"> <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <FormControl> <Input type="tel" placeholder="e.g., (555) 123-4567" {...field} className="pl-10" disabled={isSubmitting} /> </FormControl> </div> <FormMessage /> </FormItem> )} />
                
                <FormField
                  control={form.control}
                  name="customerBranch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Branch</FormLabel>
                      <div className="relative">
                         <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || isSubmitting || branches.length === 0} >
                           <FormControl>
                            <SelectTrigger className="pl-10">
                              <SelectValue placeholder={isLoading ? "Loading branches..." : "Select a branch"} />
                            </SelectTrigger>
                           </FormControl>
                           <SelectContent>
                              {branches.map(branch => ( <SelectItem key={branch.id} value={branch.name}> {branch.name} ({branch.districtName}) </SelectItem> ))}
                              {branches.length === 0 && !isLoading && ( <SelectItem value="no-branches" disabled>No branches configured</SelectItem> )}
                           </SelectContent>
                         </Select>
                      </div>
                       {error?.includes('Branches') && <p className="text-sm text-destructive mt-2">{error}</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField control={form.control} name="loanAmount" render={({ field }) => ( <FormItem> <FormLabel>Loan Amount ($)</FormLabel> <div className="relative"> <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <FormControl> <Input type="number" placeholder="e.g., 10000" {...field} className="pl-10" disabled={isSubmitting} /> </FormControl> </div> <FormMessage /> </FormItem> )} />

                <div className="md:col-span-1">
                  <FormField control={form.control} name="workflowVersionId" render={({ field }) => ( <FormItem> <FormLabel>Workflow</FormLabel> <div className="relative"> <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" /> <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || isSubmitting || availableWorkflows.length === 0} > <FormControl> <SelectTrigger className="pl-10"> <SelectValue placeholder={isLoading ? "Loading workflows..." : "Select a workflow"} /> </SelectTrigger> </FormControl> <SelectContent> {availableWorkflows.map(wf => ( <SelectItem key={wf.id} value={wf.id}> {wf.name} ({wf.loanTypeName} / Dept: {wf.departmentName}) </SelectItem> ))} {availableWorkflows.length === 0 && !isLoading && ( <SelectItem value="no-workflows-found-disabled" disabled>No active workflows found</SelectItem> )} </SelectContent> </Select> </div> {error?.includes('Workflows') && <p className="text-sm text-destructive mt-2">{error}</p>} <FormMessage /> </FormItem> )} />
                </div>
              </div>

              <FormField control={form.control} name="loanPurpose" render={({ field }) => ( <FormItem> <FormLabel>Loan Purpose</FormLabel> <div className="relative"> <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /> <FormControl> <Textarea placeholder="Briefly describe the purpose of the loan..." className="resize-none pl-10" {...field} disabled={isSubmitting} /> </FormControl> </div> <FormDescription> Provide a clear and concise reason for the loan application. </FormDescription> <FormMessage /> </FormItem> )} />
              
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || isLoading || availableWorkflows.length === 0 || branches.length === 0 || (form.formState.isSubmitted && !form.formState.isValid)}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Submitting...' : 'Submit Loan Request'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
