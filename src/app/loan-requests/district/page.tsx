
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldErrors } from 'react-hook-form';
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
import { User as UserIcon, Mail, Phone, Info, Loader2, AlertCircle, Building, CheckCircle, Wallet, ArrowLeft, Send, ClipboardCheck } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { addType2LoanRequest } from '@/services/loan-service-prisma';
import { getCRMBranches } from '@/services/crm-service';
import { getSectors, getRequestTypes } from '@/services/sector-and-request-type-service';
import type { Branch, Sector } from '@/types/loan';
import type { ConfigurableListItem } from '@/services/sector-and-request-type-service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { normalizeEthiopianPhone, isValidLocalEthiopianPhone, cn } from '@/lib/utils';
import { Alert, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

// --- Number to Words Utility ---
const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

function convertGroup(n: number): string {
    let result = '';
    if (n >= 100) {
        result += ones[Math.floor(n / 100)] + ' hundred';
        n %= 100;
        if (n > 0) result += ' ';
    }
    if (n >= 20) {
        result += tens[Math.floor(n / 10)];
        n %= 10;
        if (n > 0) result += '-';
    }
    if (n >= 10) {
        return result + teens[n - 10];
    }
    if (n > 0) {
        result += ones[n];
    }
    return result;
}

function numberToWords(num: number): string {
    if (num === 0) return 'zero';
    if (num < 0) return 'minus ' + numberToWords(Math.abs(num));
    if (num > 999999999999) return 'Number too large';

    const billions = Math.floor(num / 1000000000);
    const millions = Math.floor((num % 1000000000) / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;

    let result = '';
    if (billions > 0) {
        result += convertGroup(billions) + ' billion';
        if (millions > 0 || thousands > 0 || remainder > 0) result += ' ';
    }
    if (millions > 0) {
        result += convertGroup(millions) + ' million';
        if (thousands > 0 || remainder > 0) result += ' ';
    }
    if (thousands > 0) {
        result += convertGroup(thousands) + ' thousand';
        if (remainder > 0) result += ' ';
    }
    if (remainder > 0) {
        result += convertGroup(remainder);
    }
    
    // Capitalize first letter and handle hyphenated results
    return result.trim().charAt(0).toUpperCase() + result.trim().slice(1);
}
// --- End of Utility ---

const districtLoanSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().min(1, { message: 'Customer email is required.' }).email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string().min(1, { message: 'Customer phone is required.' })
    .transform(normalizeEthiopianPhone)
    .refine(isValidLocalEthiopianPhone, { message: 'Phone number must be in local format like 0912345678.' }),
  customerBranch: z.string().min(1, { message: 'A branch must be selected.' }),
  loanAmount: z.coerce.number({ required_error: 'Loan amount is required.', invalid_type_error: 'Loan amount must be a number.' }).positive({ message: 'Loan amount must be a positive number.' }),
  sectorId: z.string().min(1, { message: 'A sector must be selected.' }),
  requestTypeId: z.string().min(1, { message: 'A request type must be selected.' }),
  loanPurpose: z.string().min(10, { message: 'Loan purpose must be at least 10 characters.' }),
});

type DistrictFormValues = z.infer<typeof districtLoanSchema>;

export default function DistrictLoanSubmissionPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [formDataToSubmit, setFormDataToSubmit] = useState<DistrictFormValues | null>(null);
  
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [requestTypes, setRequestTypes] = useState<ConfigurableListItem[]>([]);
  const [crmBranches, setCrmBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const canCreateRequest = user?.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST);

  useEffect(() => {
    if (authLoading || !canCreateRequest) {
      if (!authLoading && !canCreateRequest) setIsLoading(false);
      return;
    }

    async function fetchData() {
      setIsLoading(true);
      try {
        const [sectorsResult, requestTypesResult, branchesResult] = await Promise.all([
          getSectors(),
          getRequestTypes(),
          getCRMBranches(),
        ]);

        if (sectorsResult.error) setError(sectorsResult.error);
        else setSectors(sectorsResult.sectors || []);

        if (requestTypesResult.error) setError(requestTypesResult.error);
        else setRequestTypes(requestTypesResult.requestTypes || []);

        if ('error' in branchesResult) setError(branchesResult.error);
        else {
          const branches = branchesResult.branches || [];
          setCrmBranches(branches);
          if (branches.length === 1) {
            form.setValue('customerBranch', branches[0].name);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [authLoading, canCreateRequest]);

  const form = useForm<DistrictFormValues>({
    resolver: zodResolver(districtLoanSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerBranch: '',
      loanAmount: '' as unknown as number,
      sectorId: '',
      requestTypeId: '',
      loanPurpose: '',
    },
  });

  const loanAmountValue = form.watch('loanAmount');

  function onFormSubmit(data: DistrictFormValues) {
    setValidationErrors([]);
    setSubmissionError(null);
    setFormDataToSubmit(data);
    setIsConfirming(true);
  }

  function onFormInvalid(errors: FieldErrors<DistrictFormValues>) {
    const fieldLabels: Record<keyof DistrictFormValues, string> = {
      customerName: 'Customer Name',
      customerEmail: 'Customer Email',
      customerPhone: 'Customer Phone',
      customerBranch: 'Branch',
      loanAmount: 'Loan Amount',
      sectorId: 'Sector',
      requestTypeId: 'Request Type',
      loanPurpose: 'Loan Purpose',
    };

    const messages = Object.entries(errors).map(([key, value]) => {
      const fieldKey = key as keyof DistrictFormValues;
      const message = value?.message ? String(value.message) : 'This field is required.';
      return `${fieldLabels[fieldKey]}: ${message}`;
    });

    setSubmissionError(null);
    setValidationErrors(messages);
    const firstField = Object.keys(errors)[0] as keyof DistrictFormValues | undefined;
    if (firstField) {
      form.setFocus(firstField);
    }
    // scroll to the error alert for visibility
    setTimeout(() => document.getElementById('loan-form-errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  const handleConfirmSubmit = async () => {
    if (!formDataToSubmit) return;
    setIsSubmitting(true);
    setIsConfirming(false);
    try {
      const result = await addType2LoanRequest(formDataToSubmit);
      if (result.error) {
        if (/unauthoriz/i.test(String(result.error))) {
          const friendly = 'Your session has expired or you are not signed in. Please sign in and try again.';
          setSubmissionError(friendly);
          toast({ title: "Session Required", description: friendly, variant: "destructive" });
        } else {
          setSubmissionError(result.error);
          toast({ title: "Error", description: result.error, variant: "destructive" });
        }
      } else {
        toast({ title: "Success", description: "District Loan Request submitted successfully." });
        router.push(`/district/submitted-cases`);
      }
    } catch (err: any) {
      setSubmissionError(err.message);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const getSectorName = (id: string) => sectors.find(s => s.id === id)?.name || id;
  const getRequestTypeName = (id: string) => requestTypes.find(rt => rt.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <ClipboardCheck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">District Loan Submission</h1>
            <p className="text-muted-foreground mt-1">Submit a new loan application on behalf of a district branch. This enters the Secretary → Business Manager workflow pipeline.</p>
          </div>
        </div>
        <Link href="/loan-requests/new" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Selection</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applicant & Loan Information</CardTitle>
          <CardDescription>All fields are required unless marked otherwise.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit, onFormInvalid)} className="space-y-8">
              {(validationErrors.length > 0 || submissionError) && (
                <Alert id="loan-form-errors" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Please fix the following issues before submitting:</AlertTitle>
                  <div className="text-sm mt-2 space-y-1">
                    {validationErrors.length > 0 ? (
                      validationErrors.map((msg, idx) => <p key={idx}>{msg}</p>)
                    ) : (
                      <p>{submissionError}</p>
                    )}
                  </div>
                </Alert>
              )}

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
                          <Input placeholder="email@example.com" {...field} className="pl-10" disabled={isSubmitting} />
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
                          <Input placeholder="e.g., 0912345678" {...field} className="pl-10" disabled={isSubmitting} />
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
                      <FormControl>
                        <Combobox
                          options={crmBranches.map(b => ({ label: `${b.name} (${b.districtName})`, value: b.name }))}
                          value={field.value}
                          onSelect={field.onChange}
                          placeholder="Select Branch"
                          searchPlaceholder="Search branches..."
                          className={cn("w-full", form.formState.errors.customerBranch && "border-destructive")}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription>Select the branch this application belongs to.</FormDescription>
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
                        <Input 
                           type="number" 
                           placeholder="e.g., 10000" 
                           {...field} 
                           value={field.value || ''}
                           onChange={e => {
                             const val = e.target.value;
                             field.onChange(val === '' ? '' : Number(val));
                           }}
                           disabled={isSubmitting} 
                        />
                      </FormControl>
                       {loanAmountValue > 0 && (
                        <FormDescription>
                          <span className="block font-semibold text-primary">{loanAmountValue.toLocaleString()} ETB</span>
                          <span className="block italic">{numberToWords(loanAmountValue)}</span>
                          {loanAmountValue > 20000000 && (
                            <span className="block mt-2 p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs font-medium animate-pulse">
                              Reminder: District loan process is usually limited to 20 million ETB.
                            </span>
                          )}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sectorId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Child Sector</FormLabel>
                      <FormControl>
                        <Combobox
                          options={sectors.filter(s => s.parentId).map(s => ({ label: s.name, value: s.id }))}
                          value={field.value}
                          onSelect={field.onChange}
                          placeholder="Select Sector"
                          searchPlaceholder="Search sectors..."
                          className={cn("w-full", form.formState.errors.sectorId && "border-destructive")}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormDescription>The selected sector will determine the district committee routing.</FormDescription>
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
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select Request Type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {requestTypes.map(rt => (
                            <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
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
                    <div className="relative">
                      <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Textarea placeholder="Describe the purpose of the loan..." className="resize-none pl-10" {...field} disabled={isSubmitting} />
                      </FormControl>
                    </div>
                    <FormDescription>Provide a clear and concise reason for the loan application.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full sm:w-auto h-11 px-8 text-base font-semibold transition-all group hover:shadow-lg hover:shadow-primary/20" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...</>
                ) : (
                  <>
                    <Send className="mr-2.5 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    Submit District Application
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {formDataToSubmit && (
        <Dialog open={isConfirming} onOpenChange={setIsConfirming}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center"><CheckCircle className="mr-2 h-6 w-6 text-primary"/>Confirm District Submission</DialogTitle>
              <DialogDescription>Are you sure you want to submit this District loan request? This will enter the District workflow and be forwarded to the District Business Manager for assignment.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-3">
                <h4 className="font-semibold text-lg border-b pb-2">Customer Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <p><strong className="block text-muted-foreground">Name</strong>{formDataToSubmit.customerName}</p>
                    <p><strong className="block text-muted-foreground">Email</strong>{formDataToSubmit.customerEmail}</p>
                    <p><strong className="block text-muted-foreground">Phone</strong>{formDataToSubmit.customerPhone}</p>
                    <p><strong className="block text-muted-foreground">Branch</strong>{formDataToSubmit.customerBranch}</p>
                </div>

                <h4 className="font-semibold text-lg border-b pb-2 pt-4">Loan Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <p><strong className="block text-muted-foreground">Amount</strong>{formDataToSubmit.loanAmount.toLocaleString()} ETB</p>
                    <p><strong className="block text-muted-foreground">Sector</strong>{getSectorName(formDataToSubmit.sectorId)}</p>
                    <p><strong className="block text-muted-foreground">Request Type</strong>{getRequestTypeName(formDataToSubmit.requestTypeId)}</p>
                </div>
                <div>
                    <strong className="block text-muted-foreground text-sm">Purpose</strong>
                    <p className="text-sm p-2 bg-muted/50 rounded-md mt-1">{formDataToSubmit.loanPurpose}</p>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : <Wallet className="mr-2 h-4 w-4"/>}
                Confirm & Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
