
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { LoanRequest, User, LoanHistoryEntry, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { UserRole } from '@/types/loan'; // LoanStage removed as it's not primary for stages
import { PlusCircle, AlertTriangle, Clock, Loader2, ArrowRight, CheckSquare, Building } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
// Select for next stage is removed, promotion is automatic
import { useToast } from '@/hooks/use-toast';
import { mockWorkflowDefinitions, mockUsers } from '@/lib/mock-data'; // For stage names & user names

interface LoanCardProps {
  loan: LoanRequest;
  stageName: string; // Pass resolved stage name
  onCardActionClick: (loan: LoanRequest) => void;
  isManagerView: boolean; // To differentiate manager actions on card
}

function LoanCard({ loan, stageName, onCardActionClick, isManagerView }: LoanCardProps) {
  const canTakeAction = !stageName.toLowerCase().includes("closed") && !stageName.toLowerCase().includes("rejected") && !stageName.toLowerCase().includes("disbursed");
  
  let actionButtonText = "Details";
  let ActionIcon = ArrowRight; // Default
  let actionHandler = () => router.push(`/loan-requests/${loan.id}`); // Default to view details

  if (isManagerView && loan.isReadyForManagerReview && canTakeAction) {
    actionButtonText = "Review & Promote";
    ActionIcon = UserCheck; // Manager specific icon for promotion
    actionHandler = () => onCardActionClick(loan); // Opens manager promote dialog
  } else if (!isManagerView && loan.assignedTo && !loan.isReadyForManagerReview && canTakeAction) {
    actionButtonText = "Mark Complete";
    ActionIcon = CheckSquare; // Officer icon
    actionHandler = () => onCardActionClick(loan); // Officer marks complete
  } else if (!loan.assignedTo && canTakeAction) {
    actionButtonText = "Assign Staff";
    ActionIcon = UserPlus; // Icon for assigning
     actionHandler = () => router.push(`/loan-requests/${loan.id}`); // Go to detail page to assign
  }


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
            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger><AlertTriangle className="h-5 w-5 text-destructive" /></TooltipTrigger><TooltipContent><p>Overdue!</p></TooltipContent></Tooltip></TooltipProvider>
          )}
        </div>
        <CardDescription className="text-xs">{loan.loanNumber} / Dept: {loan.assignedDepartment || "N/A"}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 text-sm space-y-2">
        <p>Amount: ${loan.loanAmount.toLocaleString()}</p>
        <p>Assigned: {loan.assignedTo ? mockUsers.find(u=>u.id === loan.assignedTo)?.name || 'Unknown' : <span className="italic text-muted-foreground">Unassigned Staff</span>}</p>
        {loan.stageDeadline && (<div className="flex items-center text-xs text-muted-foreground"><Clock className="h-3 w-3 mr-1" />Deadline: {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}</div>)}
        
        {/* Simplified, more detailed info on loan detail page */}
        {loan.isReadyForManagerReview && canTakeAction && (
             <Badge variant="outline" className="mt-2 text-orange-600 border-orange-400 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300">
                Awaiting Manager Review
            </Badge>
        )}
         {(isManagerView || (loan.assignedTo && !loan.isReadyForManagerReview)) && canTakeAction && ( // Show button if it's actionable
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={actionHandler}>
            <ActionIcon className="mr-2 h-4 w-4" /> {actionButtonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanColumnProps {
  stageDef: WorkflowStageDefinition; // Use new stage definition
  loans: LoanRequest[];
  onCardActionClick: (loan: LoanRequest) => void;
  isManagerView: boolean; // For pipeline, officer usually acts. Manager queue for manager view.
}

function KanbanColumn({ stageDef, loans, onCardActionClick, isManagerView }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-80 bg-muted/50 rounded-lg p-1 md:p-2 min-h-[300px]">
      <div className="flex justify-between items-center p-2 mb-2">
        <h3 className="font-semibold text-foreground flex items-center"><Building className="h-4 w-4 mr-2 text-muted-foreground"/>{stageDef.responsibleDepartment} - {stageDef.name}</h3>
        <Badge variant="secondary">{loans.length}</Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-20rem)] pr-2">
        {loans.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground p-4 text-center">
            <p>No loan requests in this stage for this department.</p>
          </div>
        )}
        {loans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} stageName={stageDef.name} onCardActionClick={onCardActionClick} isManagerView={isManagerView} />
        ))}
      </ScrollArea>
    </div>
  );
}

