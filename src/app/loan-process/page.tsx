
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { LoanRequest, User, LoanHistoryEntry, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { UserRole } from '@/types/loan';
import { PlusCircle, AlertTriangle, Clock, Loader2, ArrowRight, CheckSquare, Building, UserCheck, UserPlus, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLoanRequests, updateLoanRequest, getWorkflowDefinitions } from '@/services/loan-service-prisma';
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

interface LoanCardProps {
  loan: LoanRequest;
  stageName: string;
  assignedUserName?: string; // Added to pass down assignee name
  onCardActionClick: (loan: LoanRequest) => void;
  currentUser: User | null; 
  router: ReturnType<typeof useRouter>;
}

function LoanCard({ loan, stageName, assignedUserName, onCardActionClick, currentUser, router }: LoanCardProps) {
  const isManagerRole = currentUser?.role === UserRole.UNDERWRITER || currentUser?.role === UserRole.ADMIN;
  const isViewOnlyRole = currentUser?.role === UserRole.VIEW_ONLY;

  const canPerformActions = !stageName.toLowerCase().includes("closed") && 
                            !stageName.toLowerCase().includes("rejected") && 
                            !stageName.toLowerCase().includes("disbursed") &&
                            !isViewOnlyRole;

  let actionButtonText = "View Details";
  let ActionIcon = Eye; 
  let actionHandler = () => router.push(`/loan-requests/${loan.id}`);
  let showActionButton = true;

  const isCurrentUserAssigned = currentUser && loan.assignedTo === currentUser.id;
  const canUserMarkComplete = (currentUser?.role === UserRole.STAFF || currentUser?.role === UserRole.RELATIONSHIP_MANAGER || currentUser?.role === UserRole.UNDERWRITER) && isCurrentUserAssigned;

  if (canPerformActions) {
    if (isManagerRole && loan.isReadyForManagerReview) {
      actionButtonText = "Review & Promote";
      ActionIcon = UserCheck;
      actionHandler = () => onCardActionClick(loan);
    } else if (canUserMarkComplete && !loan.isReadyForManagerReview) {
      actionButtonText = "Mark Complete";
      ActionIcon = CheckSquare;
      actionHandler = () => onCardActionClick(loan);
    } else if (!loan.assignedTo && (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.UNDERWRITER)) {
      actionButtonText = "Assign Staff";
      ActionIcon = UserPlus;
      actionHandler = () => router.push(`/loan-requests/${loan.id}`);
    } else if (isViewOnlyRole) {
        actionButtonText = "View Details";
        ActionIcon = Eye;
        actionHandler = () => router.push(`/loan-requests/${loan.id}`);
    } else if (!isManagerRole && !canUserMarkComplete && loan.assignedTo && loan.assignedTo !== currentUser?.id) {
        actionButtonText = "View Details";
        ActionIcon = Eye;
        actionHandler = () => router.push(`/loan-requests/${loan.id}`);
    } else if (!isManagerRole && !canUserMarkComplete && !loan.assignedTo) {
        actionButtonText = "View Details";
        ActionIcon = Eye;
        actionHandler = () => router.push(`/loan-requests/${loan.id}`);
    }
  } else if (isViewOnlyRole) { 
    actionButtonText = "View Details";
    ActionIcon = Eye;
    actionHandler = () => router.push(`/loan-requests/${loan.id}`);
  } else {
    actionButtonText = "View Details";
    ActionIcon = Eye;
    actionHandler = () => router.push(`/loan-requests/${loan.id}`);
  }


  return (
    <Card className="mb-3 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="p-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base font-semibold truncate">
            <Link href={`/loan-requests/${loan.id}`} className="hover:underline">
              {loan.customerName}
            </Link>
          </CardTitle>
          {loan.isOverdue && (
            <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger><AlertTriangle className="h-5 w-5 text-destructive" /></TooltipTrigger><TooltipContent><p>Overdue!</p></TooltipContent></Tooltip></TooltipProvider>
          )}
        </div>
        <CardDescription className="text-xs truncate">{loan.loanNumber} / Dept: {loan.assignedDepartment || "N/A"}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 text-sm space-y-2">
        <p className="truncate">Amount: ${loan.loanAmount.toLocaleString()}</p>
        <p className="truncate">Assigned: {assignedUserName || (loan.assignedTo ? 'Unknown User' : <span className="italic text-muted-foreground">Unassigned Staff</span>)}</p>
        {loan.stageDeadline && (<div className="flex items-center text-xs text-muted-foreground"><Clock className="h-3 w-3 mr-1" />Deadline: {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}</div>)}
        
        {loan.isReadyForManagerReview && canPerformActions && !isViewOnlyRole && (
             <Badge variant="outline" className="mt-2 text-orange-600 border-orange-400 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300">
                Awaiting Manager Review
            </Badge>
        )}
        {showActionButton && (
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={actionHandler}>
            <ActionIcon className="mr-2 h-4 w-4" /> {actionButtonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanColumnProps {
  stageDef: WorkflowStageDefinition;
  loans: LoanRequest[];
  users: User[]; // Pass all users for name lookup
  onCardActionClick: (loan: LoanRequest) => void;
  currentUser: User | null;
  router: ReturnType<typeof useRouter>;
}

function KanbanColumn({ stageDef, loans, users, onCardActionClick, currentUser, router }: KanbanColumnProps) {
  const getAssignedUserName = (userId?: string) => {
    if (!userId) return undefined;
    return users.find(u => u.id === userId)?.name;
  };
  
  return (
    <div className="flex-shrink-0 w-80 bg-muted/50 rounded-lg p-1 md:p-2 min-h-[300px]">
      <div className="flex justify-between items-center p-2 mb-2 gap-2">
        <div className="flex items-center min-w-0"> 
            <Building className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0"/>
            <h3 className="font-semibold text-foreground truncate"> 
            {stageDef.responsibleDepartment} - {stageDef.name}
            </h3>
        </div>
        <Badge variant="secondary" className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs h-6 min-w-[1.5rem] flex items-center justify-center">
            {loans.length}
        </Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-24rem)] pr-2">
        {loans.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground p-4 text-center">
            <p>No loan requests in this stage for this department.</p>
          </div>
        )}
        {loans.map((loan) => (
          <LoanCard 
            key={loan.id} 
            loan={loan} 
            stageName={stageDef.name} 
            assignedUserName={getAssignedUserName(loan.assignedTo)}
            onCardActionClick={onCardActionClick} 
            currentUser={currentUser} 
            router={router}
          />
        ))}
      </ScrollArea>
    </div>
  );
}

interface ManagerPromoteDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    selectedLoan: LoanRequest | null;
    currentStageName?: string;
    nextStageName?: string;
    onConfirmPromotion: (loanId: string) => Promise<void>;
    isProcessingAction: boolean;
}

function ManagerPromoteDialog({
    isOpen, onOpenChange, selectedLoan, currentStageName, nextStageName,
    onConfirmPromotion, isProcessingAction
}: ManagerPromoteDialogProps) {
    
    const handleConfirm = async () => {
        if (!selectedLoan) return;
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
                <DialogFooter className="pt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isProcessingAction}>Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleConfirm} disabled={isProcessingAction || !nextStageName}>
                        {isProcessingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm & Promote
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ActiveWorkflowPipeline {
  definition: WorkflowDefinition;
  activeVersion: WorkflowVersion;
  stages: WorkflowStageDefinition[];
}


export default function LoanProcessPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading } = useAuth(); 
  const [allLoans, setAllLoans] = useState<LoanRequest[]>([]);
  const [fetchedWorkflowDefinitions, setFetchedWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [usersFromService, setUsersFromService] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [selectedLoanForDialog, setSelectedLoanForDialog] = useState<LoanRequest | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false); 

  const isManagerRole = currentUser?.role === UserRole.UNDERWRITER || currentUser?.role === UserRole.ADMIN;

  const activeWorkflowPipelines = useMemo(() => {
    if (!fetchedWorkflowDefinitions || fetchedWorkflowDefinitions.length === 0) return [];
    const pipelines: ActiveWorkflowPipeline[] = [];
    for (const def of fetchedWorkflowDefinitions) {
      const activeVersion = def.versions.find(v => v.isActive);
      if (activeVersion && activeVersion.stages && activeVersion.stages.length > 0) {
        pipelines.push({
          definition: def,
          activeVersion: activeVersion,
          stages: [...activeVersion.stages].sort((a, b) => a.order - b.order)
        });
      }
    }
    return pipelines;
  }, [fetchedWorkflowDefinitions]);

  const getStageDefById = useCallback((versionId?: string, stageId?: string): WorkflowStageDefinition | null => {
    if (!versionId || !stageId || !fetchedWorkflowDefinitions) return null;
    const wfDef = fetchedWorkflowDefinitions.find(def => def.versions.some(v => v.id === versionId));
    if (!wfDef) return null;
    const version = wfDef.versions.find(v => v.id === versionId);
    return version?.stages.find(s => s.id === stageId) || null;
  }, [fetchedWorkflowDefinitions]);


  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loansResult, wfResult] = await Promise.all([
        getLoanRequests(),
        getWorkflowDefinitions()
      ]);

      if (loansResult.error) { setError(prev => (prev ? `${prev}\nLoans: ${loansResult.error}` : `Loans: ${loansResult.error}`)); setAllLoans([]); }
      else if (loansResult.loans) { 
        setAllLoans(loansResult.loans); 
        setUsersFromService(loansResult.users || []); 
      }
      else { setError(prev => (prev ? `${prev}\nLoans: No loan data received.` : `Loans: No loan data received.`)); setAllLoans([]); }

      if (wfResult.error) { setError(prev => (prev ? `${prev}\nWorkflows: ${wfResult.error}` : `Workflows: ${wfResult.error}`)); setFetchedWorkflowDefinitions([]); }
      else if (wfResult.workflows) { setFetchedWorkflowDefinitions(wfResult.workflows); }
      else { setError(prev => (prev ? `${prev}\nWorkflows: No workflow data received.` : `Workflows: No workflow data received.`)); setFetchedWorkflowDefinitions([]); }

    } catch (err: any) { 
      setError(prev => (prev ? `${prev}\nFetchError: ${err.message || "Error fetching page data."}` : `FetchError: ${err.message || "Error fetching page data."}`));
      setAllLoans([]);
      setFetchedWorkflowDefinitions([]);
    }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchPageData(); }, [fetchPageData]);

  const validateLoanForNextStep = useCallback((loan: LoanRequest): boolean => {
    const stageDef = getStageDefById(loan.workflowVersionId, loan.currentStageId);
    if (!stageDef) {
        toast({title: "Error", description: "Cannot find stage definition.", variant: "destructive"});
        return false;
    }
    const activeInfoReq = [...loan.history].reverse().find(e => e.requiredFulfilment && !e.notes?.includes("[FULFILLED MOCK]"));
    if (activeInfoReq) {
        toast({ title: "Action Pending", description: `Outstanding action: '${activeInfoReq.requiredFulfilment}' must be resolved.`, variant: "destructive", duration: 7000 });
        return false;
    }
    const pendingDocs = stageDef.requiredDocumentNames.filter(name => !loan.documents.find(d => d.name === name && d.status === 'Verified'));
    if (pendingDocs.length > 0) {
        toast({ title: "Documents Pending", description: `Docs for stage '${stageDef.name}' must be verified: ${pendingDocs.join(', ')}.`, variant: "destructive", duration: 7000 });
        return false;
    }
    return true;
  }, [toast, getStageDefById]);

  const handleCardActionClick = useCallback(async (loan: LoanRequest) => {
    if (!currentUser || currentUser.role === UserRole.VIEW_ONLY) {
        toast({title: "Permission Denied", description: "You do not have permission to perform this action.", variant: "destructive"});
        return;
    }
    setSelectedLoanForDialog(loan);
    const currentStageDef = getStageDefById(loan.workflowVersionId, loan.currentStageId);
    if (!currentStageDef) {
        toast({title: "Error", description: "Loan stage definition not found.", variant: "destructive"});
        return;
    }

    if (isManagerRole && loan.isReadyForManagerReview) {
        if (!validateLoanForNextStep(loan)) return;
        setIsPromoteDialogOpen(true);
    } 
    else if (!isManagerRole && loan.assignedTo === currentUser.id && !loan.isReadyForManagerReview) {
        if (!validateLoanForNextStep(loan)) return;
        
        setIsProcessingAction(true);
        const officerName = usersFromService.find(u=>u.id === loan.assignedTo)?.name || currentUser.name || 'Officer';
        const newHistoryEntry: LoanHistoryEntry = {
            id: `hist-officer-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
            userId: loan.assignedTo || currentUser.id, userName: officerName,
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
            fetchPageData(); 
        } else {
            toast({ title: "Success", description: `${loan.customerName}'s stage '${currentStageDef.name}' marked complete. Awaiting manager review.` });
        }
    }
    else if (!loan.assignedTo && (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.UNDERWRITER)) {
        toast({title: "Assignment Needed", description: "This loan needs to be assigned to a staff member.", variant: "info"});
        router.push(`/loan-requests/${loan.id}`); 
        return;
    } else {
        toast({title: "Action Not Permitted", description: "You may not have the required role or assignment for this action.", variant: "warning"});
    }
  }, [toast, validateLoanForNextStep, fetchPageData, getStageDefById, router, currentUser, isManagerRole, usersFromService]);

  const handleConfirmPromotion = useCallback(async (loanId: string) => {
    if (!currentUser || !(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.UNDERWRITER)) {
        toast({title: "Permission Denied", description: "Only managers or admins can promote loans.", variant: "destructive"});
        return;
    }
    const loanToPromote = allLoans.find(l => l.id === loanId);
    if (!loanToPromote) { toast({ title: "Error", description: "Loan not found.", variant: "destructive"}); return; }

    const currentVersion = fetchedWorkflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === loanToPromote.workflowVersionId);
    if (!currentVersion) { toast({ title: "Error", description: "Workflow version not found.", variant: "destructive"}); return; }
    
    const currentStageIndex = currentVersion.stages.findIndex(s => s.id === loanToPromote.currentStageId);
    if (currentStageIndex === -1 || currentStageIndex >= currentVersion.stages.length - 1) {
      toast({ title: "Workflow End", description: "This is the last stage.", variant: "info" });
      setIsPromoteDialogOpen(false);
      setSelectedLoanForDialog(null);
      const finalHistoryEntry: LoanHistoryEntry = {
        id: `hist-final-${Date.now()}`, stageName: currentVersion.stages[currentStageIndex]?.name || 'Final Stage', timestamp: formatISO(new Date()),
        userId: currentUser.id, userName: currentUser.name || 'System Process', notes: 'Manager action: Loan reached final workflow stage. Process complete.',
      };
      
      const updateResult = await updateLoanRequest(loanId, { history: [...(loanToPromote.history || []), finalHistoryEntry], isReadyForManagerReview: false, lastUpdatedDate: formatISO(new Date()) });
      if (updateResult.success) fetchPageData(); 
      return;
    }

    const nextStageDef = currentVersion.stages[currentStageIndex + 1];
    setIsProcessingAction(true);
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-promote-${Date.now()}`, stageName: nextStageDef.name, timestamp: formatISO(new Date()),
      userId: currentUser.id, userName: currentUser.name || 'System Process',
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
      workflowDefinitionId: loanToPromote.workflowDefinitionId,
      workflowVersionId: loanToPromote.workflowVersionId,
    };

    setAllLoans(prev => prev.map(l => l.id === loanId ? { ...l, ...updatedFields } : l)); 
    setIsPromoteDialogOpen(false);
    setSelectedLoanForDialog(null);

    const serviceResult = await updateLoanRequest(loanId, updatedFields);
    setIsProcessingAction(false);

    if (serviceResult.error || !serviceResult.success) {
      toast({ title: "Promotion Error", description: serviceResult.error || "Failed to promote.", variant: "destructive" });
      fetchPageData(); 
    } else {
      toast({ title: "Promotion Successful", description: `${loanToPromote.customerName} moved to ${nextStageDef.name}.` });
    }
  }, [allLoans, toast, fetchPageData, fetchedWorkflowDefinitions, currentUser]);

  const loansByStageAndVersionId = useCallback((stageId: string, versionId: string) => {
    return allLoans.filter(loan => loan.currentStageId === stageId && loan.workflowVersionId === versionId);
  }, [allLoans]);

  const currentStageNameForDialog = useMemo(() => {
    if (!selectedLoanForDialog) return '';
    const stageDef = getStageDefById(selectedLoanForDialog.workflowVersionId, selectedLoanForDialog.currentStageId);
    return stageDef?.name || 'N/A';
  }, [selectedLoanForDialog, getStageDefById]);

  const nextStageNameForDialog = useMemo(() => {
    if (!selectedLoanForDialog || !fetchedWorkflowDefinitions) return '';
    const currentVersion = fetchedWorkflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === selectedLoanForDialog.workflowVersionId);
    if (!currentVersion) return '';
    const currentStageIndex = currentVersion.stages.findIndex(s => s.id === selectedLoanForDialog.currentStageId);
    if (currentStageIndex === -1 || currentStageIndex >= currentVersion.stages.length - 1) return '';
    return currentVersion.stages[currentStageIndex + 1]?.name || '';
  }, [selectedLoanForDialog, fetchedWorkflowDefinitions]);

  if (authLoading || (isLoading && (allLoans.length === 0 || fetchedWorkflowDefinitions.length === 0))) { 
    return (<div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-3 text-lg">Loading loan pipelines & workflows...</p></div>); 
  }
  if (error && (allLoans.length === 0 || activeWorkflowPipelines.length === 0) ) { return (<Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertTriangle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescShadCN>{error}</AlertDescShadCN></Alert>); }
  
  if (activeWorkflowPipelines.length === 0 && !isLoading) { 
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Pipelines</h1>
            <p className="text-muted-foreground">Visualize and manage loans through their lifecycle.</p>
          </div>
          {currentUser && currentUser.role !== UserRole.VIEW_ONLY && (
            <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
          )}
        </div>
        <Alert variant="default" className="max-w-2xl mx-auto">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitleShadCN>No Active Loan Pipelines Found</AlertTitleShadCN>
          <AlertDescShadCN>
            There are no workflow definitions with an active version that also has stages configured.
            Please go to Settings (Admin only) to define loan workflows.
          </AlertDescShadCN>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Pipelines</h1>
          <p className="text-muted-foreground">Visualize and manage loans through their lifecycle for each active workflow.</p>
        </div>
        {currentUser && currentUser.role !== UserRole.VIEW_ONLY && (
           <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
        )}
      </div>

      {activeWorkflowPipelines.map(pipeline => (
        <div key={pipeline.definition.id} className="mb-10 p-4 border rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-1 text-primary">
             {pipeline.definition.name} ({pipeline.definition.loanType})
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Active Version: {pipeline.activeVersion.versionNumber} | Stages: {pipeline.stages.length}</p>
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex gap-4">
              {pipeline.stages.map((stageDef) => (
                <KanbanColumn
                  key={stageDef.id}
                  stageDef={stageDef}
                  loans={loansByStageAndVersionId(stageDef.id, pipeline.activeVersion.id)}
                  users={usersFromService}
                  onCardActionClick={handleCardActionClick}
                  currentUser={currentUser}
                  router={router}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      ))}

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

    