

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { LoanRequest, User, LoanHistoryEntry, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
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
  assignedUserName?: string;
  onCardActionClick: (loan: LoanRequest) => void;
  currentUser: User | null;
  router: ReturnType<typeof useRouter>;
}

function LoanCard({ loan, stageName, assignedUserName, onCardActionClick, currentUser, router }: LoanCardProps) {
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);

  const canViewDetails = userPermissions.has(PERMISSIONS.VIEW_LOAN_DETAILS);
  const isStageActionable = !stageName.toLowerCase().includes("closed") &&
                            !stageName.toLowerCase().includes("rejected") &&
                            !stageName.toLowerCase().includes("disbursed");

  let actionButtonText = "View Details";
  let ActionIcon = Eye;
  let actionHandler = () => router.push(`/loan-requests/${loan.id}`);

  if (currentUser && isStageActionable) {
    const canPromote = userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE) || userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK);
    const canMarkComplete = userPermissions.has(PERMISSIONS.MARK_STAGE_COMPLETE);
    const canAssignStaff = userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF); 

    const isCurrentUserAssigned = loan.assignedTo === currentUser.id;

    if (canPromote && loan.isReadyForManagerReview) {
      actionButtonText = "Review & Promote";
      ActionIcon = UserCheck;
      actionHandler = () => onCardActionClick(loan);
    } else if (canMarkComplete && isCurrentUserAssigned && !loan.isReadyForManagerReview) {
      actionButtonText = "Mark Complete";
      ActionIcon = CheckSquare;
      actionHandler = () => onCardActionClick(loan);
    } else if (canAssignStaff && !loan.assignedTo && loan.assignedDepartment) {
      actionButtonText = "Assign Staff";
      ActionIcon = UserPlus;
      actionHandler = () => router.push(`/loan-requests/${loan.id}`);
    } else if (!canViewDetails) {
      actionButtonText = "No Actions Permitted";
      ActionIcon = AlertTriangle;
      actionHandler = () => {};
    }
  } else if (!canViewDetails) {
      actionButtonText = "No Actions Permitted";
      ActionIcon = AlertTriangle;
      actionHandler = () => {};
  }


  return (
    <Card className="mb-3 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="p-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base font-semibold truncate">
            {canViewDetails ? (
                <Link href={`/loan-requests/${loan.id}`} className="hover:underline">
                {loan.customerName}
                </Link>
            ) : (
                <span>{loan.customerName}</span>
            )}
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

        {loan.isReadyForManagerReview && isStageActionable && (
             <Badge variant="outline" className="w-full py-1.5 flex items-center justify-center text-orange-600 border-orange-400 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300">
                <AlertTriangle className="h-4 w-4 mr-2" /> Awaiting Manager Review
            </Badge>
        )}
        {(canViewDetails || actionButtonText !== "View Details") && (
          <Button variant="outline" size="sm" className="w-full" onClick={actionHandler} disabled={actionButtonText === "No Actions Permitted"}>
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
  users: User[];
  onCardActionClick: (loan: LoanRequest) => void;
  currentUser: User | null;
  router: ReturnType<typeof useRouter>;
}

function KanbanColumn({ stageDef, loans, users, onCardActionClick, currentUser, router }: KanbanColumnProps) {
  const getAssignedUserName = (userId?: string) => {
    if (!userId) return undefined;
    return users.find(u => u.id === userId)?.fullName;
  };

  return (
    <div className="flex-shrink-0 w-80 bg-muted/50 rounded-lg p-1 md:p-2 min-h-[300px]">
      <div className="flex justify-between items-center p-2 mb-2 gap-2">
        <div className="flex items-center min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {stageDef.name}
            </h3>
        </div>
        <Badge variant="secondary" className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs h-6 min-w-[1.5rem] flex items-center justify-center">
            {loans.length}
        </Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-24rem)] pr-2">
        {loans.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground p-4 text-center">
            <p>No loan requests in this stage.</p>
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

  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);

  const activeWorkflows = useMemo(() => {
    if (!fetchedWorkflowDefinitions || fetchedWorkflowDefinitions.length === 0) return [];
    
    return fetchedWorkflowDefinitions.map(def => {
      const activeVersion = def.versions.find(v => v.isActive);
      return activeVersion ? { ...def, activeVersion } : null;
    }).filter(Boolean) as (WorkflowDefinition & { activeVersion: WorkflowVersion })[];

  }, [fetchedWorkflowDefinitions]);

  const getStageDefById = useCallback((versionId?: string, stageId?: string): WorkflowStageDefinition | null => {
    if (!versionId || !stageId || !fetchedWorkflowDefinitions) return null;
    for (const def of fetchedWorkflowDefinitions) {
      const version = def.versions.find(v => v.id === versionId);
      if (version) {
        const stage = version.stages.find(s => s.id === stageId);
        if (stage) return stage;
      }
    }
    return null;
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
    if (!currentUser) {
        toast({title: "Permission Denied", description: "You must be logged in to perform this action.", variant: "destructive"});
        return;
    }

    const canPromote = userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE) || userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK);
    const canMarkComplete = userPermissions.has(PERMISSIONS.MARK_STAGE_COMPLETE);

    setSelectedLoanForDialog(loan);
    const currentStageDef = getStageDefById(loan.workflowVersionId, loan.currentStageId);
    if (!currentStageDef) {
        toast({title: "Error", description: "Loan stage definition not found.", variant: "destructive"});
        return;
    }

    if (canPromote && loan.isReadyForManagerReview) {
        if (!validateLoanForNextStep(loan)) return;
        setIsPromoteDialogOpen(true);
    }
    else if (canMarkComplete && loan.assignedTo === currentUser.id && !loan.isReadyForManagerReview) {
        if (!validateLoanForNextStep(loan)) return;

        setIsProcessingAction(true);
        const officerName = usersFromService.find(u=>u.id === loan.assignedTo)?.fullName || currentUser.fullName || 'Officer';
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
    } else {
        if (userPermissions.has(PERMISSIONS.VIEW_LOAN_DETAILS)) {
            router.push(`/loan-requests/${loan.id}`);
        } else {
            toast({title: "Action Not Permitted", description: "You do not have permission for this action or the loan's state does not allow it.", variant: "warning"});
        }
    }
  }, [toast, validateLoanForNextStep, fetchPageData, getStageDefById, router, currentUser, userPermissions, usersFromService]);

  const handleConfirmPromotion = useCallback(async (loanId: string) => {
    if (!currentUser || !userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE)) {
        toast({title: "Permission Denied", description: "Only users with promote permission can promote loans.", variant: "destructive"});
        return;
    }
    const loanToPromote = allLoans.find(l => l.id === loanId);
    if (!loanToPromote) { toast({ title: "Error", description: "Loan not found.", variant: "destructive"}); return; }
    
    const currentWorkflow = activeWorkflows.find(wf => wf.activeVersion.id === loanToPromote.workflowVersionId);
    if (!currentWorkflow) { toast({ title: "Error", description: "Workflow version not found.", variant: "destructive"}); return; }
    
    const currentVersion = currentWorkflow.activeVersion;
    const currentStageIndex = currentVersion.stages.findIndex(s => s.id === loanToPromote.currentStageId);
    if (currentStageIndex === -1 || currentStageIndex >= currentVersion.stages.length - 1) {
      toast({ title: "Workflow End", description: "This is the last stage.", variant: "info" });
      setIsPromoteDialogOpen(false);
      return;
    }

    const nextStageDef = currentVersion.stages[currentStageIndex + 1];
    setIsProcessingAction(true);
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-promote-${Date.now()}`, stageName: nextStageDef.name, timestamp: formatISO(new Date()),
      userId: currentUser.id, userName: currentUser.fullName || 'System Process',
      notes: `Manager promoted from '${currentVersion.stages[currentStageIndex].name}' to '${nextStageDef.name}'. Case moved to ${nextStageDef.responsibleDepartment} department, now unassigned.`
    };
    
    const allUsers = await getLoanRequests().then(res => res.users || []);
    const nextDeptRecord = allUsers.find(u => u.department === nextStageDef.responsibleDepartment);

    const updatedFields: Partial<Omit<LoanRequest, 'id'>> = {
      currentStageId: nextStageDef.id,
      assignedDepartmentId: nextDeptRecord?.departmentId,
      assignedTo: undefined,
      history: [...(loanToPromote.history || []), newHistoryEntry],
      isReadyForManagerReview: false,
      lastUpdatedDate: formatISO(new Date()),
      stageDeadline: formatISO(addDays(new Date(), nextStageDef.defaultTimelineDays)),
      workflowVersionId: loanToPromote.workflowVersionId,
    };

    setAllLoans(prev => prev.map(l => l.id === loanId ? { ...l, ...updatedFields, assignedDepartment: nextStageDef.responsibleDepartment } : l));
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
  }, [allLoans, toast, fetchPageData, activeWorkflows, currentUser, userPermissions]);

  const loansByStageAndDepartment = useCallback((stageId: string, departmentName: string) => {
    return allLoans.filter(loan => 
        loan.currentStageId === stageId && 
        loan.assignedDepartment === departmentName
    );
  }, [allLoans]);

  const currentStageNameForDialog = useMemo(() => {
    if (!selectedLoanForDialog) return '';
    return getStageDefById(selectedLoanForDialog.workflowVersionId, selectedLoanForDialog.currentStageId)?.name || 'N/A';
  }, [selectedLoanForDialog, getStageDefById]);

  const nextStageNameForDialog = useMemo(() => {
    if (!selectedLoanForDialog || !fetchedWorkflowDefinitions) return '';
    const currentVersion = fetchedWorkflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === selectedLoanForDialog.workflowVersionId);
    if (!currentVersion) return '';
    const currentStageIndex = currentVersion.stages.findIndex(s => s.id === selectedLoanForDialog.currentStageId);
    if (currentStageIndex === -1 || currentStageIndex >= currentVersion.stages.length - 1) return '';
    return currentVersion.stages[currentStageIndex + 1]?.name || '';
  }, [selectedLoanForDialog, fetchedWorkflowDefinitions]);

  if (authLoading || isLoading) {
    return (<div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-3 text-lg">Loading loan pipelines & workflows...</p></div>);
  }
  if (error) { return (<Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertTriangle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescShadCN>{error}</AlertDescShadCN></Alert>); }

  if (activeWorkflows.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Pipelines</h1>
            <p className="text-muted-foreground">Visualize and manage loans through their lifecycle.</p>
          </div>
          {currentUser && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
            <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
          )}
        </div>
        <Alert variant="default" className="max-w-2xl mx-auto">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitleShadCN>No Active Loan Pipelines Found</AlertTitleShadCN>
          <AlertDescShadCN>
            There are no departments with an active workflow version configured.
            Please go to Settings to define loan workflows for each department.
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
          <p className="text-muted-foreground">Visualize and manage loans through their lifecycle for each department's workflow.</p>
        </div>
        {currentUser && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
           <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
        )}
      </div>

      {activeWorkflows.map(workflow => (
        <div key={workflow.id} className="mb-10 p-4 border rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-1 text-primary flex items-center">
             <Building className="mr-3 h-6 w-6"/> {workflow.departmentName} Department: {workflow.name}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Active Version: {workflow.activeVersion.versionNumber} | Stages: {workflow.activeVersion.stages.length}</p>
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex gap-4">
              {workflow.activeVersion.stages.map((stageDef) => (
                <KanbanColumn
                  key={stageDef.id}
                  stageDef={stageDef}
                  loans={loansByStageAndDepartment(stageDef.id, workflow.departmentName)}
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
