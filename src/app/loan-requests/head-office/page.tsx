
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller, type FieldErrors } from 'react-hook-form';
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
import { User as UserIcon, Mail, Phone, Info, Loader2, AlertCircle, ArrowLeft, Building, Network, CheckCircle, Wallet } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { addLoanRequest, getWorkflowDefinitions } from '@/services/loan-service-prisma';
import { getBranches } from '@/services/branch-service';
import type { Branch, Sector, WorkflowDefinition } from '@/types/loan';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { cn, isValidLocalEthiopianPhone, normalizeEthiopianPhone } from '@/lib/utils';
import Link from 'next/link';
import { getSectors, getRequestTypes } from '@/services/sector-and-request-type-service';
import type { ConfigurableListItem } from '@/services/sector-and-request-type-service';
import { Alert, AlertTitle } from '@/components/ui/alert';
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

const loanRequestFormSchema = z.object({
  customerName: z.string().trim().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().trim().min(1, { message: 'Customer email is required.' }).email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string().trim().min(1, { message: 'Customer phone is required.' })
    .transform(normalizeEthiopianPhone)
    .refine(isValidLocalEthiopianPhone, { message: 'Phone number must be in local format like 0912345678 or 0712345678.' }),
  customerBranch: z.string().trim().min(1, { message: 'A branch must be selected.' }),
  loanAmount: z.coerce.number({ required_error: 'Loan amount is required.', invalid_type_error: 'Loan amount must be a number.' }).positive({ message: 'Loan amount must be a positive number.' }),
  sectorId: z.string().trim().min(1, { message: 'A sector must be selected.' }),
  requestTypeId: z.string().trim().min(1, { message: 'A request type must be selected.' }),
  loanPurpose: z.string().trim().min(10, { message: 'Loan purpose must be at least 10 characters.' }),
});

type LoanRequestFormValues = z.infer<typeof loanRequestFormSchema>;

interface WorkflowInfo {
  parentSectorName?: string;
  initialDepartmentName?: string;
}

function RequiredMark() {
  return <span className="ml-1 text-destructive" aria-hidden="true">*</span>;
}

export default function HeadOfficeSubmissionPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [formDataToSubmit, setFormDataToSubmit] = useState<LoanRequestFormValues | null>(null);
  
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [requestTypes, setRequestTypes] = useState<ConfigurableListItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [workflowDefs, setWorkflowDefs] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflowInfo, setSelectedWorkflowInfo] = useState<WorkflowInfo | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  
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
        const [sectorsResult, requestTypesResult, branchesResult, wfResult] = await Promise.all([
          getSectors(),
          getRequestTypes(),
          getBranches(),
          getWorkflowDefinitions(),
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
        
        if (wfResult.error) {
            setError(prev => (prev ? `${prev}\n` : '') + `Workflows: ${wfResult.error}`);
        } else {
            setWorkflowDefs(wfResult.workflows || []);
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
  
  const handleSectorChange = (sectorId: string) => {
    form.setValue('sectorId', sectorId);
    const selectedChildSector = sectors.find(s => s.id === sectorId);
    if (!selectedChildSector) {
        setSelectedWorkflowInfo(null);
        return;
    }

    const parentSector = sectors.find(s => s.id === selectedChildSector.parentId);
    
    // Pick the newest WF-01 for this child sector path to avoid stale seeded duplicates.
    const firstWorkflow = workflowDefs
      .filter(wf => wf.sectorId === selectedChildSector.id && wf.name.startsWith('WF-01'))
      .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))[0];

    const firstStage = firstWorkflow?.versions.find(v => v.isActive)?.stages[0];

    setSelectedWorkflowInfo({
        parentSectorName: parentSector?.name,
      initialDepartmentName: firstStage?.responsibleDepartment || firstWorkflow?.departmentName,
    });
  };


  const form = useForm<LoanRequestFormValues>({
    resolver: zodResolver(loanRequestFormSchema),
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

  function onFormSubmit(data: LoanRequestFormValues) {
    setValidationErrors([]);
    setSubmissionError(null);
    setFormDataToSubmit(data);
    setIsConfirming(true);
  }

  function onFormInvalid(errors: FieldErrors<LoanRequestFormValues>) {
    const fieldLabels: Record<keyof LoanRequestFormValues, string> = {
      customerName: 'Customer Full Name',
      customerEmail: 'Customer Email',
      customerPhone: 'Customer Phone',
      customerBranch: 'Customer Branch',
      loanAmount: 'Loan Amount',
      sectorId: 'Child Sector',
      requestTypeId: 'Request Type',
      loanPurpose: 'Loan Purpose',
    };

    const messages = Object.entries(errors).map(([key, value]) => {
      const fieldKey = key as keyof LoanRequestFormValues;
      const message = value?.message ? String(value.message) : 'This field is required.';
      return `${fieldLabels[fieldKey]}: ${message}`;
    });

    setSubmissionError(null);
    setValidationErrors(messages);
    toast({
      title: 'Please fix the errors',
      description: 'One or more required fields are missing or invalid.',
      variant: 'destructive',
    });

    const firstField = Object.keys(errors)[0] as keyof LoanRequestFormValues | undefined;
    if (firstField) {
      form.setFocus(firstField);
    }

    setTimeout(() => document.getElementById('loan-form-errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  async function handleConfirmSubmit() {
    if (!formDataToSubmit) return;
    setIsSubmitting(true);
    setIsConfirming(false);
    try {
      const result = await addLoanRequest({
        ...formDataToSubmit,
        customerPhone: normalizeEthiopianPhone(formDataToSubmit.customerPhone),
      });

      if (result.error) {
        // Improve clarity for missing/expired user session
        if (/unauthoriz/i.test(String(result.error))) {
          const friendly = 'Your session has expired or you are not signed in. Please sign in and try again.';
          setSubmissionError(friendly);
          toast({ title: "Session Required", description: friendly, variant: "destructive", duration: 9000 });
        } else {
          setSubmissionError(result.error);
          toast({ title: "Submission Error", description: result.error, variant: "destructive", duration: 9000 });
        }
      } else if (result.id) {
        setValidationErrors([]);
        setSubmissionError(null);
        toast({ title: "Loan Request Submitted", description: "Loan request submitted successfully." });
        form.reset();
        setFormDataToSubmit(null);
        router.push('/loan-process');
      } else {
        toast({ title: "Submission Error", description: "An unexpected issue occurred.", variant: "destructive" });
      }
    } catch (error: any) {
      setSubmissionError(error.message || 'Unexpected error during submission.');
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
  
  const getLabelForValue = (options: {value: string, label: string}[], value: string) => {
    return options.find(opt => opt.value === value)?.label || value;
  };
  const getSectorName = (id: string) => sectors.find(s => s.id === id)?.name || id;
  const getRequestTypeName = (id: string) => requestTypes.find(rt => rt.id === id)?.name || id;


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Head Office Loan Submission</h1>
          <p className="text-muted-foreground">
            Fill in the details below to submit a new loan application for Head Office processing.
          </p>
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
                <Alert id="loan-form-errors" variant="destructive" role="alert" aria-live="assertive" tabIndex={-1}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Please fix the following issues before submitting:</AlertTitle>
                  <div className="text-sm mt-2 space-y-1">
                    {validationErrors.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {validationErrors.map((msg, idx) => <li key={idx}>{msg}</li>)}
                      </ul>
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
                      <FormLabel>Customer Full Name<RequiredMark /></FormLabel>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input placeholder="e.g., John Doe" {...field} className={cn("pl-10", form.formState.errors.customerName && "border-destructive focus-visible:ring-destructive")} disabled={isSubmitting} />
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
                      <FormLabel>Customer Email<RequiredMark /></FormLabel>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input type="email" placeholder="e.g., john.doe@example.com" {...field} className={cn("pl-10", form.formState.errors.customerEmail && "border-destructive focus-visible:ring-destructive")} disabled={isSubmitting} />
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
                      <FormLabel>Customer Phone<RequiredMark /></FormLabel>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input type="tel" placeholder="e.g., 0912345678" {...field} onChange={(event) => field.onChange(normalizeEthiopianPhone(event.target.value))} className={cn("pl-10", form.formState.errors.customerPhone && "border-destructive focus-visible:ring-destructive")} disabled={isSubmitting} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerBranch"
                  render={({ field, fieldState }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Customer Branch<RequiredMark /></FormLabel>
                      <Combobox
                        options={branchOptions}
                        value={field.value}
                        onSelect={field.onChange}
                        placeholder={isLoading ? "Loading branches..." : "Select a branch"}
                        searchPlaceholder="Search branch..."
                        notFoundText={error?.includes('Branches') ? "Error loading branches" : "No branch found."}
                        className={cn("w-full", fieldState.invalid && "border-destructive")}
                        disabled={isSubmitting}
                      />
                      {error?.includes('Branches') && <p className="text-sm text-destructive mt-2">Could not load branches. Please ensure they are configured in settings.</p>}
                      {fieldState.error?.message ? (
                        <p className="text-[0.8rem] font-medium text-destructive">{fieldState.error.message}</p>
                      ) : (
                        <FormMessage />
                      )}
                    </FormItem>
                  )}
                />

                 <FormField
                  control={form.control}
                  name="loanAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Amount<RequiredMark /></FormLabel>
                       <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 10000"
                          {...field}
                          className={cn(form.formState.errors.loanAmount && "border-destructive focus-visible:ring-destructive")}
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
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sectorId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Child Sector<RequiredMark /></FormLabel>
                      <Select onValueChange={handleSectorChange} defaultValue={field.value} disabled={isSubmitting || childSectorOptions.length === 0}>
                        <FormControl>
                          <SelectTrigger className={cn(fieldState.invalid && "border-destructive focus:ring-destructive")}>
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
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Request Type<RequiredMark /></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting || requestTypes.length === 0}>
                        <FormControl>
                          <SelectTrigger className={cn(fieldState.invalid && "border-destructive focus:ring-destructive")}>
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

                {selectedWorkflowInfo && (
                  <Alert className="md:col-span-2 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
                    <Network className="h-4 w-4 text-blue-600 dark:text-blue-400"/>
                    <AlertTitle className="text-blue-800 dark:text-blue-300">Workflow Routing Information</AlertTitle>
                    <div className="text-sm text-blue-700 dark:text-blue-300/90 space-y-1 mt-2">
                        <p><strong>Parent Sector:</strong> {selectedWorkflowInfo.parentSectorName || 'N/A'}</p>
                        <p><strong>Initial Department:</strong> {selectedWorkflowInfo.initialDepartmentName || 'Not configured'}</p>
                    </div>
                  </Alert>
                )}
              </div>

              <FormField
                control={form.control}
                name="loanPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Purpose<RequiredMark /></FormLabel>
                    <div className="relative">
                      <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Textarea placeholder="Briefly describe the purpose of the loan..." className={cn("resize-none pl-10", form.formState.errors.loanPurpose && "border-destructive focus-visible:ring-destructive")} {...field} disabled={isSubmitting} />
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
                disabled={isSubmitting}
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
      
      {formDataToSubmit && (
        <Dialog open={isConfirming} onOpenChange={setIsConfirming}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center"><CheckCircle className="mr-2 h-6 w-6 text-primary"/>Confirm Loan Request Details</DialogTitle>
                    <DialogDescription>Please review the information below before final submission.</DialogDescription>
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

                    <h4 className="font-semibold text-lg border-b pb-2 pt-4">Workflow Routing</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <p><strong className="block text-muted-foreground">Parent Sector</strong>{selectedWorkflowInfo?.parentSectorName || 'N/A'}</p>
                        <p><strong className="block text-muted-foreground">Initial Department</strong>{selectedWorkflowInfo?.initialDepartmentName || 'N/A'}</p>
                    </div>

                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wallet className="mr-2 h-4 w-4"/>}
                        Confirm & Submit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
