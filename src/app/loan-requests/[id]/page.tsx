
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit3, PlusCircle, FileText, CheckCircle, XCircle, AlertCircle, Clock, Landmark, User, DollarSign, Type, Info, FileSymlink, Paperclip, Phone, UploadCloud, BadgeCheck, Edit, MessageSquare, Loader2, StickyNote } from 'lucide-react';
import type { LoanRequest, LoanDocument, LoanHistoryEntry, User as UserType } from '@/types/loan';
import { LoanStage, UserRole } from '@/types/loan';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatISO } from 'date-fns';
import { Progress } from '@/components/ui/progress';
// Removed: import { loanStages } from '@/types/loan';
import { initialStageConfigs, type StageConfig } from '@/app/settings/page'; 
import { mockUsers } from '@/lib/mock-data'; 
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription as FormDesc,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { getLoanRequestById, updateLoanRequest } from '@/services/loan-service'; 
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const editLoanFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  loanAmount: z.coerce.number().positive({ message: 'Loan amount must be a positive number.' }),
  loanType: z.string().min(2, { message: 'Loan type is required.' }),
  loanPurpose: z.string().min(10, { message: 'Loan purpose must be at least 10 characters.' }),
  assignedTo: z.string().optional(), 
});

type EditLoanFormValues = z.infer<typeof editLoanFormSchema>;

const getStageColor = (stage: LoanStage) => {
  switch (stage) {
    case LoanStage.APPLICATION_SUBMITTED: return 'bg-sky-500';
    case LoanStage.DOCUMENT_COLLECTION: return 'bg-blue-500';
    case LoanStage.UNDER_REVIEW: return 'bg-indigo-500';
    case LoanStage.ADDITIONAL_INFO_REQUIRED: return 'bg-yellow-500 text-black';
    case LoanStage.APPROVED: return 'bg-green-500';
    case LoanStage.REJECTED: return 'bg-red-500';
    case LoanStage.FUNDS_DISBURSED: return 'bg-emerald-600';
    default: return 'bg-gray-500';
  }
};

const getDocumentStatusIcon = (status: LoanDocument['status'] | 'Missing') => {
  switch (status) {
    case 'Pending': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'Submitted': return <FileSymlink className="h-4 w-4 text-blue-500" />;
    case 'Verified': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'Rejected': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'Missing': return <FileText className="h-4 w-4 text-gray-400" />;
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

const getDocumentBadgeVariant = (status: LoanDocument['status'] | 'Missing'): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Verified': return 'default';
    case 'Submitted': return 'secondary';
    case 'Pending': return 'outline';
    case 'Rejected': return 'destructive';
    case 'Missing': return 'outline';
    default: return 'outline';
  }
};