// Manager Promote Dialog - No longer needs stage selection by user
interface ManagerPromoteDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    selectedLoan: LoanRequest | null;
    currentStageName?: string;
    nextStageName?: string;
    onConfirmPromotion: (loanId: string) => Promise<void>; // No nextStage param
    isProcessingAction: boolean;
}

function ManagerPromoteDialog({
    isOpen, onOpenChange, selectedLoan, currentStageName, nextStageName,
    onConfirmPromotion, isProcessingAction
}: ManagerPromoteDialogProps) {
    
    const handleConfirm = async () => {
        if (!selectedLoan) return;
        // Validation (like doc checks) should happen before opening this dialog or as part of onConfirmPromotion
        await onConfirmPromotion(selectedLoan.id);
    };

    if (!selectedLoan) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manager: Promote Loan for {selectedLoan.customerName}</DialogTitle>
                    <DialogDescription>
                        Current Stage: {currentStageName || 'N/A'}.
                        {nextStageName ? ` This will promote the loan to '${nextStageName}' and unassign it within the new department.` : " This is the final stage."}
                    </DialogDescription>
                </DialogHeader>
                {/* Removed stage selection UI */}
                <DialogFooter className="pt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isProcessingAction}>Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleConfirm} disabled={isProcessingAction || !nextStageName /* Disable if no next stage defined */}>
                        {isProcessingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Promote
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function LoanProcessPage() {
  const [allLoans, setAllLoans] = useState<LoanRequest[]>([]);
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>(mockWorkflowDefinitions); // Load mock workflows
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [selectedLoanForDialog, setSelectedLoanForDialog] = useState<LoanRequest | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false); 

  const activeWorkflow = useMemo(() => {
    const activeDef = workflowDefinitions.find(def => def.isActive);
    if (!activeDef || activeDef.versions.length === 0) return null;
    return activeDef.versions.sort((a,b) => b.versionNumber - a.versionNumber)[0]; // Use latest version of active def
  }, [workflowDefinitions]);

  const getStageDefById = useCallback((versionId: string, stageId: string): WorkflowStageDefinition | null => {
    const wfDef = workflowDefinitions.find(def => def.versions.some(v => v.id === versionId));
    if (!wfDef) return null;
    const version = wfDef.versions.find(v => v.id === versionId);
    return version?.stages.find(s => s.id === stageId) || null;
  }, [workflowDefinitions]);


  const fetchLoans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLoanRequests();
      if (result.error) { setError(result.error); setAllLoans([]); }
      else if (result.loans) { setAllLoans(result.loans); }
      else { setError("No loan data received."); setAllLoans([]); }
    } catch (err: any) { setError(err.message || "Error fetching loans."); setAllLoans([]); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const validateLoanForNextStep = useCallback((loan: LoanRequest): boolean => {
    const stageDef = getStageDefById(loan.workflowVersionId, loan.currentStageId);
    if (!stageDef) {
        toast({title: "Error", description: "Cannot find stage definition.", variant: "destructive"});
        return false;
    }
    // Check active info requests
    const activeInfoReq = [...loan.history].reverse().find(e => e.requiredFulfilment && !e.notes?.includes("[FULFILLED MOCK]"));
    if (activeInfoReq) {
        toast({ title: "Action Pending", description: `Outstanding action: '${activeInfoReq.requiredFulfilment}' must be resolved.`, variant: "destructive", duration: 7000 });
        return false;
    }
    // Check documents
    const pendingDocs = stageDef.requiredDocumentNames.filter(name => !loan.documents.find(d => d.name === name && d.status === 'Verified'));
    if (pendingDocs.length > 0) {
        toast({ title: "Documents Pending", description: `Docs for stage '${stageDef.name}' must be verified: ${pendingDocs.join(', ')}.`, variant: "destructive", duration: 7000 });
        return false;
    }
    return true;
  }, [toast, getStageDefById]);

  // This is called when an Officer clicks "Mark Complete" or a Manager clicks "Review & Promote"
  const handleCardActionClick = useCallback(async (loan: LoanRequest) => {
    setSelectedLoanForDialog(loan);
    const currentStageDef = getStageDefById(loan.workflowVersionId, loan.currentStageId);
    if (!currentStageDef) {
        toast({title: "Error", description: "Loan stage definition not found.", variant: "destructive"});
        return;
    }

    if (loan.isReadyForManagerReview) { // Manager action: Open promotion dialog
        if (!validateLoanForNextStep(loan)) return;
        setIsPromoteDialogOpen(true);
    } else { // Officer action: Mark stage complete
        if (!loan.assignedTo) {
            toast({title: "Assignment Needed", description: "Loan must be assigned to a staff member first.", variant: "info"});
            // Optionally redirect to detail page: router.push(`/loan-requests/${loan.id}`);
            return;
        }
        if (!validateLoanForNextStep(loan)) return;
        
        setIsProcessingAction(true);
        const officerName = mockUsers.find(u=>u.id === loan.assignedTo)?.name || 'Officer';
        const newHistoryEntry: LoanHistoryEntry = {
            id: `hist-officer-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
            userId: loan.assignedTo, userName: officerName,
            notes: `Staff marked stage '${currentStageDef.name}' complete. Submitted for manager review in ${loan.assignedDepartment} department.`,
        };
        const updatedFields: Partial<Omit<LoanRequest, 'id'>> = { 
            isReadyForManagerReview: true, 
            history: [...(loan.history || []), newHistoryEntry],
            lastUpdatedDate: formatISO(new Date()) 
        };
        
        setAllLoans(prev => prev.map(l => l.id === loan.id ? { ...l, ...updatedFields } : l));
        const serviceResult = await updateLoanRequest(loan.id, updatedFields);
        setIsProcessingAction(false);

        if (serviceResult.error || !serviceResult.success) {
            toast({ title: "Error", description: serviceResult.error || "Failed to mark stage complete.", variant: "destructive" });
            fetchLoans(); 
        } else {
            toast({ title: "Success", description: `${loan.customerName}'s stage '${currentStageDef.name}' marked complete. Awaiting manager review.` });
        }
    }
  }, [toast, validateLoanForNextStep, fetchLoans, getStageDefById]);

  const handleConfirmPromotion = useCallback(async (loanId: string) => { // Promotion logic now internal
    const loanToPromote = allLoans.find(l => l.id === loanId);
    if (!loanToPromote) { toast({ title: "Error", description: "Loan not found.", variant: "destructive"}); return; }

    const currentVersion = workflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === loanToPromote.workflowVersionId);
    if (!currentVersion) { toast({ title: "Error", description: "Workflow version not found.", variant: "destructive"}); return; }
    
    const currentStageIndex = currentVersion.stages.findIndex(s => s.id === loanToPromote.currentStageId);
    if (currentStageIndex === -1 || currentStageIndex >= currentVersion.stages.length - 1) {
      toast({ title: "Workflow End", description: "This is the last stage.", variant: "info" });
      // Handle loan completion logic if necessary (e.g. update status to "Closed")
      setIsPromoteDialogOpen(false); // Close dialog even if it's the last stage
      setSelectedLoanForDialog(null);
      // Potentially add a history entry for "workflow completed"
      const finalHistoryEntry: LoanHistoryEntry = {
        id: `hist-final-${Date.now()}`, stageName: currentVersion.stages[currentStageIndex]?.name || 'Final Stage', timestamp: formatISO(new Date()),
        userId: 'mock-manager-user', userName: 'Manager (Mock)', notes: 'Loan reached final workflow stage. Process complete.',
      };
      await updateLoanRequest(loanId, { history: [...(loanToPromote.history || []), finalHistoryEntry], isReadyForManagerReview: false });
      fetchLoans(); // Refresh to show changes
      return;
    }

    const nextStageDef = currentVersion.stages[currentStageIndex + 1];
    setIsProcessingAction(true);
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-promote-${Date.now()}`, stageName: nextStageDef.name, timestamp: formatISO(new Date()),
      userId: 'mock-manager-user', userName: 'Manager (Mock)', // TODO: Capture actual manager
      notes: `Manager promoted from '${currentVersion.stages[currentStageIndex].name}' to '${nextStageDef.name}'. Case moved to ${nextStageDef.responsibleDepartment} department, now unassigned.`
    };
    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
      currentStageId: nextStageDef.id,
      assignedDepartment: nextStageDef.responsibleDepartment,
      assignedTo: undefined, 
      history: [...(loanToPromote.history || []), newHistoryEntry],
      isReadyForManagerReview: false,
      lastUpdatedDate: formatISO(new Date()),
      stageDeadline: formatISO(addDays(new Date(), nextStageDef.defaultTimelineDays)),
    };

    setAllLoans(prev => prev.map(l => l.id === loanId ? { ...l, ...updatedFields } : l));
    setIsPromoteDialogOpen(false);
    setSelectedLoanForDialog(null);

    const serviceResult = await updateLoanRequest(loanId, updatedFields);
    setIsProcessingAction(false);

    if (serviceResult.error || !serviceResult.success) {
      toast({ title: "Promotion Error", description: serviceResult.error || "Failed to promote.", variant: "destructive" });
      fetchLoans();
    } else {
      toast({ title: "Promotion Successful", description: `${loanToPromote.customerName} moved to ${nextStageDef.name}.` });
    }
  }, [allLoans, toast, fetchLoans, workflowDefinitions]);

  const loansByStageId = (stageId: string) => allLoans.filter((loan) => loan.currentStageId === stageId);

  // Derived state for Manager Promote Dialog
  const currentStageNameForDialog = useMemo(() => {
    if (!selectedLoanForDialog) return '';
    const stageDef = getStageDefById(selectedLoanForDialog.workflowVersionId, selectedLoanForDialog.currentStageId);
    return stageDef?.name || 'N/A';
  }, [selectedLoanForDialog, getStageDefById]);

  const nextStageNameForDialog = useMemo(() => {
    if (!selectedLoanForDialog) return '';
    const currentVersion = workflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === selectedLoanForDialog.workflowVersionId);
    if (!currentVersion) return '';
    const currentStageIndex = currentVersion.stages.findIndex(s => s.id === selectedLoanForDialog.currentStageId);
    if (currentStageIndex === -1 || currentStageIndex >= currentVersion.stages.length - 1) return ''; // No next stage or already last
    return currentVersion.stages[currentStageIndex + 1]?.name || '';
  }, [selectedLoanForDialog, workflowDefinitions]);


  if (isLoading && allLoans.length === 0) { /* ... loading UI ... */ return (<div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-3 text-lg">Loading loan pipeline...</p></div>); }
  if (error && allLoans.length === 0) { /* ... error UI ... */ return (<Alert variant="destructive" className="max-w-2xl mx-auto"><AlertTriangle className="h-5 w-5" /><AlertTitleShadCN>Error</AlertTitleShadCN><AlertDescShadCN>{error}</AlertDescShadCN></Alert>); }
  if (!activeWorkflow) { /* ... no active workflow UI ... */ return (<Alert variant="destructive" className="max-w-2xl mx-auto"><AlertTriangle className="h-5 w-5" /><AlertTitleShadCN>Configuration Error</AlertTitleShadCN><AlertDescShadCN>No active workflow found. Please configure an active workflow in settings.</AlertDescShadCN></Alert>); }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Pipeline</h1>
          <p className="text-muted-foreground">Active Workflow: {workflowDefinitions.find(d=>d.isActive)?.name} (V{activeWorkflow.versionNumber})</p>
        </div>
        <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
      </div>
      <ScrollArea className="w-full whitespace-nowrap pb-4">
        <div className="flex gap-4">
          {activeWorkflow.stages.map((stageDef) => (
            <KanbanColumn key={stageDef.id} stageDef={stageDef} loans={loansByStageId(stageDef.id)} onCardActionClick={handleCardActionClick} isManagerView={false} /* Pipeline is typically officer view */ />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <ManagerPromoteDialog
        isOpen={isPromoteDialogOpen}
        onOpenChange={(isOpen) => { setIsPromoteDialogOpen(isOpen); if (!isOpen) setSelectedLoanForDialog(null); }}
        selectedLoan={selectedLoanForDialog}
        currentStageName={currentStageNameForDialog}
        nextStageName={nextStageNameForDialog}
        onConfirmPromotion={handleConfirmPromotion}
        isProcessingAction={isProcessingAction}
      />
    </div>
  );
}
