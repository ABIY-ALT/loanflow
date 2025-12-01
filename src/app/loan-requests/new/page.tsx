
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
import { User as UserIcon, Mail, Phone, Info, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { addLoanRequest } from '@/services/loan-service-prisma';
import { getBranches } from '@/services/branch-service';
import type { Branch } from '@/types/loan';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import Link from 'next/link';
import { getSectors, getRequestTypes } from '@/services/sector-and-request-type-service';
import type { ConfigurableListItem } from '@/services/sector-and-request-type-service';


const loanRequestFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  customerBranch: z.string().min(1, { message: 'A branch must be selected.' }),
  loanAmount: z.coerce.number().positive({ message: 'Loan amount must be a positive number.' }),
  sectorId: z.string().min(1, { message: 'A sector must be selected.' }),
  requestTypeId: z.string().min(1, { message: 'A request type must be selected.' }),
  loanPurpose: z.string().min(10, { message: 'Loan purpose must be at least 10 characters.' }),
});

type LoanRequestFormValues = z.infer<typeof loanRequestFormSchema>;

export default function NewLoanRequestPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [sectors, setSectors] = useState<ConfigurableListItem[]>([]);
  const [requestTypes, setRequestTypes] = useState<ConfigurableListItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCreateRequest = user?.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST);

  useEffect(() => {
    if(authLoading || !canCreateRequest) {
      if(!authLoading && !canCreateRequest) setIsLoading(false);
      return;
    }
    
    async function fetchPageData() {
      setIsLoading(true);
      setError(null);
      try {
        const [sectorsResult, requestTypesResult, branchesResult] = await Promise.all([
          getSectors(),
          getRequestTypes(),
          getBranches(),
        ]);

        if (sectorsResult.error) {
          setError(prev => (prev ? `${prev}\n` : '') + `Sectors: ${sectorsResult.error}`);
          setSectors([]);
        } else {
          setSectors(sectorsResult.sectors || []);
        }

        if (requestTypesResult.error) {
          setError(prev => (prev ? `${prev}\n` : '') + `Request Types: ${requestTypesResult.error}`);
          setRequestTypes([]);
        } else {
          setRequestTypes(requestTypesResult.requestTypes || []);
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
  }, [authLoading, canCreateRequest]);

  const branchOptions = useMemo(
    () =>
      branches.map(branch => ({
        value: branch.name,
        label: `${branch.name} (${branch.districtName})`,
      })),
    [branches]
  );
  
  const childSectorOptions = useMemo(() => sectors.filter(s => s.parentId), [sectors]);

  const form = useForm<LoanRequestFormValues>({
    resolver: zodResolver(loanRequestFormSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerBranch: '',
      loanAmount: 0,
      sectorId: '',
      requestTypeId: '',
      loanPurpose: '',
    },
  });

  async function onSubmit(data: LoanRequestFormValues) {
    setIsSubmitting(true);
    try {
      const result = await addLoanRequest(data);

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

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading form...</p>
      </div>
    );
  }

  if (!canCreateRequest) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to create new loan requests.</p>
        <Link href="/" passHref>
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
        </Link>
      </div>
    );
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

                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Full Name</FormLabel>
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
                      <FormDescription>A new customer profile will be created if this email is not found.</FormDescription>
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
                  name="customerBranch"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Customer Branch</FormLabel>
                      <Combobox
                        options={branchOptions}
                        value={field.value}
                        onSelect={field.onChange}
                        placeholder={isLoading ? "Loading branches..." : "Select a branch"}
                        searchPlaceholder="Search branch..."
                        notFoundText="No branch found."
                        className="w-full"
                        disabled={isLoading || isSubmitting || branches.length === 0}
                      />
                      {error?.includes('Branches') && <p className="text-sm text-destructive mt-2">{error}</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="loanAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Amount</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10000" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormDescription>Enter amount in ETB</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sectorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Child Sector</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || isSubmitting || sectors.length === 0}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoading ? "Loading..." : "Select a sector"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {childSectorOptions.length === 0 && <SelectItem value="none" disabled>No child sectors defined</SelectItem>}
                          {childSectorOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormDescription>The selected parent sector will determine the workflow path.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                 <FormField
                  control={form.control}
                  name="requestTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading || isSubmitting || requestTypes.length === 0}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoading ? "Loading..." : "Select a request type"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {requestTypes.map(rt => <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>)}
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
                    <div className="relative">
                      <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Textarea placeholder="Briefly describe the purpose of the loan..." className="resize-none pl-10" {...field} disabled={isSubmitting} />
                      </FormControl>
                    </div>
                    <FormDescription>Provide a clear and concise reason for the loan application.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={isSubmitting || isLoading || sectors.length === 0 || requestTypes.length === 0 || branches.length === 0 || (form.formState.isSubmitted && !form.formState.isValid)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Loan Request'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
