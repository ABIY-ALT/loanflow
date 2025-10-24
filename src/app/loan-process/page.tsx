

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { LoanRequest, User, LoanHistoryEntry, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { PlusCircle, AlertTriangle, Clock, Loader2, ArrowRight, CheckSquare, Building, UserCheck, UserPlus, Eye, Flame, Users as UsersIcon, FileDigit } from 'lucide-react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

interface LoanCardProps {
  loan: LoanRequest;
  stageName: string;
  assignedUsers: User[];
  onCardActionClick: (loan: LoanRequest) => void;
  currentUser: User | null;
  router: ReturnType<typeof useRouter>;
}

function LoanCard({ loan, stageName, assignedUsers, onCardActionClick, currentUser, router }: LoanCardProps) {
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

    const isCurrentUserAssigned = loan.assignedToUsers.some(u => u.id === currentUser.id);

    if (canPromote && loan.isReadyForManagerReview) {
      actionButtonText = "Review & Promote";
      ActionIcon = UserCheck;
      actionHandler = () => onCardActionClick(loan);
    } else if (canMarkComplete && isCurrentUserAssigned && !loan.isReadyForManagerReview) {
      actionButtonText = "Mark Complete";
      ActionIcon = CheckSquare;
      actionHandler = () => onCardActionClick(loan);
    } else if (canAssignStaff && loan.assignedToUsers.length === 0 && loan.assignedDepartment) {
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
  
  const assignedNames = assignedUsers.length > 0
    ? assignedUsers.map(u => u.fullName).join(', ')
    : <span className="italic text-muted-foreground">Unassigned Staff</span>;


  return (
    <Card className={cn("mb-3 shadow-md hover:shadow-lg transition-shadow", loan.isUrgent && "border-red-500 border-2")}>
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
          <div className="flex items-center gap-2">
            {loan.isUrgent && (
              <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger><Flame className="h-5 w-5 text-red-500" /></TooltipTrigger><TooltipContent><p>Urgent</p></TooltipContent></Tooltip></TooltipProvider>
            )}
            {loan.isOverdue && (
              <TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger><AlertTriangle className="h-5 w-5 text-destructive" /></TooltipTrigger><TooltipContent><p>Overdue!</p></TooltipContent></Tooltip></TooltipProvider>
            )}
          </div>
        </div>
        <CardDescription className="text-xs truncate">{loan.loanNumber} / Dept: {loan.assignedDepartment || "N/A"}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 text-sm space-y-2">
        <p className="truncate">Amount: ${loan.loanAmount.toLocaleString()}</p>
        <p className="truncate flex items-center gap-1.5"><UsersIcon className="h-4 w-4 text-muted-foreground"/> {assignedNames}</p>
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
  onCardActionClick: (loan: LoanRequest) => void;
  currentUser: User | null;
  router: ReturnType<typeof useRouter>;
}

function KanbanColumn({ stageDef, loans, onCardActionClick, currentUser, router }: KanbanColumnProps) {

  const sortedLoans = useMemo(() => {
    return [...loans].sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return 0;
    });
  }, [loans]);

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
        {sortedLoans.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground p-4 text-center">
            <p>No loan requests in this stage.</p>
          </div>
        )}
        {sortedLoans.map((loan) => (
          <LoanCard
            key={loan.id}
            loan={loan}
            stageName={stageDef.name}
            assignedUsers={loan.assignedToUsers}
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [selectedLoanForDialog, setSelectedLoanForDialog] = useState<LoanRequest | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);

  const loansWithWorkflows = useMemo(() => {
    if (!allLoans.length || !fetchedWorkflowDefinitions.length) return [];
    
    return allLoans.map(loan => {
      const workflowVersion = fetchedWorkflowDefinitions
        .flatMap(def => def.versions)
        .find(v => v.id === loan.workflowVersionId);
      
      if (!workflowVersion) return null;

      const stagesByDept = workflowVersion.stages.reduce((acc, stage) => {
        const dept = stage.responsibleDepartment;
        if (!acc[dept]) {
          acc[dept] = [];
        }
        acc[dept].push(stage);
        return acc;
      }, {} as Record<string, WorkflowStageDefinition[]>);

      return {
        loan,
        workflowVersion,
        stagesByDept,
      };
    }).filter(Boolean) as { loan: LoanRequest; workflowVersion: WorkflowVersion; stagesByDept: Record<string, WorkflowStageDefinition[]> }[];
  }, [allLoans, fetchedWorkflowDefinitions]);


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

  if (authLoading || isLoading) {
    return (<div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-3 text-lg">Loading loan pipelines & workflows...</p></div>);
  }
  if (error) { return (<Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertTriangle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescShadCN>{error}</AlertDescShadCN></Alert>); }

  if (loansWithWorkflows.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Pipeline</h1>
            <p className="text-muted-foreground">Visualize and manage loans through their lifecycle.</p>
          </div>
          {currentUser && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
            <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
          )}
        </div>
        <Alert variant="default" className="max-w-2xl mx-auto">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitleShadCN>No Active Loans Found</AlertTitleShadCN>
          <AlertDescShadCN>
            There are no active loans in the system to display in the pipeline.
          </AlertDescShadCN>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Pipeline</h1>
          <p className="text-muted-foreground">Expand a loan to view its complete workflow, grouped by department.</p>
        </div>
        {currentUser && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
           <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
        )}
      </div>

      <Accordion type="multiple" className="w-full space-y-4">
        {loansWithWorkflows.map(({ loan, workflowVersion, stagesByDept }) => (
          <AccordionItem value={loan.id} key={loan.id} className="border-none">
             <Card className="shadow-lg">
                <AccordionTrigger className="hover:no-underline data-[state=open]:border-b-0 p-0">
                  <CardHeader className="flex flex-row justify-between items-center w-full p-4 hover:bg-muted/30 rounded-t-lg transition-colors">
                     <div className="text-left">
                        <CardTitle className="text-2xl font-semibold text-primary flex items-center">
                          <FileDigit className="mr-3 h-6 w-6"/> {loan.customerName}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {loan.loanNumber} - {loan.loanType} - Workflow: {workflowVersion.workflowDefinition?.name} (v{workflowVersion.versionNumber})
                        </CardDescription>
                      </div>
                      <div className="text-right">
                          <Badge variant={loan.currentStageId === workflowVersion.stages[workflowVersion.stages.length - 1].id ? 'default' : 'secondary'}>
                            {getStageDefById(loan.workflowVersionId, loan.currentStageId)?.name || 'Unknown Stage'}
                          </Badge>
                      </div>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                    <CardContent className="p-4 space-y-4">
                      {Object.entries(stagesByDept).map(([deptName, stages]) => (
                        <div key={deptName}>
                          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Building className="h-5 w-5 text-muted-foreground" /> {deptName} Department</h3>
                          <ScrollArea className="w-full whitespace-nowrap pb-4">
                            <div className="flex gap-4">
                              {stages.map((stageDef) => (
                                <div key={stageDef.id} className={cn("flex-shrink-0 w-80 rounded-lg p-2 min-h-[150px] border-2", loan.currentStageId === stageDef.id ? 'border-primary bg-primary/5' : 'bg-muted/30')}>
                                  <div className="flex justify-between items-center p-2 mb-2 gap-2">
                                    <h4 className="font-semibold text-foreground truncate">{stageDef.order + 1}. {stageDef.name}</h4>
                                    {loan.currentStageId === stageDef.id && <Badge>Current</Badge>}
                                  </div>
                                  <div className="p-2 text-sm">
                                      <p><span className="font-semibold">Timeline:</span> {stageDef.defaultTimelineDays} days</p>
                                      <p><span className="font-semibold">Documents:</span> {stageDef.documentRequirements.length}</p>
                                      {loan.currentStageId === stageDef.id && (
                                        <>
                                          <p className="mt-2 flex items-center gap-1.5"><UsersIcon className="h-4 w-4"/>
                                            {loan.assignedToUsers.length > 0 ? loan.assignedToUsers.map(u => u.fullName).join(', ') : <span className="italic">Unassigned</span>}
                                          </p>
                                          <Link href={`/loan-requests/${loan.id}`} passHref>
                                            <Button variant="outline" size="sm" className="w-full mt-4">
                                              <Eye className="mr-2 h-4 w-4" /> View Details
                                            </Button>
                                          </Link>
                                        </>
                                      )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </div>
                      ))}
                    </CardContent>
                </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>

      <ManagerPromoteDialog
        isOpen={isPromoteDialogOpen}
        onOpenChange={(isOpen) => { setIsPromoteDialogOpen(isOpen); if (!isOpen) setSelectedLoanForDialog(null); }}
        selectedLoan={selectedLoanForDialog}
        isProcessingAction={isProcessingAction}
      />
    </div>
  );
}

