

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
import { addLoanRequest, getActiveWorkflowsForCreate } from '@/services/loan-service-prisma';
import type { LoanRequest, ActiveWorkflow } from '@/types/loan';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const loanRequestFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
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
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkflows() {
      setIsLoadingWorkflows(true);
      setWorkflowsError(null);
      try {
        const result = await getActiveWorkflowsForCreate();
        if (result.error) {
          setWorkflowsError(result.error);
          setAvailableWorkflows([]);
        } else if (result.activeWorkflows) {
          setAvailableWorkflows(result.activeWorkflows);
        } else {
          setWorkflowsError("No active workflows found. Please contact an administrator to configure workflows.");
          setAvailableWorkflows([]);
        }
      } catch (err: any) {
        setWorkflowsError(err.message || "Failed to fetch available workflows.");
        setAvailableWorkflows([]);
      } finally {
        setIsLoadingWorkflows(false);
      }
    }
    fetchWorkflows();
  }, []);

  const form = useForm<LoanRequestFormValues>({
    resolver: zodResolver(loanRequestFormSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      loanAmount: 0,
      workflowVersionId: '',
      loanPurpose: '',
    },
  });

  async function onSubmit(data: LoanRequestFormValues) {
    setIsSubmitting(true);
    try {
      // The loanType will be derived on the backend from the workflow
      const payload = {
          ...data,
          loanType: '', // This is a placeholder, backend will set it from the workflow
      };
      
      const result = await addLoanRequest(payload);

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
          Fill in the details below to submit a new loan application. The selected workflow will determine its starting department.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Applicant & Loan Information</CardTitle>
          <CardDescription>All fields are required. Select a workflow to begin the process.</CardDescription>
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
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input placeholder="e.g., John Doe" {...field} className="pl-10" disabled={isSubmitting} />
                        </FormControl>
                      </div>
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
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input type="email" placeholder="e.g., john.doe@example.com" {...field} className="pl-10" disabled={isSubmitting} />
                        </FormControl>
                      </div>
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
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input type="tel" placeholder="e.g., (555) 123-4567" {...field} className="pl-10" disabled={isSubmitting} />
                        </FormControl>
                      </div>
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
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input type="number" placeholder="e.g., 10000" {...field} className="pl-10" disabled={isSubmitting} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="workflowVersionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workflow</FormLabel>
                        <div className="relative">
                          <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={isLoadingWorkflows || isSubmitting || availableWorkflows.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger className="pl-10">
                                <SelectValue placeholder={isLoadingWorkflows ? "Loading workflows..." : "Select a workflow"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableWorkflows.map(wf => (
                                <SelectItem key={wf.id} value={wf.id}>
                                  {wf.name} ({wf.loanTypeName} / Dept: {wf.departmentName})
                                </SelectItem>
                              ))}
                              {availableWorkflows.length === 0 && !isLoadingWorkflows && (
                                <SelectItem value="no-workflows-found-disabled" disabled>No active workflows found</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {workflowsError && <p className="text-sm text-destructive mt-2">{workflowsError}</p>}
                        {!workflowsError && availableWorkflows.length === 0 && !isLoadingWorkflows && (
                          <p className="text-sm text-muted-foreground mt-2">No active workflows are configured. Please contact an admin.</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="loanPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Purpose</FormLabel>
                    <div className="relative">
                      <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Textarea placeholder="Briefly describe the purpose of the loan..." className="resize-none pl-10" {...field} disabled={isSubmitting} />
                      </FormControl>
                    </div>
                    <FormDescription> Provide a clear and concise reason for the loan application. </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || isLoadingWorkflows || availableWorkflows.length === 0 || (form.formState.isSubmitted && !form.formState.isValid)}>
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
