
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { LoanRequest, User, LoanHistoryEntry } from '@/types/loan';
import { loanStages, LoanStage, UserRole } from '@/types/loan';
import { PlusCircle, AlertTriangle, Clock, Loader2, ArrowRight, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, formatISO } from 'date-fns';
import React, { useState, useEffect, useCallback } from 'react';
import { getLoanRequests, updateLoanRequest } from '@/services/loan-service';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription as AlertDescShadCN, AlertTitle as AlertTitleShadCN } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { initialStageConfigs } from '@/app/settings/page';
import { mockUsers } from '@/lib/mock-data';

const UNASSIGNED_DIALOG_OPTION_VALUE = "---UNASSIGNED-PIPELINE---";


interface LoanCardProps {
  loan: LoanRequest;
  onCardActionClick: (loan: LoanRequest) => void;
}

function LoanCard({ loan, onCardActionClick }: LoanCardProps) {
  const canTakeAction = ![LoanStage.REJECTED, LoanStage.FUNDS_DISBURSED].includes(loan.currentStage);
  const actionButtonText = loan.isReadyForManagerReview ? "Promote" : "Mark Complete";
  const ActionIcon = loan.isReadyForManagerReview ? ArrowRight : CheckSquare;

  return (
    <Card className="mb-3 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="p-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base font-semibold">
            <Link href={`/loan-requests/${loan.id}`} className="hover:underline">
              {loan.customerName}
            </Link>
          </CardTitle>
          {loan.isOverdue && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </TooltipTrigger>
                <TooltipContent><p>This loan process is overdue.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <CardDescription className="text-xs">{loan.loanNumber} / {loan.customerNumber}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 text-sm space-y-2">
        <p>Amount: ${loan.loanAmount.toLocaleString()}</p>
        <p>Type: {loan.loanType}</p>
        {loan.stageDeadline && (
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Deadline: {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}
          </div>
        )}
        {loan.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED && 
          loan.history && Array.isArray(loan.history) && // Ensure loan.history is an array
          loan.history.find(h => h.stage === LoanStage.ADDITIONAL_INFO_REQUIRED && h.requiredFulfilment && (!h.notes || !h.notes.includes("[FULFILLED MOCK]")))?.requiredFulfilment && (
          <Badge variant="outline" className="mt-2 text-amber-700 border-amber-500">
            Action Needed: {loan.history.find(h => h.stage === LoanStage.ADDITIONAL_INFO_REQUIRED && h.requiredFulfilment && (!h.notes || !h.notes.includes("[FULFILLED MOCK]")))?.requiredFulfilment}
          </Badge>
        )}
        {loan.isReadyForManagerReview && (
             <Badge variant="outline" className="mt-2 text-orange-600 border-orange-400 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300">
                Awaiting Manager Review
            </Badge>
        )}
         {canTakeAction && (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => onCardActionClick(loan)}>
            <ActionIcon className="mr-2 h-4 w-4" /> {actionButtonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanColumnProps {
  stage: LoanStage;
  loans: LoanRequest[];
  onCardActionClick: (loan: LoanRequest) => void;
}

function KanbanColumn({ stage, loans, onCardActionClick }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-80 bg-muted/50 rounded-lg p-1 md:p-2 min-h-[300px]">
      <div className="flex justify-between items-center p-2 mb-2">
        <h3 className="font-semibold text-foreground">{stage}</h3>
        <Badge variant="secondary">{loans.length}</Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-20rem)] pr-2">
        {loans.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground p-4 text-center">
            <p>No loan requests in this stage.</p>
          </div>
        )}
        {loans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} onCardActionClick={onCardActionClick} />
        ))}
      </ScrollArea>
    </div>
  );
}

interface PipelinePromoteDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    selectedLoan: LoanRequest | null;
    onConfirmPromotion: (loanId: string, nextStage: LoanStage) => Promise<void>;
    isSavingPromotion: boolean;
    validateCurrentStageRequirements: (loan: LoanRequest) => boolean;
}