export default function LoanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const loanId = params.id as string;

  const [loan, setLoan] = useState<LoanRequest | null>(null);
  const [users, setUsers] = useState<UserType[]>(mockUsers); 
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isAddInfoDialogOpen, setIsAddInfoDialogOpen] = useState(false);
  const [isUploadDocDialogOpen, setIsUploadDocDialogOpen] = useState(false);
  const [currentDocumentToUpload, setCurrentDocumentToUpload] = useState<string | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isEditLoanDialogOpen, setIsEditLoanDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  const form = useForm<EditLoanFormValues>({
    resolver: zodResolver(editLoanFormSchema),
  });

  useEffect(() => {
    if (loanId) {
      const fetchLoan = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const result = await getLoanRequestById(loanId); 
          if (result.error) {
            console.error("Error from getLoanRequestById service:", result.error, result);
            setError(result.error);
            setLoan(null);
          } else if (result.loan) {
            setLoan(result.loan);
            // Users are now part of the result from getLoanRequestById mock service
            setUsers(result.users || mockUsers); // Fallback to direct mockUsers if service doesn't return them
          } else {
            setError(`Loan request with ID "${loanId}" not found.`);
            setLoan(null);
          }
        } catch (err: any) {
          console.error("Error fetching loan details:", err);
          const errorMessage = err.message || "An unexpected error occurred while fetching loan data.";
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchLoan();
    }
  }, [loanId]);

  useEffect(() => {
    if (loan && isEditLoanDialogOpen) {
      form.reset({
        customerName: loan.customerName,
        customerEmail: loan.customerEmail,
        customerPhone: loan.customerPhone,
        loanAmount: loan.loanAmount,
        loanType: loan.loanType,
        loanPurpose: loan.loanPurpose,
        assignedTo: loan.assignedTo || '',
      });
    }
  }, [loan, isEditLoanDialogOpen, form]);

  const handleDatabaseUpdate = async (
    updatedFields: Partial<Omit<LoanRequest, 'id'>>,
    successMessage: string
  ) => {
    if (!loan) return false;
    setIsSaving(true);
    
    const currentLoanState = { ...loan }; // Backup current state

    // Optimistic UI update
    setLoan(prev => prev ? { ...prev, ...updatedFields, lastUpdatedDate: formatISO(new Date()) } : null);

    try {
      const result = await updateLoanRequest(loan.id, updatedFields); 
      if (result.error || !result.success) {
        setLoan(currentLoanState); // Revert optimistic update on error
        toast({
          title: "Update Error",
          description: result.error || "Failed to update loan.",
          variant: "destructive",
        });
        setIsSaving(false);
        return false;
      }
      // If success, the updatedLoan from service response will be set
      if (result.updatedLoan) {
        setLoan(result.updatedLoan); 
      }
      toast({
        title: "Update Successful",
        description: successMessage,
        variant: "default",
      });
      setIsSaving(false);
      return true;
    } catch (err: any) {
      setLoan(currentLoanState); // Revert optimistic update on critical error
      toast({
        title: "System Error",
        description: err.message || "A critical error occurred during update.",
        variant: "destructive",
      });
      setIsSaving(false);
      return false;
    }
  };


  const handleAddInfoSubmit = async () => {
    if (!additionalInfo.trim()) {
        toast({ title: "Info Required", description: "Please specify what information is needed.", variant: "destructive" });
        return;
    }
    if (!loan) return;

    const newHistoryEntry: LoanHistoryEntry = {
        id: `hist-mock-${Date.now()}`,
        stage: LoanStage.ADDITIONAL_INFO_REQUIRED,
        timestamp: formatISO(new Date()),
        userId: 'mock-user-id', 
        userName: 'Mock Bank User',
        requiredFulfilment: additionalInfo,
        notes: `Requested additional info: ${additionalInfo}`
    };

    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
        currentStage: LoanStage.ADDITIONAL_INFO_REQUIRED,
        history: [...loan.history, newHistoryEntry],
    };

    const success = await handleDatabaseUpdate(updatedFields, "Information request action recorded (mock).");
    if (success) {
        setAdditionalInfo('');
        setIsAddInfoDialogOpen(false);
    }
  };

  const handleFulfillInfoRequest = async (entryId: string, requirementText: string) => {
    if (!loan) return;

    const updatedHistory = loan.history.map(h =>
        h.id === entryId
            ? { ...h, notes: `${h.notes || ''}\n[FULFILLED MOCK] by customer on ${new Date().toLocaleDateString()}. Requirement: ${requirementText}` }
            : h
    );
    updatedHistory.push({
        id: `hist-mock-${Date.now()}`,
        stage: loan.currentStage, 
        timestamp: formatISO(new Date()),
        userId: 'mock-user-id',
        userName: 'Mock Bank User',
        notes: `Information received for requirement: "${requirementText}". Ready for re-evaluation (mock).`
    });

    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
        history: updatedHistory,
    };

    await handleDatabaseUpdate(updatedFields, "Information fulfillment status updated (mock).");
  };

  const handleAddNoteSubmit = async () => {
    if (!noteContent.trim()) {
      toast({ title: "Note Required", description: "Please enter some content for the note.", variant: "destructive" });
      return;
    }
    if (!loan) return;

    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`,
      stage: loan.currentStage, 
      timestamp: formatISO(new Date()),
      userId: 'mock-user-id',
      userName: 'Mock Bank User',
      notes: noteContent,
    };

    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
      history: [...loan.history, newHistoryEntry],
    };

    const success = await handleDatabaseUpdate(updatedFields, "Note added to loan history (mock).");
    if (success) {
        setNoteContent('');
        setIsAddNoteDialogOpen(false);
    }
  };

  const activeInfoRequestEntry = loan?.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED
  ? [...loan.history]
    .reverse()
    .find(entry => entry.stage === LoanStage.ADDITIONAL_INFO_REQUIRED && entry.requiredFulfilment && (!entry.notes || !entry.notes.includes("[FULFILLED MOCK]")))
  : undefined;

  const handleAdvanceWorkflow = async (nextStage: LoanStage) => {
    if (!loan) return;

    if (loan.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED) {
      if (activeInfoRequestEntry) {
        toast({
          title: "Action Pending",
          description: `Outstanding action: '${activeInfoRequestEntry.requiredFulfilment}' must be marked as received before advancing.`,
          variant: "destructive",
          duration: 7000,
        });
        return;
      }
    }

    const currentStageConfigFromSettings: StageConfig | undefined = initialStageConfigs.find(
      (config) => config.loanStageEnum === loan.currentStage
    );

    if (currentStageConfigFromSettings && currentStageConfigFromSettings.requiredDocuments.length > 0) {
      const pendingDocuments = currentStageConfigFromSettings.requiredDocuments.filter(reqDoc => {
        const uploadedDoc = loan.documents.find(d => d.name === reqDoc.name);
        return !uploadedDoc || uploadedDoc.status !== 'Verified';
      });

      if (pendingDocuments.length > 0) {
        toast({
          title: "Documents Pending Verification",
          description: `The following documents for stage '${loan.currentStage}' must be verified: ${pendingDocuments.map(d => d.name).join(', ')}.`,
          variant: "destructive",
          duration: 7000,
        });
        return;
      }
    }

    let newAssignedTo = loan.assignedTo; 
    const nextStageConfig: StageConfig | undefined = initialStageConfigs.find(
        (config) => config.loanStageEnum === nextStage
    );

    if (nextStageConfig && nextStageConfig.targetRoleForStage) {
        const potentialAssignees = users.filter(u => u.role === nextStageConfig.targetRoleForStage);
        if (potentialAssignees.length > 0) {
            newAssignedTo = potentialAssignees[0].id; 
        }
    } else if (!newAssignedTo) { // Fallback if still unassigned
      const relationshipManagers = users.filter(u => u.role === UserRole.RELATIONSHIP_MANAGER);
      if (relationshipManagers.length > 0) {
        newAssignedTo = relationshipManagers[0].id;
      }
    }

    const newHistoryEntry: LoanHistoryEntry = {
        id: `hist-mock-${Date.now()}`,
        stage: nextStage,
        timestamp: formatISO(new Date()),
        userId: 'mock-user-id',
        userName: 'Mock Bank User',
        notes: `Moved to stage: ${nextStage} (mock). ${newAssignedTo && newAssignedTo !== loan.assignedTo ? `Assigned to ${users.find(u=>u.id === newAssignedTo)?.name || 'Unknown'}.` : (newAssignedTo && !loan.assignedTo) ? `Assigned to ${users.find(u=>u.id === newAssignedTo)?.name || 'Unknown'}.` : ''}`
    };

    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
        currentStage: nextStage,
        history: [...loan.history, newHistoryEntry],
        assignedTo: newAssignedTo, 
    };

    await handleDatabaseUpdate(updatedFields, `Workflow advanced to ${nextStage} (mock).`);
  };

  const handleUploadDocument = async (docName: string) => {
    if (!loan) return;
    
    const existingDocIndex = loan.documents.findIndex(d => d.name === docName);
    let updatedDocuments: LoanDocument[];
    if (existingDocIndex > -1) {
        updatedDocuments = loan.documents.map((doc, index) =>
            index === existingDocIndex ? { ...doc, status: 'Submitted', notes: 'File re-uploaded (mock).' } : doc
        );
    } else {
        updatedDocuments = [
            ...loan.documents,
            { id: `doc-mock-${Date.now()}`, name: docName, status: 'Submitted', notes: 'File uploaded (mock).' }
        ];
    }

    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
        documents: updatedDocuments,
    };

    const success = await handleDatabaseUpdate(updatedFields, `Document ${docName} status updated to 'Submitted' (mock).`);
    if (success) {
        setIsUploadDocDialogOpen(false);
        setCurrentDocumentToUpload(null);
    }
  };

  const handleVerifyDocument = async (docName: string) => {
    if (!loan) return;
    const updatedDocuments = loan.documents.map(doc =>
        doc.name === docName ? { ...doc, status: 'Verified', notes: 'Document verified (mock).' } : doc
    );
    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
        documents: updatedDocuments,
    };
    await handleDatabaseUpdate(updatedFields, `Document ${docName} status updated to 'Verified' (mock).`);
  };

  async function onEditLoanSubmit(data: EditLoanFormValues) {
    if (!loan) return;

    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      loanAmount: Number(data.loanAmount),
      loanType: data.loanType,
      loanPurpose: data.loanPurpose,
      assignedTo: data.assignedTo || undefined,
    };

    const success = await handleDatabaseUpdate(updatedFields, "Loan details updated (mock).");
    if (success) {
        setIsEditLoanDialogOpen(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading loan details...</p>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Error Loading Loan</h1>
        <p className="text-muted-foreground mb-6 break-words whitespace-pre-wrap">
          {error || `The loan request with ID "${loanId}" could not be found.`}
        </p>
        <Button onClick={() => router.push('/loan-process')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to Loan Pipeline
        </Button>
      </div>
    );
  }

  const currentStageEnum = loan.currentStage;
  let progressPercentage = 0;

  if (currentStageEnum === LoanStage.FUNDS_DISBURSED) {
      progressPercentage = 100;
  } else if (currentStageEnum === LoanStage.REJECTED) {
      let cumulativeWeight = 0;
      for (const stageCfg of initialStageConfigs) {
          if (stageCfg.loanStageEnum === LoanStage.REJECTED) {
              break; 
          }
          cumulativeWeight += Number(stageCfg.percentageWeight) || 0;
      }
      progressPercentage = cumulativeWeight;
  } else {
      let cumulativeWeight = 0;
      let stageFoundInConfig = false;
      for (const stageCfg of initialStageConfigs) {
          cumulativeWeight += Number(stageCfg.percentageWeight) || 0;
          if (stageCfg.loanStageEnum === currentStageEnum) {
              stageFoundInConfig = true;
              break;
          }
      }
      progressPercentage = stageFoundInConfig ? cumulativeWeight : 0; 
  }
  progressPercentage = Math.min(100, Math.max(0, progressPercentage));


  const currentStageConfig: StageConfig | undefined = initialStageConfigs.find(
    (config) => config.loanStageEnum === loan.currentStage
  );
  const requiredDocumentsForCurrentStage = currentStageConfig?.requiredDocuments || [];
  
  const assignedManager = users.find(u => u.id === loan.assignedTo);
  
  // Determine next logical stage for "Advance to" button
  let nextLogicalStage: LoanStage | null = null;
  const currentConfigIndex = initialStageConfigs.findIndex(config => config.loanStageEnum === loan.currentStage);
  if (currentConfigIndex !== -1 && currentConfigIndex < initialStageConfigs.length - 1) {
    // Find next non-rejected stage
    for (let i = currentConfigIndex + 1; i < initialStageConfigs.length; i++) {
        if (initialStageConfigs[i].loanStageEnum !== LoanStage.REJECTED) {
            nextLogicalStage = initialStageConfigs[i].loanStageEnum;
            break;
        }
    }
  }


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()} disabled={isSaving}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isEditLoanDialogOpen} onOpenChange={setIsEditLoanDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isSaving}><Edit className="mr-2 h-4 w-4" /> Edit Details</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Loan Details</DialogTitle>
                <DialogDescription>
                  Modify the loan application information below. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEditLoanSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="e.g., John Doe" {...field} className="pl-10" disabled={isSaving} />
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
                              <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input type="email" placeholder="e.g., john.doe@example.com" {...field} className="pl-10" disabled={isSaving} />
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
                              <Input type="tel" placeholder="e.g., (555) 123-4567" {...field} className="pl-10" disabled={isSaving} />
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
                              <Input type="number" placeholder="e.g., 10000" {...field} className="pl-10" disabled={isSaving} />
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
                              <Input placeholder="e.g., Personal, Mortgage, Auto" {...field} className="pl-10" disabled={isSaving} />
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
                          <FormLabel>Assign to User</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSaving}>
                            <FormControl>
                               <div className="relative">
                                <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <SelectTrigger className="pl-10">
                                    <SelectValue placeholder="Select a user" />
                                </SelectTrigger>
                               </div>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Unassigned</SelectItem>
                              {users.map(user => ( 
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name} ({user.role})
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
                              rows={3}
                              disabled={isSaving}
                            />
                          </div>
                        </FormControl>
                        <FormDesc>
                          Provide a clear and concise reason for the loan application.
                        </FormDesc>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isSaving}><StickyNote className="mr-2 h-4 w-4" /> Add Note</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Note to Loan History</DialogTitle>
                <DialogDescription>
                  Enter any relevant notes or log activity for this loan. This will not change the current stage.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Label htmlFor="note-content">Note</Label>
                <Textarea
                  id="note-content"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="e.g., Spoke with customer, clarified income details. Follow up next week."
                  rows={4}
                  disabled={isSaving}
                />
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
                  </DialogClose>
                <Button type="submit" onClick={handleAddNoteSubmit} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Note
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddInfoDialogOpen} onOpenChange={setIsAddInfoDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={isSaving || loan.currentStage === LoanStage.FUNDS_DISBURSED || loan.currentStage === LoanStage.REJECTED}><Edit3 className="mr-2 h-4 w-4" /> Request Info</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Additional Information</DialogTitle>
                <DialogDescription>
                  Specify what the customer needs to provide. This will move the loan to 'Additional Info Required'.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Label htmlFor="additional-info">Information to Fulfill</Label>
                <Textarea
                  id="additional-info"
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="e.g., Latest utility bill, Clarification on income source"
                  disabled={isSaving}
                />
              </div>
              <DialogFooter>
                 <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
                  </DialogClose>
                <Button type="submit" onClick={handleAddInfoSubmit} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm & Request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {nextLogicalStage &&
           loan.currentStage !== LoanStage.REJECTED &&
           loan.currentStage !== LoanStage.FUNDS_DISBURSED &&
           loan.currentStage !== LoanStage.APPROVED && (
            <Button onClick={() => handleAdvanceWorkflow(nextLogicalStage!)} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Advance to: {nextLogicalStage}
            </Button>
          )}
           {loan.currentStage !== LoanStage.APPROVED && 
            loan.currentStage !== LoanStage.REJECTED && 
            loan.currentStage !== LoanStage.FUNDS_DISBURSED && 
            initialStageConfigs.some(s => s.loanStageEnum === LoanStage.APPROVED) && (
              <Button 
                variant="default" 
                onClick={() => handleAdvanceWorkflow(LoanStage.APPROVED)} 
                disabled={isSaving} 
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve Loan
              </Button>
           )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle>
              <CardDescription>Loan Number: {loan.loanNumber} | Customer Number: {loan.customerNumber}</CardDescription>
            </div>
            <Badge className={`px-3 py-1.5 text-sm font-medium text-white ${getStageColor(loan.currentStage)}`}>
              {loan.currentStage}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-6">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Loan Progress</Label>
            <Progress value={progressPercentage} className="w-full mt-1 h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Submitted: {format(parseISO(loan.submittedDate), 'MMM dd, yyyy')}</span>
              {loan.stageDeadline && (
                <span className={loan.isOverdue ? "text-destructive font-semibold" : ""}>
                  <Clock className="inline h-3 w-3 mr-1" />
                  Stage Deadline: {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}
                  {loan.isOverdue && " (Overdue)"}
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <InfoItem icon={<DollarSign />} label="Loan Amount" value={`$${loan.loanAmount.toLocaleString()}`} />
            <InfoItem icon={<Type />} label="Loan Type" value={loan.loanType} />
            <InfoItem icon={<Info />} label="Loan Purpose" value={loan.loanPurpose} />
            <InfoItem icon={<User />} label="Customer Email" value={loan.customerEmail} />
            <InfoItem icon={<Phone />} label="Customer Phone" value={loan.customerPhone} />
            {assignedManager ? (
              <InfoItem icon={<Landmark />} label="Currently Assigned To" value={`${assignedManager.name} (${assignedManager.role})`} />
            ) : (
              <InfoItem icon={<Landmark />} label="Currently Assigned To" value="N/A" />
            )}
          </div>

          <Separator className="my-8" />

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center"><Paperclip className="mr-2 h-5 w-5 text-primary" />Documents</h3>
              <p className="text-sm text-muted-foreground mb-1">Required for current stage: <span className="font-semibold">{loan.currentStage}</span></p>
              {requiredDocumentsForCurrentStage.length > 0 ? (
                <ul className="space-y-3 mb-4">
                  {requiredDocumentsForCurrentStage.map(reqDoc => {
                    const uploadedDoc = loan.documents.find(d => d.name === reqDoc.name);
                    const status = uploadedDoc ? uploadedDoc.status : 'Missing';
                    return (
                      <li key={reqDoc.id} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/50 transition-colors">
                        <div className="flex items-center">
                          {getDocumentStatusIcon(status)}
                          <span className="ml-2">{reqDoc.name}</span>
                           {status === 'Missing' && <Badge variant="outline" className="ml-2 text-xs border-dashed">Missing</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={getDocumentBadgeVariant(status)}
                            className={status === 'Verified' ? 'bg-green-100 text-green-700 border-green-300' : status === 'Rejected' ? 'bg-red-100 text-red-700 border-red-300' : ''}
                          >
                            {status}
                          </Badge>
                          {status === 'Missing' || status === 'Pending' || status === 'Rejected' ? (
                            <Button variant="outline" size="sm" onClick={() => { setCurrentDocumentToUpload(reqDoc.name); setIsUploadDocDialogOpen(true); }} disabled={isSaving}>
                              {isSaving && currentDocumentToUpload === reqDoc.name ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-1 h-4 w-4" />} Upload
                            </Button>
                          ) : status === 'Submitted' ? (
                             <Button variant="outline" size="sm" onClick={() => handleVerifyDocument(reqDoc.name)} disabled={isSaving}>
                              {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <BadgeCheck className="mr-1 h-4 w-4" />} Verify
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground p-3 border rounded-md bg-background">No specific documents formally required for this stage in settings.</p>
              )}

              <Dialog open={isUploadDocDialogOpen} onOpenChange={(isOpen) => { setIsUploadDocDialogOpen(isOpen); if (!isOpen) setCurrentDocumentToUpload(null);}}>
                  <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Document: {currentDocumentToUpload || "General Upload"}</DialogTitle>
                        <DialogDescription>
                            {currentDocumentToUpload ? `Upload the file for "${currentDocumentToUpload}".` : "Select a file to upload."} (Mock: Actual file upload not implemented)
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                          <Label htmlFor="doc-upload">Select file</Label>
                          <Input id="doc-upload" type="file" className="mt-1" disabled={isSaving}/>
                          <p className="text-xs text-muted-foreground mt-2">Actual file handling & upload to storage not implemented. This simulates document status change.</p>
                      </div>
                      <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline" disabled={isSaving} >Cancel</Button>
                          </DialogClose>
                          <Button onClick={() => {
                            if(currentDocumentToUpload) {
                                handleUploadDocument(currentDocumentToUpload);
                            } else {
                                toast({title: "Error", description: "No document type specified for upload.", variant: "destructive"});
                            }
                          }}
                          disabled={isSaving}
                          >
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Simulate Upload
                          </Button>
                      </DialogFooter>
                  </DialogContent>
              </Dialog>

              {loan.documents.filter(doc => !requiredDocumentsForCurrentStage.find(rd => rd.name === doc.name)).length > 0 && (
                <>
                  <Separator className="my-4"/>
                  <h4 className="text-md font-semibold mb-2">Other Uploaded Documents</h4>
                  <ul className="space-y-2">
                    {loan.documents.filter(doc => !requiredDocumentsForCurrentStage.find(rd => rd.name === doc.name)).map(doc => (
                       <li key={doc.id} className="flex items-center justify-between p-3 border rounded-md bg-background/50 text-sm">
                         <div className="flex items-center">
                           {getDocumentStatusIcon(doc.status)} <span className="ml-2">{doc.name}</span>
                         </div>
                         <Badge variant={getDocumentBadgeVariant(doc.status)}>{doc.status}</Badge>
                       </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" />History & Timeline</h3>
              {loan.history.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {loan.history.slice().reverse().map(entry => (
                    <HistoryEntryItem
                      key={entry.id}
                      entry={entry}
                      isActiveInfoRequest={activeInfoRequestEntry?.id === entry.id}
                      onFulfillInfoRequest={handleFulfillInfoRequest}
                      isSaving={isSaving}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No history entries for this loan yet.</p>
              )}
            </div>
          </div>
        </CardContent>
         <CardFooter className="p-6 border-t">
            <p className="text-xs text-muted-foreground">
                Last Updated: {loan.lastUpdatedDate ? format(parseISO(loan.lastUpdatedDate), 'PPpp') : 'N/A'}
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}
const InfoItem = ({ icon, label, value }: InfoItemProps) => (
  <div className="flex items-start space-x-3">
    <div className="flex-shrink-0 text-primary pt-1">{React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}</div>
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

interface HistoryEntryItemProps {
  entry: LoanHistoryEntry;
  isActiveInfoRequest?: boolean;
  onFulfillInfoRequest?: (entryId: string, requirementText: string) => void;
  isSaving?: boolean;
}
const HistoryEntryItem = ({ entry, isActiveInfoRequest, onFulfillInfoRequest, isSaving }: HistoryEntryItemProps) => (
  <div className="relative pl-6 pb-4 border-l border-border">
    <div className={`absolute -left-[0.30rem] top-1 w-2.5 h-2.5 rounded-full ${getStageColor(entry.stage)}`}></div>
    <p className="text-sm font-medium">{entry.stage}</p>
    <p className="text-xs text-muted-foreground">
      {format(parseISO(entry.timestamp), 'MMM dd, yyyy, HH:mm')} by {entry.userName}
    </p>
    {entry.notes && <p className="text-sm mt-1 bg-background p-2 rounded-md border whitespace-pre-wrap">{entry.notes}</p>}
    {entry.requiredFulfilment && (
      <div className={`text-sm mt-1 p-2 rounded-md border ${isActiveInfoRequest ? 'border-amber-500 bg-amber-50 text-amber-700' : 'bg-muted/50'}`}>
        <span className="font-semibold">Required:</span> {entry.requiredFulfilment}
        {isActiveInfoRequest && onFulfillInfoRequest && entry.requiredFulfilment && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full sm:w-auto border-amber-600 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
            onClick={() => onFulfillInfoRequest(entry.id, entry.requiredFulfilment!)}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
            Mark Information Received
          </Button>
        )}
      </div>
    )}
  </div>
);

