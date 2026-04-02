
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import type { LoanRequest, LoanDocument, LoanHistoryEntry, User as UserType, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, DocumentRequirement } from '@/types/loan';
import { LoanDocumentStatus, DocumentRequirementType, LoanDocumentStatus as AppLoanDocumentStatus } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLoanRequestById, updateLoanRequest, getWorkflowDefinitions, recordCaseReview } from '@/services/loan-service-prisma';
import { Loader2, AlertCircle, LayoutDashboard, Clock, Building, User, ClipboardList, Info as InfoIcon, FileText, SearchCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { LoanDetailHeader } from '@/components/loan/detail/LoanDetailHeader';
import { LoanProgressDisplay } from '@/components/loan/detail/LoanProgressDisplay';
import { LoanInfoDisplay } from '@/components/loan/detail/LoanInfoDisplay';
import { LoanDocumentsManager } from '@/components/loan/detail/LoanDocumentsManager';
import { LoanAuditTrail } from '@/components/loan/detail/LoanAuditTrail';

import { EditLoanDetailsDialog } from '@/components/loan/dialogs/EditLoanDetailsDialog';
import { AddNoteToLoanDialog } from '@/components/loan/dialogs/AddNoteToLoanDialog';
import { LogInfoRequestForLoanDialog } from '@/components/loan/dialogs/LogInfoRequestForLoanDialog';
import { ReturnLoanForReworkDialog } from '@/components/loan/dialogs/ReturnLoanForReworkDialog';
import { UploadLoanDocumentDialog } from '@/components/loan/dialogs/UploadLoanDocumentDialog';
import { TerminateLoanDialog } from '@/components/loan/dialogs/TerminateLoanDialog';
import { ManualTransitionDialog } from '@/components/loan/dialogs/ManualTransitionDialog';
import { RespondToInfoRequestDialog } from '@/components/loan/dialogs/RespondToInfoRequestDialog';

export default function LoanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const loanId = params.id as string;
  
  const { user: currentUser, isLoading: authLoading } = useAuth();

  const [loan, setLoan] = useState<LoanRequest | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditLoanDialogOpen, setIsEditLoanDialogOpen] = useState(false);
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [isLogInfoDialogOpen, setIsLogInfoDialogOpen] = useState(false);
  const [isUploadDocDialogOpen, setIsUploadDocDialogOpen] = useState(false);
  const [currentDocumentRequirementToUpload, setCurrentDocumentRequirementToUpload] = useState<DocumentRequirement | null>(null);
  const [isReturnForReworkDialogOpen, setIsReturnForReworkDialogOpen] = useState(false);
  const [isTerminateLoanDialogOpen, setIsTerminateLoanDialogOpen] = useState(false);
  const [isManualTransitionDialogOpen, setIsManualTransitionDialogOpen] = useState(false);
  const [isApproveReassignDialogOpen, setIsApproveReassignDialogOpen] = useState(false);
  const [isRespondToInfoDialogOpen, setIsRespondToInfoDialogOpen] = useState(false);
  const [selectedEntryForResponse, setSelectedEntryForResponse] = useState<LoanHistoryEntry | null>(null);
  
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);
  
  const isAdmin = useMemo(() => userPermissions.has(PERMISSIONS.MANAGE_USERS), [userPermissions]);
  const isAssigned = useMemo(() => loan?.assignedToUsers.some(u => u.id === currentUser?.id), [loan, currentUser]);
  const isCreator = useMemo(() => loan?.createdById === currentUser?.id, [loan, currentUser]);
  const hasHistoryInvolvement = useMemo(() => {
    if (!loan || !currentUser) return false;
    return (loan.history || []).some(h => h.userId === currentUser.id);
  }, [loan, currentUser]);
  const isInActiveDept = useMemo(() => currentUser?.department === loan?.assignedDepartment, [currentUser, loan]);
  const isManagerInDept = useMemo(() => isInActiveDept && (userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE) || userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)), [isInActiveDept, userPermissions]);
  const hasDirectApprovePermission = useMemo(() => userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE), [userPermissions]);

  const canViewFullDetails = useMemo(() => {
    if (!currentUser || !loan) return false;
    if (isAdmin) return true;
    if (isCreator) return true;
    if (isAssigned) return true;
    if (isManagerInDept) return true;
    return false;
  }, [currentUser, loan, isAdmin, isCreator, isAssigned, isManagerInDept]);
  
  const isActionableInUserDepartment = useMemo(() => !loan?.isTerminalStage && isInActiveDept, [loan, isInActiveDept]);

  const currentWorkflowVersion = useMemo(() => {
    if (!loan || !workflowDefinitions || !loan.workflowVersionId) return null;
    const allVersions = workflowDefinitions.flatMap(def => def.versions);
    return allVersions.find(v => v.id === loan.workflowVersionId) || null;
  }, [loan, workflowDefinitions]);

  const currentStageDef = useMemo(() => {
    if (!loan || !currentWorkflowVersion || !loan.currentStageId) return null;
    return currentWorkflowVersion.stages.find(s => s.id === loan.currentStageId) || null;
  }, [loan, currentWorkflowVersion]);

  const currentWorkflowDef = useMemo(() => {
    if (!currentWorkflowVersion) return null;
    return workflowDefinitions.find(def => def.id === currentWorkflowVersion.workflowDefinitionId) || null;
  }, [currentWorkflowVersion, workflowDefinitions]);

  const getWorkflowCode = useCallback((name?: string | null) => {
    if (!name) return null;
    const match = name.match(/WF-(\d{1,2})/i);
    return match ? Number(match[1]) : null;
  }, []);

  const getSectorWorkflowSequence = useCallback((sectorId?: string | null) => {
    if (!sectorId) return [] as WorkflowDefinition[];
    const scoped = workflowDefinitions.filter(def => def.sectorId === sectorId && def.versions.some(v => v.isActive && v.stages.length > 0));
    const byCode = new Map<number, WorkflowDefinition>();

    for (const def of scoped) {
      const code = getWorkflowCode(def.name);
      if (code === null) continue;
      const existing = byCode.get(code);
      if (!existing || (def.order || 0) > (existing.order || 0)) {
        byCode.set(code, def);
      }
    }

    return Array.from(byCode.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, def]) => def);
  }, [workflowDefinitions, getWorkflowCode]);
  
  const canCurrentUserAct = useMemo(() => {
    if (!currentUser || !currentStageDef || !isActionableInUserDepartment || !loan) return false;
    if (isAdmin) return true;
    if (isAssigned || isManagerInDept) {
        const allowedRoles = currentStageDef.allowedRoles || [];
        if (allowedRoles.length === 0) return true; 
        return currentUser.customRoleName && allowedRoles.includes(currentUser.customRoleName);
    }
    return false;
  }, [currentUser, currentStageDef, isActionableInUserDepartment, loan, isAdmin, isAssigned, isManagerInDept]);

  const departmentApprovers = useMemo(() => {
    if (!loan?.assignedDepartment) return [];

    const inDepartment = users.filter(
      u => u.isActive && u.department === loan.assignedDepartment
    );

    const canPromoteInDepartment = inDepartment.filter(u =>
      u.permissions.includes(PERMISSIONS.PROMOTE_LOAN_STAGE)
    );

    if (canPromoteInDepartment.length > 0) {
      return canPromoteInDepartment;
    }

    return inDepartment.filter(u =>
      u.permissions.includes(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)
    );
  }, [users, loan?.assignedDepartment]);

  const fetchLoanData = useCallback(async () => {
    if (!loanId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const [loanResult, wfResult] = await Promise.all([ getLoanRequestById(loanId), getWorkflowDefinitions() ]);
      if (loanResult.error) { setError(loanResult.error); setLoan(null); }
      else if (loanResult.loan) { setLoan(loanResult.loan); setUsers(loanResult.users || []); }
      if (wfResult.error) { console.error(wfResult.error); }
      else if (wfResult.workflows) { setWorkflowDefinitions(wfResult.workflows); }
    } catch (err: any) { setError("An unexpected error occurred."); }
    finally { setIsLoading(false); }
  }, [loanId]);

  useEffect(() => { if (!authLoading) fetchLoanData(); }, [fetchLoanData, authLoading]);
  
  const handleLocalAndUpdateService = useCallback(async (
    updatedFields: Partial<Omit<LoanRequest, 'id'>> & { respondToInfoRequest?: { entryId: string, response: string, markFulfilled: boolean } },
    successMessage: string,
  ): Promise<{success: boolean; finalLoanState?: LoanRequest}> => {
    if (!loan) return {success: false};
    setIsSaving(true);
    const serviceResult = await updateLoanRequest(loan.id, { ...updatedFields, lastUpdatedDate: formatISO(new Date()) }); 
    if (serviceResult.error || !serviceResult.success) {
      toast({ title: "Update Error", description: serviceResult.error || "Failed to update.", variant: "destructive" });
      await fetchLoanData();
      setIsSaving(false);
      return {success: false};
    }
    toast({ title: "Update Successful", description: successMessage });
    if(serviceResult.updatedLoan) setLoan(serviceResult.updatedLoan);
    else await fetchLoanData();
    setIsSaving(false);
    return {success: true};
  }, [loan, toast, fetchLoanData]);

  const handleMarkStageComplete = async () => {
    if (!loan || !currentStageDef || !currentUser) return;

    const canMarkStageComplete = userPermissions.has(PERMISSIONS.MARK_STAGE_COMPLETE);
    const canDirectPromote = hasDirectApprovePermission;
    if (!canMarkStageComplete && !canDirectPromote) {
      toast({
        title: 'Permission Denied',
        description: 'You can assign/reassign this case, but you cannot mark this stage complete.',
        variant: 'destructive',
      });
      return;
    }

    if (canDirectPromote) {
      await handleManagerPromoteLoan(true);
      return;
    }

    const completedUserIds = new Set(loan.stageCompletedBy?.map(u => u.id) || []);
    completedUserIds.add(currentUser.id);
    const updatedStageCompletedBy = users.filter(u => completedUserIds.has(u.id));

    const routedApprovers = departmentApprovers;
    const shouldRouteToApprovers = true;
    const hasExistingAssignee = (loan.assignedToUsers?.length || 0) > 0;

    const historyNote = shouldRouteToApprovers
      ? hasExistingAssignee
        ? `Marked complete and sent to pending approval queue. Existing assignee retained for same-department continuity.`
        : routedApprovers.length > 0
          ? `Marked complete and routed to ${routedApprovers.map(u => u.fullName).join(', ')} for approval.`
          : `Marked complete and sent to pending approval queue. No approver found in department.`
      : `Marked complete. Pending approval.`;

    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-complete-${Date.now()}`,
      stageName: currentStageDef.name,
      timestamp: formatISO(new Date()),
      userId: currentUser.id,
      userName: currentUser.fullName,
      notes: historyNote,
    };

    const updatePayload: Partial<Omit<LoanRequest, 'id'>> = {
      currentStageStatus: 'Pending Approval',
      isReadyForManagerReview: true,
      stageCompletedBy: updatedStageCompletedBy,
      history: [...loan.history, newHistoryEntry],
    };

    if (shouldRouteToApprovers && !hasExistingAssignee) {
      updatePayload.assignedToUsers = routedApprovers;
    }

    await handleLocalAndUpdateService(
      updatePayload,
      shouldRouteToApprovers
        ? routedApprovers.length > 0
          ? "Marked complete and routed for approval."
          : "Marked complete and set to pending approval."
        : "Marked complete. You can approve directly."
    );

    if (shouldRouteToApprovers && !hasExistingAssignee && routedApprovers.length === 0) {
      toast({
        title: 'No approver found',
        description: 'Case is pending approval, but no Manager/Department Head user was found in this department.',
        variant: 'destructive',
      });
    }
  };

  const handleManagerPromoteLoan = async (isDirect: boolean = false, reassignedUsers?: UserType[]) => {
    if (!currentUser || !loan || !currentWorkflowVersion || !currentStageDef || !currentWorkflowDef) return;
    const idx = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
    if (idx === -1) return;
    const actionText = isDirect ? `Completed & Promoted by ${currentUser.customRoleName}` : `Approved & Promoted by Manager`;
    const reassignmentNote = reassignedUsers && reassignedUsers.length > 0
      ? ` Reassigned next stage to ${reassignedUsers.map(u => u.fullName).join(', ')}.`
      : '';
    const isFinalStageInWorkflow = idx === currentWorkflowVersion.stages.length - 1;
    const currentWorkflowCode = getWorkflowCode(currentWorkflowDef.name);
    const isDisbursementWorkflow = currentWorkflowCode === 6 || /disbursement/i.test(currentWorkflowDef.name || '');
    const isDisbursementStage = /disbursement/i.test(currentStageDef.name || '');
    const shouldForceTerminalAfterThisStage = isFinalStageInWorkflow && (isDisbursementWorkflow || isDisbursementStage);

    if (shouldForceTerminalAfterThisStage) {
        const terminalNote = `${actionText}. Final disbursement complete. Loan marked as terminal.${reassignmentNote}`;
        const hist: LoanHistoryEntry = {
          id: `hist-terminal-${Date.now()}`,
          stageName: currentStageDef.name,
          timestamp: formatISO(new Date()),
          userId: currentUser.id,
          userName: currentUser.fullName,
          notes: terminalNote,
        };
        await recordCaseReview({ loanRequestId: loan.id, action: 'APPROVED', comment: terminalNote });
        await handleLocalAndUpdateService(
          {
            isTerminalStage: true,
            isReadyForManagerReview: false,
            currentStageStatus: 'Completed',
            stageCompletedBy: [],
            history: [...loan.history, hist],
          },
          'Final disbursement completed. Loan process ended.'
        );
        return;
    }

    if (isFinalStageInWorkflow) {
        const loanWorkflows = getSectorWorkflowSequence(loan.sectorId);
        const wfIdx = loanWorkflows.findIndex(def => def.id === currentWorkflowDef.id);

        if (wfIdx === -1 || wfIdx === loanWorkflows.length - 1) {
          const terminalNote = `${actionText}. Final workflow complete. Loan marked as terminal.${reassignmentNote}`;
          const hist: LoanHistoryEntry = {
            id: `hist-terminal-${Date.now()}`,
            stageName: currentStageDef.name,
            timestamp: formatISO(new Date()),
            userId: currentUser.id,
            userName: currentUser.fullName,
            notes: terminalNote,
          };
          await recordCaseReview({ loanRequestId: loan.id, action: 'APPROVED', comment: terminalNote });
          await handleLocalAndUpdateService(
            {
              isTerminalStage: true,
              isReadyForManagerReview: false,
              currentStageStatus: 'Completed',
              stageCompletedBy: [],
              history: [...loan.history, hist],
            },
            'Final workflow completed. Loan process ended.'
          );
          return;
        }

        const nextWf = loanWorkflows[wfIdx + 1];
        const nextVer = nextWf.versions.find(v => v.isActive);
        if (!nextVer || nextVer.stages.length === 0) return;
        const firstStage = nextVer.stages[0];
        const hist: LoanHistoryEntry = { id: `hist-wf-${Date.now()}`, stageName: firstStage.name, timestamp: formatISO(new Date()), userId: currentUser.id, userName: currentUser.fullName, notes: `${actionText}. Workflow complete. Moved to '${nextWf.name}'.${reassignmentNote}` };
        await recordCaseReview({ loanRequestId: loan.id, action: 'APPROVED', comment: `${actionText}. Moved to '${nextWf.name}'.${reassignmentNote}` });
        const workflowTransitionPayload: Partial<Omit<LoanRequest, 'id'>> = {
          workflowVersionId: nextVer.id,
          currentStageId: firstStage.id,
          assignedDepartmentId: nextWf.departmentId,
          stageCompletedBy: [],
          isReadyForManagerReview: false,
          isTerminalStage: false,
          history: [...loan.history, hist],
          stageDeadline: formatISO(addDays(new Date(), firstStage.defaultTimelineDays)),
        };
        if (reassignedUsers !== undefined) {
          workflowTransitionPayload.assignedToUsers = reassignedUsers;
        }
        await handleLocalAndUpdateService(workflowTransitionPayload, `Loan moved to ${nextWf.name}.`);
    } else {
        const nextStage = currentWorkflowVersion.stages[idx + 1];
        const hist: LoanHistoryEntry = { id: `hist-stg-${Date.now()}`, stageName: nextStage.name, timestamp: formatISO(new Date()), userId: currentUser.id, userName: currentUser.fullName, notes: `${actionText}. Moved to stage '${nextStage.name}'.${reassignmentNote}` };
        await recordCaseReview({ loanRequestId: loan.id, action: 'APPROVED', comment: `${actionText}. Moved to stage '${nextStage.name}'.${reassignmentNote}` });
        const stageTransitionPayload: Partial<Omit<LoanRequest, 'id'>> = {
          currentStageId: nextStage.id,
          assignedDepartmentId: users.find(u => u.department === nextStage.responsibleDepartment)?.departmentId,
          stageCompletedBy: [],
          history: [...loan.history, hist],
          isReadyForManagerReview: false,
          isTerminalStage: false,
          stageDeadline: formatISO(addDays(new Date(), nextStage.defaultTimelineDays)),
        };
        if (reassignedUsers !== undefined) {
          stageTransitionPayload.assignedToUsers = reassignedUsers;
        }
        await handleLocalAndUpdateService(stageTransitionPayload, `Promoted to ${nextStage.name}.`);
    }
  };

  const handleAssignLoan = async (assignedUserIds: string[]) => {
    const selectedUsers = users.filter(u => assignedUserIds.includes(u.id));
    const result = await handleLocalAndUpdateService(
      {
        assignedToUsers: selectedUsers,
        isReadyForManagerReview: false,
      },
      "Assigned."
    );

    if (!result.success) {
      return;
    }

    setIsEditLoanDialogOpen(false);
    router.refresh();

    const shouldOpenAssignedCases =
      !!currentUser &&
      userPermissions.has(PERMISSIONS.VIEW_OWN_ASSIGNED_CASES) &&
      selectedUsers.some(user => user.id === currentUser.id);

    if (shouldOpenAssignedCases) {
      router.push('/my-assigned-cases');
    }
  };

  const handleDocumentCheckboxChange = async (
    requirement: DocumentRequirement,
    checked: boolean
  ) => {
    if (!loan || requirement.type !== DocumentRequirementType.CHECKBOX || !canCurrentUserAct) {
      return;
    }

    const existing = loan.documents.find((d) => d.requirementId === requirement.id);
    const nowIso = formatISO(new Date());

    const nextDocuments: LoanDocument[] = checked
      ? existing
        ? loan.documents.map((d) =>
            d.id === existing.id
              ? { ...d, status: AppLoanDocumentStatus.VERIFIED, uploadedAt: d.uploadedAt || nowIso }
              : d
          )
        : [
            ...loan.documents,
            {
              id: `doc-check-${Date.now()}`,
              name: requirement.name,
              requirementId: requirement.id,
              status: AppLoanDocumentStatus.VERIFIED,
              uploadedAt: nowIso,
            },
          ]
      : existing
      ? loan.documents.map((d) =>
          d.id === existing.id ? { ...d, status: AppLoanDocumentStatus.PENDING } : d
        )
      : loan.documents;

    if (nextDocuments === loan.documents) {
      return;
    }

    await handleLocalAndUpdateService(
      { documents: nextDocuments },
      checked ? 'Checklist item checked.' : 'Checklist item unchecked.'
    );
  };

  if (authLoading || isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  if (error || !loan) return <div className="p-8 text-center"><AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" /><h1 className="text-xl font-bold">{error || 'Loan not found.'}</h1><Button className="mt-4" onClick={() => router.push('/')}>Dashboard</Button></div>;

  if (!canViewFullDetails) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1.5 py-1 px-3"><SearchCheck className="h-3.5 w-3.5" />Tracking Mode</Badge>
        </div>
        <Card className="shadow-lg border-primary/10 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-6">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3"><LayoutDashboard className="h-6 w-6" />Loan Status Tracker</CardTitle>
                <CardDescription className="text-base mt-1">Real-time status for <span className="font-semibold text-foreground">{loan.customerName}</span> (ID: {loan.loanNumber})</CardDescription>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                  <Badge className="px-3 py-1.5 font-bold uppercase">{currentStageDef?.name || loan.currentStageName || 'Processing'}</Badge>
                  <Badge variant="outline" className="bg-background">{loan.assignedDepartment}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 py-8 border-b bg-background"><LoanProgressDisplay loan={loan} progressPercentage={0} currentStageName={currentStageDef?.name || 'Current Stage'}/></div>
            <div className="p-6">
              <Tabs defaultValue="history" className="w-full">
                <TabsList className="bg-muted/50 p-1"><TabsTrigger value="history" className="gap-2"><ClipboardList className="h-4 w-4"/> Chronological History</TabsTrigger></TabsList>
                <TabsContent value="history" className="pt-6"><LoanAuditTrail loan={loan} isRestricted={true} /></TabsContent>
              </Tabs>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 p-4 border-t flex justify-center italic text-xs text-muted-foreground font-medium">Sensitive financials and activity notes are restricted to assigned personnel.</CardFooter>
        </Card>
      </div>
    );
  }

  const availableStatuses = (currentStageDef?.availableStatuses && loan.assignedDepartment && currentStageDef.availableStatuses[loan.assignedDepartment]) || [];

  return (
    <div className="space-y-6">
      <LoanDetailHeader loan={loan} currentStageName={currentStageDef?.name || 'N/A'} onBack={() => router.back()} onOpenEditDialog={() => setIsEditLoanDialogOpen(true)} onOpenAddNoteDialog={() => setIsAddNoteDialogOpen(true)} onOpenLogInfoDialog={() => setIsLogInfoDialogOpen(true)} onMarkStageComplete={handleMarkStageComplete} onManagerPromoteLoan={() => handleManagerPromoteLoan(false)} onOpenApproveReassignDialog={() => setIsApproveReassignDialogOpen(true)} onOpenReturnForReworkDialog={() => setIsReturnForReworkDialogOpen(true)} onOpenTerminateLoanDialog={() => setIsTerminateLoanDialogOpen(true)} onOpenManualTransitionDialog={() => setIsManualTransitionDialogOpen(true)} isSaving={isSaving} isActionableStage={!loan.isTerminalStage && canCurrentUserAct} canPromote={userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE)} requiresApproval={currentStageDef?.requiresApproval ?? true} />
      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div><CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle><CardDescription>ID: {loan.loanNumber}</CardDescription></div>
            <div className="flex flex-col items-end gap-2 text-right">
                <Badge className="px-3 py-1.5 font-medium">{currentStageDef?.name || 'Stage'}</Badge>
                {availableStatuses.length > 0 && !loan.isTerminalStage && canCurrentUserAct ? (
                  <Select value={loan.currentStageStatus || ''} onValueChange={s => handleLocalAndUpdateService({ currentStageStatus: s }, "Status updated.")} disabled={isSaving}><SelectTrigger className="h-8 text-sm w-40"><SelectValue placeholder="Set Status" /></SelectTrigger><SelectContent>{availableStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                ) : ( loan.currentStageStatus && <Badge variant="secondary">{loan.currentStageStatus}</Badge> )}
                {loan.isUrgent && <Badge variant="destructive" className="animate-pulse">URGENT</Badge>}
                {loan.isReadyForManagerReview && !loan.isTerminalStage && <Badge variant="outline" className="border-orange-500 bg-orange-50 text-orange-700">Awaiting Manager Review</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-6 pt-6"><LoanProgressDisplay loan={loan} progressPercentage={0} currentStageName={currentStageDef?.name || 'N/A'}/></div>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-12">
              <TabsTrigger value="overview" className="gap-2"><InfoIcon className="h-4 w-4"/> Info</TabsTrigger>
              <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4"/> Docs</TabsTrigger>
              <TabsTrigger value="history" className="gap-2"><ClipboardList className="h-4 w-4"/> Case History</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="p-6"><LoanInfoDisplay loan={loan} assignedUsers={loan.assignedToUsers} assignedDepartment={loan.assignedDepartment} /></TabsContent>
            <TabsContent value="documents" className="p-6"><LoanDocumentsManager loan={loan} currentStageDef={currentStageDef} isSavingGlobal={isSaving} onVerifyDocument={d => handleLocalAndUpdateService({ documents: loan.documents.map(x => x.id === d ? { ...x, status: AppLoanDocumentStatus.VERIFIED } : x) }, "Verified.")} onCheckboxChange={canCurrentUserAct ? handleDocumentCheckboxChange : undefined} onOpenUploadDialog={r => { setCurrentDocumentRequirementToUpload(r); setIsUploadDocDialogOpen(true); }}/></TabsContent>
            <TabsContent value="history" className="p-6"><LoanAuditTrail loan={loan} isSavingGlobal={isSaving} onRespondToRequest={e => { setSelectedEntryForResponse(e); setIsRespondToInfoDialogOpen(true); }}/></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <EditLoanDetailsDialog isOpen={isEditLoanDialogOpen} onOpenChange={setIsEditLoanDialogOpen} loan={loan} users={users.filter(u => u.department === loan.assignedDepartment)} currentDepartment={loan.assignedDepartment} onSubmit={async d => { await handleAssignLoan(d.assignedTo || []); }} isSaving={isSaving} />
      <EditLoanDetailsDialog isOpen={isApproveReassignDialogOpen} onOpenChange={setIsApproveReassignDialogOpen} loan={loan} users={users.filter(u => u.department === loan.assignedDepartment)} currentDepartment={loan.assignedDepartment} title="Approve And Reassign" description="Select the users who should own the next stage in this same department. If the next stage moves to another department, the assignment will be cleared automatically." submitLabel="Approve And Promote" onSubmit={async d => { const uIds = d.assignedTo || []; await handleManagerPromoteLoan(false, users.filter(u => uIds.includes(u.id))); setIsApproveReassignDialogOpen(false); }} isSaving={isSaving} />
      <AddNoteToLoanDialog isOpen={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen} onSubmit={async n => { const h: LoanHistoryEntry = { id: `n-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', notes: n }; await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Note added."); setIsAddNoteDialogOpen(false); }} isSaving={isSaving} />
      <LogInfoRequestForLoanDialog isOpen={isLogInfoDialogOpen} onOpenChange={setIsLogInfoDialogOpen} onSubmit={async r => { const h: LoanHistoryEntry = { id: `ir-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', requiredFulfilment: r, isFulfilled: false }; await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Request logged."); setIsLogInfoDialogOpen(false); }} isSaving={isSaving} />
      <UploadLoanDocumentDialog isOpen={isUploadDocDialogOpen} onOpenChange={setIsUploadDocDialogOpen} loanId={loan.id} documentRequirement={currentDocumentRequirementToUpload} onSubmitAfterUpload={async (r, p, f) => { const nd: LoanDocument = { id: `doc-${Date.now()}`, name: r.name, requirementId: r.id, status: AppLoanDocumentStatus.SUBMITTED, filePath: p, uploadedAt: formatISO(new Date()) }; await handleLocalAndUpdateService({ documents: [...loan.documents, nd] }, "Uploaded."); setIsUploadDocDialogOpen(false); }} isParentSaving={isSaving} />
      <RespondToInfoRequestDialog isOpen={isRespondToInfoDialogOpen} onOpenChange={setIsRespondToInfoDialogOpen} entry={selectedEntryForResponse} onSubmit={async (id, res, fulfilled) => { await handleLocalAndUpdateService({ respondToInfoRequest: { entryId: id, response: res, markFulfilled: fulfilled } }, "Response saved."); setIsRespondToInfoDialogOpen(false); }} isSaving={isSaving} />
      <ReturnLoanForReworkDialog isOpen={isReturnForReworkDialogOpen} onOpenChange={setIsReturnForReworkDialogOpen} loan={loan} users={users.filter(u => u.department === loan.assignedDepartment)} currentDepartment={loan.assignedDepartment} onSubmit={async (note, assigneeIds) => { const h: LoanHistoryEntry = { id: `rw-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', notes: `Returned for rework: ${note}` }; await recordCaseReview({ loanRequestId: loan.id, action: 'REWORKED', comment: note }); await handleLocalAndUpdateService({ assignedToUsers: users.filter(u => assigneeIds.includes(u.id)), stageCompletedBy: [], isReadyForManagerReview: false, history: [...loan.history, h] }, "Returned for rework."); setIsReturnForReworkDialogOpen(false); }} isSaving={isSaving} />
    </div>
  );
}
