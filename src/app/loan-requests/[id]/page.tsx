
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
import { getLoanRequestById, updateLoanRequest, getWorkflowDefinitions } from '@/services/loan-service-prisma';
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
  const [isRespondToInfoDialogOpen, setIsRespondToInfoDialogOpen] = useState(false);
  const [selectedEntryForResponse, setSelectedEntryForResponse] = useState<LoanHistoryEntry | null>(null);
  
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);
  
  const isAdmin = useMemo(() => userPermissions.has(PERMISSIONS.MANAGE_USERS), [userPermissions]);
  const isAssigned = useMemo(() => loan?.assignedToUsers.some(u => u.id === currentUser?.id), [loan, currentUser]);
  const isInActiveDept = useMemo(() => currentUser?.department === loan?.assignedDepartment, [currentUser, loan]);
  const isManagerInDept = useMemo(() => isInActiveDept && (userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE) || userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)), [isInActiveDept, userPermissions]);

  const canViewFullDetails = useMemo(() => {
    if (!currentUser || !loan) return false;
    if (isAdmin) return true;
    if (isAssigned) return true;
    if (isManagerInDept) return true;
    return false;
  }, [currentUser, loan, isAdmin, isAssigned, isManagerInDept]);
  
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
    const completedUserIds = new Set(loan.stageCompletedBy?.map(u => u.id) || []);
    completedUserIds.add(currentUser.id);
    const assignedUserIds = new Set(loan.assignedToUsers.map(u => u.id));
    const allAssignedHaveCompleted = assignedUserIds.size === 0 || Array.from(assignedUserIds).every(id => completedUserIds.has(id));
    const updatedStageCompletedBy = users.filter(u => completedUserIds.has(u.id));
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-complete-${Date.now()}`,
      stageName: currentStageDef.name,
      timestamp: formatISO(new Date()),
      userId: currentUser.id,
      userName: currentUser.fullName,
      notes: allAssignedHaveCompleted ? `Stage submitted for review.` : `Partial completion recorded.`,
    };
    await handleLocalAndUpdateService({ isReadyForManagerReview: allAssignedHaveCompleted, stageCompletedBy: updatedStageCompletedBy, history: [...loan.history, newHistoryEntry] }, allAssignedHaveCompleted ? "Submitted for review." : "Partial completion recorded.");
  };

  const handleManagerPromoteLoan = async (isDirect: boolean = false) => {
    if (!currentUser || !loan || !currentWorkflowVersion || !currentStageDef || !currentWorkflowDef) return;
    // Prevent immediate self-approval unless explicitly allowed
    if (
      currentStageDef.requiresApproval &&
      loan.stageCompletedBy.length === 1 &&
      loan.stageCompletedBy[0].id === currentUser.id &&
      !isDirect // Only block if not direct promotion (i.e., approval path)
    ) {
      toast({
        title: "Approval Blocked",
        description: "You cannot approve a stage you just completed. Another user must approve, or direct promotion must be enabled.",
        variant: "destructive"
      });
      return;
    }
    const idx = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
    if (idx === -1) return;
    const actionText = isDirect ? `Completed & Promoted by ${currentUser.customRoleName}` : `Approved & Promoted by Manager`;

    if (idx === currentWorkflowVersion.stages.length - 1) {
        const loanWorkflows = workflowDefinitions.filter(def => def.parentSectorId === currentWorkflowDef.parentSectorId).sort((a, b) => (a.order || 0) - (b.order || 0));
        const wfIdx = loanWorkflows.findIndex(def => def.id === currentWorkflowDef.id);
        if (wfIdx === -1 || wfIdx === loanWorkflows.length - 1) return;
        const nextWf = loanWorkflows[wfIdx + 1];
        const nextVer = nextWf.versions.find(v => v.isActive);
        if (!nextVer || nextVer.stages.length === 0) return;
        const firstStage = nextVer.stages[0];
        const hist: LoanHistoryEntry = { id: `hist-wf-${Date.now()}`, stageName: firstStage.name, timestamp: formatISO(new Date()), userId: currentUser.id, userName: currentUser.fullName, notes: `${actionText}. Workflow complete. Moved to '${nextWf.name}'.` };
        await handleLocalAndUpdateService({ workflowVersionId: nextVer.id, currentStageId: firstStage.id, assignedDepartmentId: nextWf.departmentId, assignedToUsers: [], stageCompletedBy: [], isReadyForManagerReview: false, history: [...loan.history, hist], stageDeadline: formatISO(addDays(new Date(), firstStage.defaultTimelineDays)) }, `Loan moved to ${nextWf.name}.`);
    } else {
        const nextStage = currentWorkflowVersion.stages[idx + 1];
        const hist: LoanHistoryEntry = { id: `hist-stg-${Date.now()}`, stageName: nextStage.name, timestamp: formatISO(new Date()), userId: currentUser.id, userName: currentUser.fullName, notes: `${actionText}. Moved to stage '${nextStage.name}'.` };
        await handleLocalAndUpdateService({ currentStageId: nextStage.id, assignedDepartmentId: users.find(u => u.department === nextStage.responsibleDepartment)?.departmentId, assignedToUsers: [], stageCompletedBy: [], history: [...loan.history, hist], isReadyForManagerReview: false, stageDeadline: formatISO(addDays(new Date(), nextStage.defaultTimelineDays)) }, `Promoted to ${nextStage.name}.`);
    }
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
      <LoanDetailHeader loan={loan} currentStageName={currentStageDef?.name || 'N/A'} onBack={() => router.back()} onOpenEditDialog={() => setIsEditLoanDialogOpen(true)} onOpenAddNoteDialog={() => setIsAddNoteDialogOpen(true)} onOpenLogInfoDialog={() => setIsLogInfoDialogOpen(true)} onMarkStageComplete={handleMarkStageComplete} onManagerPromoteLoan={() => handleManagerPromoteLoan(false)} onOpenReturnForReworkDialog={() => setIsReturnForReworkDialogOpen(true)} onOpenTerminateLoanDialog={() => setIsTerminateLoanDialogOpen(true)} onOpenManualTransitionDialog={() => setIsManualTransitionDialogOpen(true)} isSaving={isSaving} isActionableStage={!loan.isTerminalStage && canCurrentUserAct} canPromote={userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE)} requiresApproval={currentStageDef?.requiresApproval ?? true} />
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
            <TabsContent value="documents" className="p-6"><LoanDocumentsManager loan={loan} currentStageDef={currentStageDef} isSavingGlobal={isSaving} onVerifyDocument={d => handleLocalAndUpdateService({ documents: loan.documents.map(x => x.id === d ? { ...x, status: AppLoanDocumentStatus.VERIFIED } : x) }, "Verified.")} onOpenUploadDialog={r => { setCurrentDocumentRequirementToUpload(r); setIsUploadDocDialogOpen(true); }}/></TabsContent>
            <TabsContent value="history" className="p-6"><LoanAuditTrail loan={loan} isSavingGlobal={isSaving} onRespondToRequest={e => { setSelectedEntryForResponse(e); setIsRespondToInfoDialogOpen(true); }}/></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <EditLoanDetailsDialog isOpen={isEditLoanDialogOpen} onOpenChange={setIsEditLoanDialogOpen} loan={loan} users={users.filter(u => u.department === loan.assignedDepartment)} currentDepartment={loan.assignedDepartment} onSubmit={async d => { const uIds = d.assignedTo || []; await handleLocalAndUpdateService({ assignedToUsers: users.filter(u => uIds.includes(u.id)), isReadyForManagerReview: false }, "Assigned."); setIsEditLoanDialogOpen(false); }} isSaving={isSaving} />
      <AddNoteToLoanDialog isOpen={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen} onSubmit={async n => { const h: LoanHistoryEntry = { id: `n-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', notes: n }; await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Note added."); setIsAddNoteDialogOpen(false); }} isSaving={isSaving} />
      <LogInfoRequestForLoanDialog isOpen={isLogInfoDialogOpen} onOpenChange={setIsLogInfoDialogOpen} onSubmit={async r => { const h: LoanHistoryEntry = { id: `ir-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', requiredFulfilment: r, isFulfilled: false }; await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Request logged."); setIsLogInfoDialogOpen(false); }} isSaving={isSaving} />
      <UploadLoanDocumentDialog isOpen={isUploadDocDialogOpen} onOpenChange={setIsUploadDocDialogOpen} loanId={loan.id} documentRequirement={currentDocumentRequirementToUpload} onSubmitAfterUpload={async (r, p, f) => { const nd: LoanDocument = { id: `doc-${Date.now()}`, name: r.name, requirementId: r.id, status: AppLoanDocumentStatus.SUBMITTED, filePath: p, uploadedAt: formatISO(new Date()) }; await handleLocalAndUpdateService({ documents: [...loan.documents, nd] }, "Uploaded."); setIsUploadDocDialogOpen(false); }} isParentSaving={isSaving} />
      <RespondToInfoRequestDialog isOpen={isRespondToInfoDialogOpen} onOpenChange={setIsRespondToInfoDialogOpen} entry={selectedEntryForResponse} onSubmit={async (id, res, fulfilled) => { await handleLocalAndUpdateService({ respondToInfoRequest: { entryId: id, response: res, markFulfilled: fulfilled } }, "Response saved."); setIsRespondToInfoDialogOpen(false); }} isSaving={isSaving} />
    </div>
  );
}
