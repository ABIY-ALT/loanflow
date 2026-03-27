
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
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { Loader2, AlertCircle, MessageSquareWarning, Flame, ArrowLeft, History, Info as InfoIcon, FileText, ClipboardList, Clock, Building, User, LayoutDashboard, SearchCheck } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


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
  
  // Logical access levels
  const isAdmin = useMemo(() => userPermissions.has(PERMISSIONS.MANAGE_USERS), [userPermissions]);
  const isAssigned = useMemo(() => loan?.assignedToUsers.some(u => u.id === currentUser?.id), [loan, currentUser]);
  const isInActiveDept = useMemo(() => currentUser?.department === loan?.assignedDepartment, [currentUser, loan]);
  
  // Managers are identified by having Promote or Assign permissions within their own department
  const isManagerInDept = useMemo(() => 
    isInActiveDept && (userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE) || userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)), 
    [isInActiveDept, userPermissions]
  );

  /**
   * Access Gating: Determine if user can see sensitive financials and docs.
   * Only specifically assigned staff, department managers, or admins see full details.
   */
  const canViewFullDetails = useMemo(() => {
    if (!currentUser || !loan) return false;
    if (isAdmin) return true;
    if (isAssigned) return true;
    if (isManagerInDept) return true;
    return false;
  }, [currentUser, loan, isAdmin, isAssigned, isManagerInDept]);
  
  // Action Locking: Can only act if the case is in the user's active department and not terminated
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
  
  // Determines if the "Primary Action" (Complete/Promote) is enabled for this specific user
  const canCurrentUserAct = useMemo(() => {
    if (!currentUser || !currentStageDef || !isActionableInUserDepartment || !loan) return false;

    // Administrators can always act
    if (isAdmin) return true;

    // Officers must be assigned to act. Managers can act regardless of assignment if in correct dept.
    if (isAssigned || isManagerInDept) {
        const allowedRoles = currentStageDef.allowedRoles || [];
        if (allowedRoles.length === 0) return true; 
        return currentUser.customRoleName && allowedRoles.includes(currentUser.customRoleName);
    }

    return false;
  }, [currentUser, currentStageDef, isActionableInUserDepartment, loan, isAdmin, isAssigned, isManagerInDept]);

  const fetchLoanData = useCallback(async () => {
    if (!loanId) {
        setIsLoading(false);
        return;
    };
    setIsLoading(true);
    setError(null);
    try {
      const [loanResult, wfResult] = await Promise.all([
        getLoanRequestById(loanId),
        getWorkflowDefinitions()
      ]);

      if (loanResult.error) {
        setError(loanResult.error);
        setLoan(null);
      } else if (loanResult.loan) {
        setLoan(loanResult.loan);
        setUsers(loanResult.users || []);
      }

      if (wfResult.error) {
         console.error(wfResult.error);
      } else if (wfResult.workflows) {
        setWorkflowDefinitions(wfResult.workflows);
      }

    } catch (err: any) {
      setError("An unexpected error occurred while fetching page data.");
    } finally {
      setIsLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    if (!authLoading) {
        fetchLoanData();
    }
  }, [fetchLoanData, authLoading]);
  
  const handleLocalAndUpdateService = useCallback(async (
    updatedFields: Partial<Omit<LoanRequest, 'id'>> & { respondToInfoRequest?: { entryId: string, response: string, markFulfilled: boolean } },
    successMessage: string,
  ): Promise<{success: boolean; finalLoanState?: LoanRequest}> => {
    if (!loan) return {success: false};
    setIsSaving(true);

    const { respondToInfoRequest, ...restUpdatedFields } = updatedFields;
    const optimisticLoanState: LoanRequest = {
        ...JSON.parse(JSON.stringify(loan)),
        ...restUpdatedFields,
        lastUpdatedDate: formatISO(new Date()),
    };
    
    if (respondToInfoRequest) {
        optimisticLoanState.history = optimisticLoanState.history.map(h => 
            h.id === respondToInfoRequest.entryId 
                ? { ...h, fulfillmentNotes: respondToInfoRequest.response, isFulfilled: respondToInfoRequest.markFulfilled } 
                : h
        );
    }
    
    setLoan(optimisticLoanState); 

    try {
      const servicePayload = { ...updatedFields, lastUpdatedDate: formatISO(new Date()) };
      const serviceResult = await updateLoanRequest(loan.id, servicePayload); 
      
      if (serviceResult.error || !serviceResult.success) {
        toast({ title: "Update Error", description: serviceResult.error || "Failed to update loan.", variant: "destructive" });
        await fetchLoanData();
        return {success: false};
      }
      
      toast({ title: "Update Successful", description: successMessage });
      if(serviceResult.updatedLoan) {
        setLoan(serviceResult.updatedLoan);
        return {success: true, finalLoanState: serviceResult.updatedLoan};
      } else {
        await fetchLoanData();
        return {success: true};
      }
    } catch (err: any) {
      toast({ title: "System Error", variant: "destructive" });
      await fetchLoanData();
      return {success: false};
    } finally {
      setIsSaving(false);
    }
  }, [loan, toast, fetchLoanData]);


  const onAssignStaffSubmit = async (data: { assignedTo?: string[] }) => {
    if (!loan) return;
    const newAssignedUserIds = new Set(data.assignedTo || []);
    const currentAssignedUserIds = new Set(loan.assignedToUsers.map(u => u.id));

    let historyUpdate: LoanHistoryEntry[] = [...loan.history];
    const assignmentChanged = newAssignedUserIds.size !== currentAssignedUserIds.size ||
      !Array.from(newAssignedUserIds).every(id => currentAssignedUserIds.has(id));

    if (assignmentChanged) {
        const assignedUsers = users.filter(u => newAssignedUserIds.has(u.id));
        const assignedNames = assignedUsers.length > 0 ? assignedUsers.map(u => u.fullName).join(', ') : 'Unassigned';
        historyUpdate.push({
            id: `hist-assign-${Date.now()}`,
            stageName: currentStageDef?.name || loan.currentStageName || 'Current Stage',
            timestamp: formatISO(new Date()),
            userId: currentUser?.id || 'system-prisma',
            userName: currentUser?.fullName || 'System',
            notes: `Case assignment changed. Now assigned to: ${assignedNames}.`
        });
    }
    
    const {success} = await handleLocalAndUpdateService({
        assignedToUsers: Array.from(newAssignedUserIds).map(id => users.find(u => u.id === id)).filter(Boolean) as UserType[],
        stageCompletedBy: [],
        isReadyForManagerReview: false,
        history: historyUpdate
    }, "Staff assignment updated.");
    if (success) setIsEditLoanDialogOpen(false);
  };

  const validateCurrentStageRequirements = useCallback((loanForValidation?: LoanRequest | null): boolean => {
    const loanToUse = loanForValidation || loan;
    if (!loanToUse || !currentStageDef) return false;

    const activeInfoReq = loanToUse.history.find(entry => entry.requiredFulfilment && !entry.isFulfilled);
    if (activeInfoReq) {
        toast({ title: 'Action Pending', description: `Outstanding action: '${activeInfoReq.requiredFulfilment}' must be resolved.`, variant: 'destructive' });
        return false;
    }

    if (currentStageDef.documentRequirements.length > 0) {
        const pendingDocs = currentStageDef.documentRequirements.filter(req => {
            if (!req.isMandatory) return false;
            const uploadedDoc = loanToUse.documents.find(d => d.requirementId === req.id);
            return !uploadedDoc || uploadedDoc.status !== LoanDocumentStatus.VERIFIED;
        });

        if (pendingDocs.length > 0) {
            toast({ title: 'Documents Pending', description: `Mandatory docs for stage '${currentStageDef.name}' are missing or unverified.`, variant: 'destructive' });
            return false;
        }
    }
    return true;
  }, [loan, currentStageDef, toast]);

  const handleMarkStageComplete = async () => {
    if (!loan || !currentStageDef || !currentUser) return;
    if (!validateCurrentStageRequirements()) return;

    const isApprovalRequired = currentStageDef.requiresApproval;
    const assignedUserIds = new Set(loan.assignedToUsers.map(u => u.id));
    const completedUserIds = new Set(loan.stageCompletedBy?.map(u => u.id) || []);
    if (!completedUserIds.has(currentUser.id)) completedUserIds.add(currentUser.id);
    
    const allAssignedHaveCompleted = assignedUserIds.size === 0 || Array.from(assignedUserIds).every(id => completedUserIds.has(id));

    // Role-based logic: If the user has Promotion permissions and the stage doesn't require manager review, advance immediately.
    const canUserPromoteDirectly = !isApprovalRequired && userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE);

    if (canUserPromoteDirectly && allAssignedHaveCompleted) {
        await handleManagerPromoteLoan(true); 
    } else {
        const updatedStageCompletedBy = users.filter(u => completedUserIds.has(u.id));
        const newHistoryEntry: LoanHistoryEntry = {
          id: `hist-officercomplete-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
          userId: currentUser.id, userName: currentUser.fullName,
          notes: allAssignedHaveCompleted ? `Stage '${currentStageDef.name}' submitted for manager review.` : `Partial stage completion logged.`,
        };

        await handleLocalAndUpdateService({
            isReadyForManagerReview: allAssignedHaveCompleted,
            stageCompletedBy: updatedStageCompletedBy,
            history: [...loan.history, newHistoryEntry] 
        }, allAssignedHaveCompleted ? "Submitted for manager review." : "Part completion recorded.");
    }
  };

  const handleManagerPromoteLoan = async (isDirectFromOfficer: boolean = false) => {
    if (!currentUser || !loan || !currentWorkflowVersion || !currentStageDef || !currentWorkflowDef) return;
    if (!validateCurrentStageRequirements()) return;

    const currentStageIndex = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
    if (currentStageIndex === -1) return;

    const roleActionText = isDirectFromOfficer ? `Completed & Promoted by ${currentUser.customRoleName}` : `Approved & Promoted by Manager`;

    if (currentStageIndex === currentWorkflowVersion.stages.length - 1) {
        const loanWorkflows = workflowDefinitions
            .filter(def => def.parentSectorId === currentWorkflowDef.parentSectorId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentWorkflowIndexInPath = loanWorkflows.findIndex(def => def.id === currentWorkflowDef.id);
        if (currentWorkflowIndexInPath === -1 || currentWorkflowIndexInPath === loanWorkflows.length - 1) {
            toast({ title: "End of Path", description: "Loan has reached the final stage of the workflow path." });
            return;
        }

        const nextWorkflowDef = loanWorkflows[currentWorkflowIndexInPath + 1];
        const nextActiveVersion = nextWorkflowDef.versions.find(v => v.isActive);
        if (!nextActiveVersion || nextActiveVersion.stages.length === 0) return;

        const firstStageOfNextWorkflow = nextActiveVersion.stages[0];
        const newHistoryEntry: LoanHistoryEntry = {
            id: `hist-wf-promote-${Date.now()}`, stageName: firstStageOfNextWorkflow.name, timestamp: formatISO(new Date()),
            userId: currentUser.id, userName: currentUser.fullName,
            notes: `${roleActionText}. Workflow '${currentWorkflowDef.name}' complete. Moved to '${nextWorkflowDef.name}'.`,
        };

        await handleLocalAndUpdateService({
            workflowVersionId: nextActiveVersion.id,
            currentStageId: firstStageOfNextWorkflow.id,
            assignedDepartmentId: nextWorkflowDef.departmentId, 
            assignedToUsers: [], stageCompletedBy: [], isReadyForManagerReview: false,
            history: [...loan.history, newHistoryEntry],
            stageDeadline: formatISO(addDays(new Date(), firstStageOfNextWorkflow.defaultTimelineDays)),
        }, `Loan moved to ${nextWorkflowDef.name}.`);

    } else {
        const nextStageDef = currentWorkflowVersion.stages[currentStageIndex + 1];
        const newHistoryEntry: LoanHistoryEntry = {
          id: `hist-stage-promote-${Date.now()}`, stageName: nextStageDef.name, timestamp: formatISO(new Date()),
          userId: currentUser.id, userName: currentUser.fullName,
          notes: `${roleActionText}. Moved to stage '${nextStageDef.name}'.`
        };
        
        await handleLocalAndUpdateService({
          currentStageId: nextStageDef.id,
          assignedDepartmentId: users.find(u => u.department === nextStageDef.responsibleDepartment)?.departmentId,
          assignedToUsers: [], stageCompletedBy: [], history: [...loan.history, newHistoryEntry],
          isReadyForManagerReview: false,
          stageDeadline: formatISO(addDays(new Date(), nextStageDef.defaultTimelineDays)),
        }, `Loan promoted to ${nextStageDef.name}.`);
    }
  };

  const onReturnForReworkSubmit = async (reworkNote: string, reworkAssigneeIds: string[]) => {
    if (!currentUser || !loan || !currentStageDef) return;
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-rework-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: currentUser.id, userName: currentUser.fullName,
      notes: `Returned for rework by manager. Reason: ${reworkNote}`
    };
    const {success} = await handleLocalAndUpdateService({
      isReadyForManagerReview: false,
      stageCompletedBy: [], 
      assignedToUsers: users.filter(u => reworkAssigneeIds.includes(u.id)),
      history: [...loan.history, newHistoryEntry],
    }, "Loan returned for rework.");
    if (success) setIsReturnForReworkDialogOpen(false);
  };

  const onTerminateLoanSubmit = async (reason: string) => {
    if (!currentUser || !loan) return;
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-terminate-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()),
      userId: currentUser.id, userName: currentUser.fullName,
      notes: `Process terminated. Reason: ${reason}`,
    };
    const {success} = await handleLocalAndUpdateService({
      isTerminalStage: true, currentStageStatus: "Terminated", history: [...loan.history, newHistoryEntry],
    }, "Process terminated.");
    if (success) setIsTerminateLoanDialogOpen(false);
  };

  const onManualTransitionSubmit = async (verId: string, stageId: string, reason: string) => {
    const allVersions = workflowDefinitions.flatMap(def => def.versions);
    const newStage = allVersions.find(v => v.id === verId)?.stages.find(s => s.id === stageId);
    if (!newStage) return;

    const newHistoryEntry: LoanHistoryEntry = {
        id: `hist-manual-${Date.now()}`, stageName: newStage.name, timestamp: formatISO(new Date()),
        userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'Sys',
        notes: `MANUAL TRANSITION to '${newStage.name}'. Reason: ${reason}`,
    };

    const {success} = await handleLocalAndUpdateService({
        workflowVersionId: verId, currentStageId: stageId,
        assignedDepartmentId: users.find(u => u.department === newStage.responsibleDepartment)?.departmentId,
        assignedToUsers: [], stageCompletedBy: [], isReadyForManagerReview: false,
        history: [...loan.history, newHistoryEntry],
        stageDeadline: formatISO(addDays(new Date(), newStage.defaultTimelineDays)),
    }, `Manual transition complete.`);
    if (success) setIsManualTransitionDialogOpen(false);
  };


  const handleDocumentUploaded = async (requirement: DocumentRequirement, path: string, fileName: string) => {
    if (!loan) return;
    const existingIndex = loan.documents.findIndex(d => d.requirementId === requirement.id);
    const newDoc: LoanDocument = {
        id: existingIndex > -1 ? loan.documents[existingIndex].id : `doc-${Date.now()}`,
        name: requirement.name, requirementId: requirement.id, status: AppLoanDocumentStatus.SUBMITTED,
        notes: `File uploaded: ${fileName}.`, uploadedAt: formatISO(new Date()), filePath: path,
    };
    const updatedDocs = existingIndex > -1 ? loan.documents.map((d, i) => i === existingIndex ? newDoc : d) : [...loan.documents, newDoc];
    const {success} = await handleLocalAndUpdateService({ documents: updatedDocs }, "Document uploaded.");
    if (success) setIsUploadDocDialogOpen(false);
  };
  
  const handleVerifyDocument = async (docId: string) => {
    const updatedDocs = loan?.documents.map(d => d.id === docId ? { ...d, status: AppLoanDocumentStatus.VERIFIED } : d);
    if (updatedDocs) await handleLocalAndUpdateService({ documents: updatedDocs }, "Document verified.");
  };

  const handleCheckboxRequirementChange = async (requirement: DocumentRequirement, checked: boolean) => {
    if (!loan || !currentUser) return;
    let updatedDocs = [...loan.documents];
    const existingIdx = updatedDocs.findIndex(d => d.requirementId === requirement.id);
    if (checked) {
      if (existingIdx === -1) updatedDocs.push({ id: `chk-${Date.now()}`, requirementId: requirement.id, name: requirement.name, status: AppLoanDocumentStatus.VERIFIED, uploadedAt: new Date().toISOString() });
    } else if (existingIdx > -1) updatedDocs.splice(existingIdx, 1);
    await handleLocalAndUpdateService({ documents: updatedDocs }, "Requirement updated.");
  };

  const handleStatusChange = async (status: string) => {
    const historyEntry: LoanHistoryEntry = {
        id: `stat-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()),
        userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'Sys',
        notes: `Status changed to "${status}".`,
    };
    await handleLocalAndUpdateService({ currentStageStatus: status, history: [...(loan?.history || []), historyEntry] }, `Status updated.`);
  };

  if (authLoading || isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  if (error) return <div className="p-8 text-center"><AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" /><h1 className="text-xl font-bold">{error}</h1><Button className="mt-4" onClick={() => router.back()}>Go Back</Button></div>;
  if (!loan) return <div className="p-8 text-center"><AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h1 className="text-xl font-bold">Loan Not Found</h1><Button className="mt-4" onClick={() => router.push('/')}>Dashboard</Button></div>;

  // --- RENDER RESTRICTED TRACKING VIEW ---
  // Users like Secretaries or general submitters see this read-only tracking view
  if (!canViewFullDetails) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1.5 py-1 px-3">
              <SearchCheck className="h-3.5 w-3.5" />
              Tracking Mode
            </Badge>
          </div>
        </div>

        <Card className="shadow-lg border-primary/10 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl font-bold text-primary flex items-center gap-3">
                  <LayoutDashboard className="h-6 w-6" />
                  Loan Status Tracker
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  Real-time status for <span className="font-semibold text-foreground">{loan.customerName}</span> (ID: {loan.loanNumber})
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                  <Badge className="px-3 py-1.5 font-bold uppercase tracking-wider">{currentStageDef?.name || loan.currentStageName || 'Processing'}</Badge>
                  {loan.currentStageStatus && <Badge variant="secondary" className="font-medium">{loan.currentStageStatus}</Badge>}
                  {loan.isTerminalStage && <Badge variant="destructive">Terminated</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 py-8 border-b bg-background">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Workflow Tracking
              </h3>
              <LoanProgressDisplay loan={loan} progressPercentage={0} currentStageName={currentStageDef?.name || 'Current Stage'}/>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Department</p>
                  <p className="font-bold text-lg flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    {loan.assignedDepartment || 'Pending Assignment'}
                  </p>
                </div>
                <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Assigned Staff</p>
                  <div className="flex flex-wrap gap-2">
                    {loan.assignedToUsers.length > 0 ? (
                      loan.assignedToUsers.map(u => (
                        <Badge key={u.id} variant="secondary" className="flex items-center gap-1.5 font-bold">
                          <User className="h-3 w-3" /> {u.fullName}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm italic text-muted-foreground">Awaiting staff delegation</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <Tabs defaultValue="history" className="w-full">
                <TabsList className="bg-muted/50 p-1">
                  <TabsTrigger value="history" className="gap-2">
                    <ClipboardList className="h-4 w-4"/> Chronological History
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="history" className="pt-6">
                  <LoanAuditTrail loan={loan} />
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 p-4 border-t flex justify-center italic text-xs text-muted-foreground font-medium">
            Sensitive financials, purpose, and documents are restricted to assigned personnel and managers.
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- RENDER FULL ACCESS VIEW ---
  const isActionable = !loan.isTerminalStage;
  const availableStatuses = (currentStageDef?.availableStatuses && loan.assignedDepartment && currentStageDef.availableStatuses[loan.assignedDepartment]) || [];

  return (
    <div className="space-y-6">
      <LoanDetailHeader
        loan={loan}
        currentStageName={currentStageDef?.name || loan.currentStageName || 'N/A'}
        onBack={() => router.back()}
        onOpenEditDialog={() => setIsEditLoanDialogOpen(true)}
        onOpenAddNoteDialog={() => setIsAddNoteDialogOpen(true)}
        onOpenLogInfoDialog={() => setIsLogInfoDialogOpen(true)}
        onMarkStageComplete={handleMarkStageComplete}
        onManagerPromoteLoan={() => handleManagerPromoteLoan(false)}
        onOpenReturnForReworkDialog={() => setIsReturnForReworkDialogOpen(true)}
        onOpenTerminateLoanDialog={() => setIsTerminateLoanDialogOpen(true)}
        onOpenManualTransitionDialog={() => setIsManualTransitionDialogOpen(true)}
        isSaving={isSaving}
        isActionableStage={isActionable && canCurrentUserAct}
        canPromote={userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE)}
        requiresApproval={currentStageDef?.requiresApproval ?? true}
      />

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle>
              <CardDescription>ID: {loan.loanNumber}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
                <Badge className="px-3 py-1.5 font-medium">{currentStageDef?.name || 'Stage'}</Badge>
                {availableStatuses.length > 0 && isActionable && canCurrentUserAct ? (
                  <Select value={loan.currentStageStatus || ''} onValueChange={handleStatusChange} disabled={isSaving}>
                    <SelectTrigger className="h-8 text-sm w-40"><SelectValue placeholder="Set Status" /></SelectTrigger>
                    <SelectContent>{availableStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  loan.currentStageStatus && <Badge variant="secondary">{loan.currentStageStatus}</Badge>
                )}
                {loan.isUrgent && <Badge variant="destructive" className="animate-pulse">URGENT</Badge>}
                {loan.isReadyForManagerReview && isActionable && <Badge variant="outline" className="border-orange-500 bg-orange-50 text-orange-700">Awaiting Manager Review</Badge>}
                {loan.isTerminalStage && <Badge variant="destructive">Terminated</Badge>}
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
            <TabsContent value="documents" className="p-6">
                <LoanDocumentsManager loan={loan} currentStageDef={currentStageDef} isSavingGlobal={isSaving} onCheckboxChange={handleCheckboxRequirementChange} onVerifyDocument={handleVerifyDocument} onOpenUploadDialog={req => { setCurrentDocumentRequirementToUpload(req); setIsUploadDocDialogOpen(true); }}/>
            </TabsContent>
            <TabsContent value="history" className="p-6">
                <LoanAuditTrail loan={loan} isSavingGlobal={isSaving} onRespondToRequest={e => { setSelectedEntryForResponse(e); setIsRespondToInfoDialogOpen(true); }}/>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <EditLoanDetailsDialog isOpen={isEditLoanDialogOpen} onOpenChange={setIsEditLoanDialogOpen} loan={loan} users={users.filter(u => u.department === (loan.assignedDepartment || currentStageDef?.responsibleDepartment))} currentDepartment={loan.assignedDepartment} onSubmit={onAssignStaffSubmit} isSaving={isSaving} />
      <AddNoteToLoanDialog isOpen={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen} onSubmit={async note => { const h: LoanHistoryEntry = { id: `n-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', notes: note }; await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Note added."); setIsAddNoteDialogOpen(false); }} isSaving={isSaving} />
      <LogInfoRequestForLoanDialog isOpen={isLogInfoDialogOpen} onOpenChange={setIsLogInfoDialogOpen} onSubmit={async req => { const h: LoanHistoryEntry = { id: `ir-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', requiredFulfilment: req, isFulfilled: false }; await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Request logged."); setIsLogInfoDialogOpen(false); }} isSaving={isSaving} />
      <UploadLoanDocumentDialog isOpen={isUploadDocDialogOpen} onOpenChange={setIsUploadDocDialogOpen} loanId={loan.id} documentRequirement={currentDocumentRequirementToUpload} onSubmitAfterUpload={handleDocumentUploaded} isParentSaving={isSaving} />
      <ReturnLoanForReworkDialog isOpen={isReturnForReworkDialogOpen} onOpenChange={setIsReturnForReworkDialogOpen} loan={loan} users={users.filter(u => u.department === loan.assignedDepartment)} currentDepartment={loan.assignedDepartment} onSubmit={onReturnForReworkSubmit} isSaving={isSaving} />
      <TerminateLoanDialog isOpen={isTerminateLoanDialogOpen} onOpenChange={setIsTerminateLoanDialogOpen} loan={loan} onSubmit={onTerminateLoanSubmit} isSaving={isSaving} />
      <ManualTransitionDialog isOpen={isManualTransitionDialogOpen} onOpenChange={setIsManualTransitionDialogOpen} currentLoan={loan} workflowDefinitions={workflowDefinitions} onSubmit={onManualTransitionSubmit} isSaving={isSaving} />
      {selectedEntryForResponse && <RespondToInfoRequestDialog isOpen={isRespondToInfoDialogOpen} onOpenChange={setIsRespondToInfoDialogOpen} entry={selectedEntryForResponse} onSubmit={async (id, res, fulfilled) => { await handleLocalAndUpdateService({ respondToInfoRequest: { entryId: id, response: res, markFulfilled: fulfilled } }, "Response saved."); setIsRespondToInfoDialogOpen(false); }} isSaving={isSaving} />}
    </div>
  );
}