function PipelinePromoteDialog({
    isOpen, onOpenChange, selectedLoan,
    onConfirmPromotion, isSavingPromotion, validateCurrentStageRequirements
}: PipelinePromoteDialogProps) {
    const [selectedNextStage, setSelectedNextStage] = useState<LoanStage | ''>('');

    useEffect(() => {
        if (isOpen && selectedLoan) {
            setSelectedNextStage('');
        }
    }, [isOpen, selectedLoan]);
    
    const availableNextStages = (currentStage: LoanStage | undefined): LoanStage[] => {
        if (!currentStage) return [];
        const currentIndex = loanStages.indexOf(currentStage);
        if (currentIndex === -1) return [];
        const nextStages = loanStages.filter((stage, index) => index > currentIndex);
        if (currentStage !== LoanStage.APPROVED && !nextStages.includes(LoanStage.APPROVED) && loanStages.indexOf(LoanStage.APPROVED) > currentIndex) {
            nextStages.push(LoanStage.APPROVED);
        }
        if (currentStage !== LoanStage.REJECTED && !nextStages.includes(LoanStage.REJECTED) && loanStages.indexOf(LoanStage.REJECTED) > currentIndex) {
             nextStages.push(LoanStage.REJECTED);
        }
        return [...new Set(nextStages)].sort((a, b) => loanStages.indexOf(a) - loanStages.indexOf(b));
    };

    const handleConfirm = async () => {
        if (!selectedLoan || !selectedNextStage) return;
        if (!validateCurrentStageRequirements(selectedLoan)) return;
        await onConfirmPromotion(selectedLoan.id, selectedNextStage);
    };

    if (!selectedLoan) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Promote Loan for {selectedLoan.customerName}</DialogTitle>
                    <DialogDescription>
                        Current Stage: {selectedLoan.currentStage}. Select the next stage. The loan will become unassigned.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="next-stage-pipeline">Next Stage</Label>
                        <Select value={selectedNextStage} onValueChange={(value) => setSelectedNextStage(value as LoanStage)}>
                            <SelectTrigger id="next-stage-pipeline" className="mt-1">
                                <SelectValue placeholder="Select next stage" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableNextStages(selectedLoan.currentStage).map(stage => (
                                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSavingPromotion}>Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleConfirm} disabled={isSavingPromotion || !selectedNextStage}>
                        {isSavingPromotion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Promote
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function LoanProcessPage() {
  const [allLoans, setAllLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [selectedLoanForDialog, setSelectedLoanForDialog] = useState<LoanRequest | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false); 

  const fetchLoans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLoanRequests();
      console.log('[LoanProcessPage] Fetched loans from service:', result); // Log received data
      if (result.error) {
        setError(result.error);
        setAllLoans([]);
      } else if (result.loans) {
        setAllLoans(result.loans);
      } else {
        setError("No loan data received.");
        setAllLoans([]);
      }
    } catch (err: any) {
      const errorMessage = err.message || "An unexpected error occurred fetching loans.";
      setError(errorMessage);
      setAllLoans([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const validateCurrentStageRequirements = useCallback((loan: LoanRequest): boolean => {
    if (!loan.history || !Array.isArray(loan.history)) { // Guard against undefined/non-array history
      console.warn('[LoanProcessPage] validateCurrentStageRequirements: loan.history is not an array or undefined for loan:', loan.id);
      // Decide if this should be a blocking error or not. For now, let's assume it means no history to validate.
    } else if (loan.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED) {
        const activeInfoRequest = [...loan.history].reverse().find(entry => entry.requiredFulfilment && (!entry.notes || !entry.notes.includes("[FULFILLED MOCK]")));
        if (activeInfoRequest) {
            toast({ title: "Action Pending", description: `Outstanding action for ${loan.customerName}: '${activeInfoRequest.requiredFulfilment}' must be resolved.`, variant: "destructive", duration: 7000 });
            return false;
        }
    }
    
    const currentStageConfig = initialStageConfigs.find(c => c.loanStageEnum === loan.currentStage);
    if (currentStageConfig?.requiredDocuments.length) {
        const pendingDocs = currentStageConfig.requiredDocuments.filter(reqDoc => {
            const uploadedDoc = loan.documents.find(d => d.name === reqDoc.name);
            return !uploadedDoc || uploadedDoc.status !== 'Verified';
        });
        if (pendingDocs.length > 0) {
            toast({ title: "Documents Pending", description: `Cannot proceed with ${loan.customerName}. Docs for stage '${loan.currentStage}' must be verified: ${pendingDocs.map(d => d.name).join(', ')}.`, variant: "destructive", duration: 7000 });
            return false;
        }
    }
    return true;
  }, [toast]);

  const handleCardActionClick = useCallback(async (loan: LoanRequest) => {
    setSelectedLoanForDialog(loan);
    if (loan.isReadyForManagerReview) {
      setIsPromoteDialogOpen(true);
    } else {
      if (!validateCurrentStageRequirements(loan)) return;
      setIsProcessingAction(true);
      const newHistoryEntry: LoanHistoryEntry = {
        id: `hist-mock-${Date.now()}`, stage: loan.currentStage, timestamp: formatISO(new Date()),
        userId: 'mock-officer-user', userName: 'Officer User (Mock)',
        notes: `Stage '${loan.currentStage}' marked complete by officer. Submitted for manager review.`,
      };
      const updatedFields: Partial<Omit<LoanRequest, 'id'>> = { 
        isReadyForManagerReview: true, 
        history: [...(loan.history || []), newHistoryEntry], // Ensure history is an array
        lastUpdatedDate: formatISO(new Date()) 
      };
      
      setAllLoans(prevLoans => 
        prevLoans.map(l => l.id === loan.id ? { ...l, ...updatedFields, history: [...(l.history || []), newHistoryEntry] } : l)
      );

      const serviceResult = await updateLoanRequest(loan.id, updatedFields);
      setIsProcessingAction(false);

      if (serviceResult.error || !serviceResult.success) {
        toast({ title: "Error", description: serviceResult.error || "Failed to mark stage complete in service.", variant: "destructive" });
        fetchLoans(); 
      } else {
        toast({ title: "Success", description: `${loan.customerName}'s stage '${loan.currentStage}' marked complete. Awaiting manager review.` });
      }
    }
  }, [toast, validateCurrentStageRequirements, fetchLoans]);

  const handleConfirmPromotion = useCallback(async (loanId: string, nextStage: LoanStage) => {
    const loanToPromote = allLoans.find(l => l.id === loanId);
    if (!loanToPromote) {
        toast({ title: "Error", description: "Loan not found for promotion.", variant: "destructive"});
        return;
    }

    setIsProcessingAction(true);
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stage: nextStage, timestamp: formatISO(new Date()),
      userId: 'mock-manager-user', userName: 'Manager User (Mock)',
      notes: `Manager promoted to ${nextStage}. Case is now unassigned.`
    };
    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
      currentStage: nextStage, assignedTo: undefined, 
      history: [...(loanToPromote.history || []), newHistoryEntry], // Ensure history is an array
      isReadyForManagerReview: false,
      lastUpdatedDate: formatISO(new Date())
    };

    setAllLoans(prevLoans => 
        prevLoans.map(l => l.id === loanId ? { ...l, ...updatedFields, history: [...(l.history || []), newHistoryEntry] } : l)
    );
    
    setIsPromoteDialogOpen(false);
    setSelectedLoanForDialog(null);

    const serviceResult = await updateLoanRequest(loanId, updatedFields);
    setIsProcessingAction(false);

    if (serviceResult.error || !serviceResult.success) {
      toast({ title: "Promotion Error", description: serviceResult.error || "Failed to promote loan in service.", variant: "destructive" });
      fetchLoans();
    } else {
      toast({ title: "Promotion Successful", description: `${loanToPromote.customerName} moved to ${nextStage} and is now unassigned.` });
    }
  }, [allLoans, toast, fetchLoans]);

  const loansByStage = (stage: LoanStage) => allLoans.filter((loan) => loan.currentStage === stage);

  if (isLoading && allLoans.length === 0) { 
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-3 text-lg">Loading loan pipeline...</p>
      </div>
    );
  }

  if (error && allLoans.length === 0) { 
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertTriangle className="h-5 w-5" /><AlertTitleShadCN>Error Fetching Loans</AlertTitleShadCN>
        <AlertDescShadCN className="whitespace-pre-wrap">{error} Please try refreshing the page.</AlertDescShadCN>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Pipeline</h1>
          <p className="text-muted-foreground">Visualize and manage loan applications through various stages.</p>
        </div>
        <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
      </div>
      <ScrollArea className="w-full whitespace-nowrap pb-4">
        <div className="flex gap-4">
          {loanStages.map((stage) => (
            <KanbanColumn key={stage} stage={stage} loans={loansByStage(stage)} onCardActionClick={handleCardActionClick} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <PipelinePromoteDialog
        isOpen={isPromoteDialogOpen}
        onOpenChange={(isOpen) => { setIsPromoteDialogOpen(isOpen); if (!isOpen) setSelectedLoanForDialog(null); }}
        selectedLoan={selectedLoanForDialog}
        onConfirmPromotion={handleConfirmPromotion}
        isSavingPromotion={isProcessingAction}
        validateCurrentStageRequirements={validateCurrentStageRequirements}
      />
    </div>
  );
}
