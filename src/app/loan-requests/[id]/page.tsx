
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import type { LoanRequest, LoanDocument, LoanHistoryEntry, User as UserType, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, DocumentRequirement } from '@/types/loan';
import { LoanDocumentStatus, DocumentRequirementType, LoanDocumentStatus as AppLoanDocumentStatus } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { canAnalystSubmitToFinalManager, canDistributeToDistrictApproval } from '@/lib/district-workflow';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLoanRequestById, updateLoanRequest, getWorkflowDefinitions, recordCaseReview, approveDistrictAnalyst, returnToDistrictAnalyst, returnToOriginatingCRM, distributeToCommittee, skipPVRAndValuation } from '@/services/loan-service-prisma';
import { Loader2, AlertCircle, LayoutDashboard, Clock, Building, User, ClipboardList, Info as InfoIcon, FileText, SearchCheck, ArrowLeft, StickyNote, ArrowRight, SkipForward, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';

import { LoanDetailHeader } from '@/components/loan/detail/LoanDetailHeader';
import { LoanProgressDisplay } from '@/components/loan/detail/LoanProgressDisplay';
import { LoanInfoDisplay } from '@/components/loan/detail/LoanInfoDisplay';
import { LoanDocumentsManager } from '@/components/loan/detail/LoanDocumentsManager';
import { LoanAuditTrail } from '@/components/loan/detail/LoanAuditTrail';
import { LoanAnalysisWork } from '@/components/loan/detail/LoanAnalysisWork';
import { ValuationRequisitionForm } from '@/components/loan/forms/ValuationRequisitionForm';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

import { EditLoanDetailsDialog } from '@/components/loan/dialogs/EditLoanDetailsDialog';
import { AddNoteToLoanDialog } from '@/components/loan/dialogs/AddNoteToLoanDialog';
import { LogInfoRequestForLoanDialog } from '@/components/loan/dialogs/LogInfoRequestForLoanDialog';
import { ReturnLoanForReworkDialog } from '@/components/loan/dialogs/ReturnLoanForReworkDialog';
import { UploadLoanDocumentDialog } from '@/components/loan/dialogs/UploadLoanDocumentDialog';
import { TerminateLoanDialog } from '@/components/loan/dialogs/TerminateLoanDialog';
import { ManualTransitionDialog } from '@/components/loan/dialogs/ManualTransitionDialog';
import { RespondToInfoRequestDialog } from '@/components/loan/dialogs/RespondToInfoRequestDialog';
import { AnalystRemarkDialog } from '@/components/loan/dialogs/AnalystRemarkDialog';
import { DistributeToCommitteeDialog } from '@/components/loan/dialogs/DistributeToCommitteeDialog';

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
  const [isSkippingPvr, setIsSkippingPvr] = useState(false);
  const [isSkipPvrDialogOpen, setIsSkipPvrDialogOpen] = useState(false);
  const [skipPvrReason, setSkipPvrReason] = useState('');
  const [isRespondToInfoDialogOpen, setIsRespondToInfoDialogOpen] = useState(false);
  const [isAnalystRemarkDialogOpen, setIsAnalystRemarkDialogOpen] = useState(false);
  const [isDistributeDialogOpen, setIsDistributeDialogOpen] = useState(false);
  const [selectedEntryForResponse, setSelectedEntryForResponse] = useState<LoanHistoryEntry | null>(null);
  
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);
  
  const isAdmin = useMemo(() => userPermissions.has(PERMISSIONS.MANAGE_USERS), [userPermissions]);
  const isAssigned = useMemo(() => loan?.assignedToUsers.some(u => u.id === currentUser?.id), [loan, currentUser]);
  const isCreator = useMemo(() => loan?.createdById === currentUser?.id, [loan, currentUser]);
  const hasHistoryInvolvement = useMemo(() => {
    if (!loan || !currentUser) return false;
    return (loan.history || []).some(h => h.userId === currentUser.id);
  }, [loan, currentUser]);
  const isInActiveDept = useMemo(() => {
    const userDept = currentUser?.department?.trim().toLowerCase();
    const loanDept = loan?.assignedDepartment?.trim().toLowerCase();
    return !!userDept && !!loanDept && userDept === loanDept;
  }, [currentUser, loan]);

  const isManagerInDept = useMemo(
    () =>
      isInActiveDept &&
      (userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE) || userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)),
    [isInActiveDept, userPermissions]
  );
  const hasDirectApprovePermission = useMemo(
    () => userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE),
    [userPermissions]
  );

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

  // At the "Submit Loan Decision Letter to Customer" stage, surface the
  // appraisal officer's final-stage output ("Submit to Appraisal Officer") as a
  // read-only reference. The same loan carries those documents in loan.documents,
  // so we locate the matching appraisal stage definition to label/render them.
  const appraisalReferenceStage = useMemo(() => {
    if (!loan || currentStageDef?.name !== 'Submit Loan Decision Letter to Customer') return null;
    const appraisalStages = workflowDefinitions
      .flatMap(def => def.versions)
      .flatMap(v => v.stages)
      .filter(s => s.name === 'Submit to Appraisal Officer');
    if (appraisalStages.length === 0) return null;
    const docReqIds = new Set(loan.documents.map(d => d.requirementId).filter(Boolean));
    // Prefer the appraisal stage this loan actually acted on (its requirement
    // ids appear in loan.documents); otherwise fall back to any definition.
    return (
      appraisalStages.find(s => s.documentRequirements.some(r => docReqIds.has(r.id))) ||
      appraisalStages[0]
    );
  }, [loan, currentStageDef, workflowDefinitions]);

  const getWorkflowCode = useCallback((name?: string | null) => {
    if (!name) return null;
    const match = name.match(/WF-(\d{1,2})/i);
    return match ? Number(match[1]) : null;
  }, []);

  const isWf05Appraisal = useMemo(
    () => getWorkflowCode(currentWorkflowDef?.name) === 5,
    [currentWorkflowDef, getWorkflowCode]
  );
  // WF-05 stages 0-3 are supervisory routing stages (Chief → Director → Division Manager):
  // assigning the next owner moves the case forward without a separate promote step.
  const isWf05RoutingStage = isWf05Appraisal && [0, 1, 2, 3].includes(currentStageDef?.order ?? -1);
  // WF-05 stages 7-9 are committee handoff stages: any permitted assigned user advances
  // them with a single click instead of the mark-complete + manager-approval round trip.
  const isWf05CommitteeStage = isWf05Appraisal && [7, 8, 9].includes(currentStageDef?.order ?? -1);
  // WF-05 stages 4 and 5 are officer stages: they should advance immediately upon completion
  // without needing an extra manager approval round trip.
  const isWf05OfficerStage = isWf05Appraisal && [4, 5].includes(currentStageDef?.order ?? -1);
  // At stage 1 the Director chooses which division manager stage the case goes to.
  const wf05DivisionOptions = useMemo(() => {
    if (!isWf05Appraisal || currentStageDef?.order !== 1 || !currentWorkflowVersion) return undefined;
    return currentWorkflowVersion.stages
      .filter(s => s.order === 2 || s.order === 3)
      .sort((a, b) => a.order - b.order)
      .map(s => ({ order: s.order, label: s.name }));
  }, [isWf05Appraisal, currentStageDef, currentWorkflowVersion]);

  const canCurrentUserAct = useMemo(() => {
    if (!currentUser || !currentStageDef || !loan) return false;
    
    // Admin bypass: can act on any non-terminal loan regardless of department or role
    if (isAdmin && !loan.isTerminalStage) return true;

    if (!isActionableInUserDepartment) return false;

    const allowedRoles = currentStageDef.allowedRoles || [];
    const normalizedUserRole = currentUser.customRoleName?.toLowerCase().trim() || '';
    const hasAllowedRole =
      allowedRoles.length === 0 ||
      allowedRoles.some((allowedRole) => {
        const normalizedAllowed = allowedRole.toLowerCase().trim();
        if (normalizedAllowed === normalizedUserRole) return true;
        if (normalizedAllowed.includes(normalizedUserRole) || normalizedUserRole.includes(normalizedAllowed)) return true;
        if (
          (normalizedAllowed.includes('appraisal') || normalizedAllowed.includes('credit')) &&
          normalizedUserRole.includes('analyst')
        ) {
          return true;
        }
        if (
          normalizedAllowed.includes('analyst') &&
          (normalizedUserRole.includes('appraisal') || normalizedUserRole.includes('officer'))
        ) {
          return true;
        }
        if (
          normalizedAllowed.includes('committee') &&
          normalizedUserRole.includes('committee')
        ) {
          return true;
        }
        return false;
      });

    const isReturnedAnalystStage =
      loan.currentStageOrder === 6 &&
      (loan.currentStageStatus === 'RETURNED_FOR_COMMENT' || loan.currentStageStatus === 'RETURNED_FOR_REWORK');

    if (
      userPermissions.has(PERMISSIONS.DISTRIBUTE_TO_DISTRICT_APPROVAL) &&
      canDistributeToDistrictApproval(loan)
    ) {
      return true;
    }

    const looksLikeAnalystRole =
      normalizedUserRole.includes('analyst') ||
      normalizedUserRole.includes('appraisal') ||
      normalizedUserRole.includes('credit');

    if (isReturnedAnalystStage && (hasAllowedRole || (isInActiveDept && looksLikeAnalystRole))) {
      return true;
    }

    if (isAssigned || isManagerInDept) {
      return hasAllowedRole;
    }

    return false;
  }, [currentUser, currentStageDef, isActionableInUserDepartment, loan, isAdmin, isAssigned, isManagerInDept, userPermissions]);

  const canViewFullDetails = useMemo(() => {
    if (!currentUser || !loan) return false;
    if (isAdmin) return true;
    if (isCreator) return true;
    if (isAssigned) return true;
    if (isManagerInDept) return true;
    return false;
  }, [currentUser, loan, isAdmin, isCreator, isAssigned, isManagerInDept]);

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
      .filter(([code, def]) => {
        const name = def.name || '';
        if ((code === 4 || code === 7 || code === 8) && /optional|appeal/i.test(name)) return false;
        return true;
      })
      .sort((a, b) => a[0] - b[0])
      .map(([, def]) => def);
  }, [workflowDefinitions, getWorkflowCode]);
  
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

  const handleSkipPvr = () => {
    if (!loan || !currentUser) return;
    if (!currentUser.permissions.includes(PERMISSIONS.SKIP_PVR_AND_VALUATION)) return;
    if (![2, 3].includes(loan.currentStageOrder || 0)) return;

    setSkipPvrReason('');
    setIsSkipPvrDialogOpen(true);
  };

  const handleConfirmSkipPvr = async () => {
    if (!loan) return;
    setIsSkipPvrDialogOpen(false);
    setIsSkippingPvr(true);
    try {
      const result = await skipPVRAndValuation(loan.id, skipPvrReason.trim() || undefined);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'PVR skipped successfully', description: 'The case has been moved directly to LAF & Summary Preparation.' });
        await fetchLoanData();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSkippingPvr(false);
    }
  };

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

    // WF-05 committee stages (7-9) advance in one click for any permitted assigned
    // user — no manager-approval round trip for the committee handoffs.
    if (canDirectPromote || isWf05CommitteeStage || isWf05OfficerStage) {
      let reassignedUsers: UserType[] | undefined = undefined;
      
      // If we are promoting from Stage 5 (Review Appraisal Analysis), reassign back to the assigning manager
      if (isWf05Appraisal && currentStageDef.order === 5 && loan.assignedById) {
        const assigningManager = users.find(u => u.id === loan.assignedById);
        if (assigningManager) {
          reassignedUsers = [assigningManager];
        }
      }
      
      await handleManagerPromoteLoan(true, reassignedUsers);
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

  const handleManagerPromoteLoan = async (isDirect: boolean = false, reassignedUsers?: UserType[], targetStage?: WorkflowStageDefinition) => {
    if (!currentUser || !loan || !currentWorkflowVersion || !currentStageDef || !currentWorkflowDef) return;
    const idx = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
    if (idx === -1) return;
    if (targetStage && targetStage.order <= currentStageDef.order) return;
    const actionText = targetStage
      ? `Assigned & Routed by ${currentUser.customRoleName}`
      : isDirect ? `Completed & Promoted by ${currentUser.customRoleName}` : `Approved & Promoted by Manager`;
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
        const nextStage = targetStage ?? currentWorkflowVersion.stages[idx + 1];
        const hist: LoanHistoryEntry = { id: `hist-stg-${Date.now()}`, stageName: nextStage.name, timestamp: formatISO(new Date()), userId: currentUser.id, userName: currentUser.fullName, notes: `${actionText}. Moved to stage '${nextStage.name}'.${reassignmentNote}` };
        await recordCaseReview({ loanRequestId: loan.id, action: 'APPROVED', comment: `${actionText}. Moved to stage '${nextStage.name}'.${reassignmentNote}` });
        const stageTransitionPayload: Partial<Omit<LoanRequest, 'id'>> = {
          currentStageId: nextStage.id,
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

  const handleDistributeToCommittee = async (distributionNotes: string) => {
    if (!loan) return;
    setIsSaving(true);
    try {
      const result = await distributeToCommittee(loan.id, distributionNotes);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case distributed to Committee successfully." });
        setIsDistributeDialogOpen(false);
        await fetchLoanData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualTransition = async (newWorkflowVersionId: string, newStageId: string, reason: string) => {
    if (!loan || !currentUser) return;
    setIsSaving(true);
    try {
      const h: LoanHistoryEntry = {
        id: `manual-${Date.now()}`,
        stageName: currentStageDef?.name || 'N/A',
        timestamp: formatISO(new Date()),
        userId: currentUser.id,
        userName: currentUser.fullName,
        notes: `Manual Transition: ${reason}`,
      };

      const result = await updateLoanRequest(loan.id, {
        workflowVersionId: newWorkflowVersionId,
        currentStageId: newStageId,
        history: [...loan.history, h],
        isReadyForManagerReview: false,
        stageCompletedBy: [],
        lastUpdatedDate: formatISO(new Date()),
      });

      if (result.error) {
        toast({ title: "Transition Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Transition Successful", description: "Loan moved to the new stage." });
        setIsManualTransitionDialogOpen(false);
        await fetchLoanData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTerminateLoan = async (reason: string) => {
    if (!loan || !currentUser) return;
    setIsSaving(true);
    try {
      const h: LoanHistoryEntry = {
        id: `term-${Date.now()}`,
        stageName: currentStageDef?.name || 'N/A',
        timestamp: formatISO(new Date()),
        userId: currentUser.id,
        userName: currentUser.fullName,
        notes: `Loan Terminated: ${reason}`,
      };

      const result = await updateLoanRequest(loan.id, {
        isTerminalStage: true,
        currentStageStatus: 'Terminated',
        history: [...loan.history, h],
        lastUpdatedDate: formatISO(new Date()),
      });

      if (result.error) {
        toast({ title: "Termination Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Loan Terminated", description: "The loan process has been permanently stopped." });
        setIsTerminateLoanDialogOpen(false);
        await fetchLoanData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReturnToCRM = async (note: string) => {
    if (!loan) return;
    setIsSaving(true);
    try {
      const result = await returnToOriginatingCRM(loan.id, note);
      
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case returned to Originating CRM successfully." });
        setIsReturnForReworkDialogOpen(false);
        await fetchLoanData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignLoan = async (assignedUserIds: string[], targetStageOrder?: number) => {
    const selectedUsers = users.filter(u => assignedUserIds.includes(u.id));

    // For District Workflow: If we are at the Manager Assignment stage,
    // assigning a staff member should also promote the case to the next stage (CRM PVR Preparation).
    const isDistrictAssignmentStage = loan?.submissionType === 'TYPE2' &&
                                     currentStageDef?.name.toLowerCase().includes('assignment');

    if (isDistrictAssignmentStage) {
      // Use the promote logic which also handles department transitions and stage movement
      await handleManagerPromoteLoan(false, selectedUsers);
      setIsEditLoanDialogOpen(false);
      return;
    }

    // WF-05 routing stages: assigning the next owner also moves the case forward.
    // The target stage follows the seniority of the chosen assignee so vacant
    // hierarchy levels are skipped: Director → stage 1, Division Manager →
    // stage 2/3 (per the division choice), Appraisal Officer → stage 4. This
    // lets a Deputy Chief or Director assign straight to an Officer when no
    // Director/Manager exists in the department.
    if (isWf05RoutingStage && selectedUsers.length > 0 && currentWorkflowVersion && currentStageDef) {
      const currentOrder = currentStageDef.order;
      const hasTier = (token: string) =>
        selectedUsers.some(u => (u.customRoleName || '').toLowerCase().includes(token));
      
      // Prioritize the lowest tier (highest stage order) among selected users
      // so the case advances properly down the hierarchy.
      const isOfficer = selectedUsers.some(u => {
        const role = (u.customRoleName || '').toLowerCase();
        return !role.includes('chief') && !role.includes('director') && !role.includes('manager');
      });

      const nextOrder =
        isOfficer ? 4
        : hasTier('manager') ? (targetStageOrder === 2 || targetStageOrder === 3 ? targetStageOrder : 2)
        : hasTier('director') ? 1
        : 0;

      if (nextOrder > currentOrder) {
        const targetStage = currentWorkflowVersion.stages.find(s => s.order === nextOrder);
        if (targetStage) {
          await handleManagerPromoteLoan(false, selectedUsers, targetStage);
          setIsEditLoanDialogOpen(false);
          return;
        }
      }
      // Same-tier (or more senior) assignee: keep the case at the current
      // routing stage and just swap the assignee below.
    }

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

  const handleSaveAnalysis = async (notes: string) => {
    if (!loan || !currentUser || !currentStageDef) return;
    
    if (isWf05Appraisal && currentStageDef.order === 5) {
      let reassignedUsers: UserType[] | undefined = undefined;
      if (loan.assignedById) {
        const assigningManager = users.find(u => u.id === loan.assignedById);
        if (assigningManager) {
          reassignedUsers = [assigningManager];
        }
      }
      
      const h: LoanHistoryEntry = { 
        id: `analyst-${Date.now()}`, 
        stageName: currentStageDef.name, 
        timestamp: formatISO(new Date()), 
        userId: currentUser.id, 
        userName: currentUser.fullName, 
        notes: `Analysis completed: ${notes}` 
      };
      
      loan.history.push(h); // Optimistically add so it's included in promote
      await handleManagerPromoteLoan(true, reassignedUsers);
      return;
    }

    const h: LoanHistoryEntry = { 
      id: `analyst-${Date.now()}`, 
      stageName: currentStageDef?.name || 'Analyst Review', 
      timestamp: formatISO(new Date()), 
      userId: currentUser.id, 
      userName: currentUser.fullName, 
      notes: `Analysis completed: ${notes}` 
    };

    await handleLocalAndUpdateService({ 
      currentStageStatus: "READY_FOR_COMMITTEE",
      history: [...loan.history, h] 
    }, "Analysis submitted to Committee.");
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
            <div className="px-6 py-8 border-b bg-background"><LoanProgressDisplay loan={loan} progressPercentage={loan.progressPercentage || 0} currentStageName={loan.currentStageName || 'N/A'}/></div>
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
  const showDistributeToApproval =
    userPermissions.has(PERMISSIONS.DISTRIBUTE_TO_DISTRICT_APPROVAL) &&
    canDistributeToDistrictApproval(loan);

  // While a case is being processed by the Property Valuation Department, all advancement
  // happens through the dedicated /valuation workspace (Maker/Checker routing). Hide the
  // generic stage-completion / promote controls here to keep a single source of truth.
  const isInValuationWorkspace =
    !loan.isTerminalStage &&
    !loan.isValuationCompleted &&
    (loan.assignedDepartment || '').toLowerCase().includes('valuation');

  // Surface the District Analyst's comment so reviewers see it without opening history.
  // Prefer the recommendation sent to the manager (lafData), else the latest saved remark.
  const analystComment = (() => {
    const rec = loan.lafData?.analystRecommendation;
    if (rec && String(rec).trim()) {
      return { text: String(rec).trim(), by: 'District Analyst' };
    }
    const fromHistory = [...(loan.history || [])]
      .reverse()
      .find((h) => h.notes?.startsWith('Analyst Remark:'));
    if (fromHistory?.notes) {
      return {
        text: fromHistory.notes.replace(/^Analyst Remark:\s*/, '').trim(),
        by: fromHistory.userName || 'District Analyst',
      };
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      {loan.submissionType === 'TYPE2' && Number(loan.loanAmount) > 20000000 && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-50 text-orange-900 shadow-sm">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <AlertTitle className="font-bold text-orange-800">District Processing Limit Reminder</AlertTitle>
          <AlertDescription className="text-orange-700 font-medium">
            The standard District Loan Process is for amounts up to 20 million ETB. 
            This case exceeds that limit and may require Head Office escalation if not specifically exempted.
          </AlertDescription>
        </Alert>
      )}
      <LoanDetailHeader 
        loan={loan} 
        currentStageName={currentStageDef?.name || 'N/A'} 
        onBack={() => router.back()} 
        onOpenEditDialog={() => setIsEditLoanDialogOpen(true)} 
        onOpenAddNoteDialog={() => setIsAddNoteDialogOpen(true)} 
        onOpenLogInfoDialog={() => setIsLogInfoDialogOpen(true)} 
        onMarkStageComplete={handleMarkStageComplete} 
        onManagerPromoteLoan={() => handleManagerPromoteLoan(false)} 
        onOpenApproveReassignDialog={() => setIsApproveReassignDialogOpen(true)} 
        onOpenReturnForReworkDialog={() => setIsReturnForReworkDialogOpen(true)} 
        onOpenTerminateLoanDialog={() => setIsTerminateLoanDialogOpen(true)} 
        onOpenManualTransitionDialog={() => setIsManualTransitionDialogOpen(true)} 
        onOpenDistributeDialog={
          (isAdmin || userPermissions.has(PERMISSIONS.DISTRIBUTE_TO_DISTRICT_APPROVAL))
            ? () => setIsDistributeDialogOpen(true)
            : undefined
        }
        onSkipPvr={handleSkipPvr}
        isSkippingPvr={isSkippingPvr}
        isSaving={isSaving} 
        isActionableStage={!!(!loan.isTerminalStage && canCurrentUserAct)}
        canPromote={userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE)}
        requiresApproval={(currentStageDef?.requiresApproval ?? true) && !isWf05CommitteeStage}
        assignMovesStage={isWf05RoutingStage}
      />
      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div><CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle><CardDescription>ID: {loan.loanNumber}</CardDescription></div>
            <div className="flex flex-col items-end gap-2 text-right">
                <div className="flex items-center gap-2">
                  {loan.submissionType === 'TYPE2' && loan.currentStageOrder === 6 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 h-8"
                      onClick={() => setIsAddNoteDialogOpen(true)}
                    >
                      <StickyNote className="mr-1.5 h-3.5 w-3.5" />
                      Add Remark
                    </Button>
                  )}
                  <Badge className="px-3 py-1.5 font-medium">{currentStageDef?.name || 'Stage'}</Badge>
                </div>
                {/* Skip PVR button: visible in main loan header for permitted users when at PVR/Valuation stages */}
                {currentUser?.permissions?.includes(PERMISSIONS.SKIP_PVR_AND_VALUATION) && loan.submissionType === 'TYPE2' && (
                  [2,3].includes(loan.currentStageOrder) || (currentStageDef?.name || '').toLowerCase().includes('pvr') || (currentStageDef?.name || '').toLowerCase().includes('valuation')
                ) && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-500 text-amber-700 hover:bg-amber-50"
                      onClick={handleSkipPvr}
                      disabled={isSaving || isSkippingPvr}
                    >
                      {isSkippingPvr ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <SkipForward className="mr-2 h-4 w-4" />}
                      Skip PVR
                    </Button>
                  </div>
                )}
                {availableStatuses.length > 0 && !loan.isTerminalStage && canCurrentUserAct ? (
                  <Select value={loan.currentStageStatus || ''} onValueChange={async s => { await handleLocalAndUpdateService({ currentStageStatus: s }, "Status updated."); }} disabled={isSaving}><SelectTrigger className="h-8 text-sm w-40"><SelectValue placeholder="Set Status" /></SelectTrigger><SelectContent>{availableStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                ) : ( loan.currentStageStatus && <Badge variant="secondary">{loan.currentStageStatus}</Badge> )}
                {loan.isUrgent && <Badge variant="destructive" className="animate-pulse">URGENT</Badge>}
                {loan.isReadyForManagerReview && !loan.isTerminalStage && <Badge variant="outline" className="border-orange-500 bg-orange-50 text-orange-700">Awaiting Manager Review</Badge>}
                {analystComment && (
                  <div className="flex items-start gap-1.5 max-w-xs text-left bg-indigo-50 border border-indigo-200 rounded-md px-2.5 py-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-600 mt-0.5 shrink-0" />
                    <p className="text-xs">
                      <span className="font-semibold text-indigo-800">{analystComment.by} commented:</span>{' '}
                      <span className="text-indigo-900 whitespace-pre-wrap break-words">{analystComment.text}</span>
                    </p>
                  </div>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-6 pt-6"><LoanProgressDisplay loan={loan} progressPercentage={loan.progressPercentage || 0} currentStageName={loan.currentStageName || 'N/A'}/></div>
          
          {/* Geographic Hardening: Hide distraction forms during CRM PVR Preparation */}
          {(() => {
            const isCrmPvrStage = loan.currentStageId === 'stage-district-crm-pvr' && loan.submissionType === 'TYPE2';
            
            return (
          <Tabs defaultValue={isCrmPvrStage ? "pvr" : "overview"} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-12">
              {!isCrmPvrStage && (
                <TabsTrigger value="overview" className="gap-2"><InfoIcon className="h-4 w-4"/> Info</TabsTrigger>
              )}
              {!isCrmPvrStage && (
                <div className="flex items-center">
                  <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4"/> Docs</TabsTrigger>
                  {loan.submissionType === 'TYPE2' && loan.currentStageOrder === 6 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 ml-1"
                      onClick={() => setIsAnalystRemarkDialogOpen(true)}
                      title="Add Analyst Remark"
                    >
                      <StickyNote className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              {isCrmPvrStage && (
                <TabsTrigger value="pvr" className="gap-2"><FileText className="h-4 w-4"/> PVR Form</TabsTrigger>
              )}
              {loan.currentStageStatus === 'UNDER_ANALYSIS' && (
                <TabsTrigger value="analysis" className="gap-2"><SearchCheck className="h-4 w-4"/> Analysis</TabsTrigger>
              )}
              <TabsTrigger value="history" className="gap-2"><ClipboardList className="h-4 w-4"/> Case History</TabsTrigger>
            </TabsList>
            
            {!isCrmPvrStage && (
              <TabsContent value="overview" className="p-6">
                <LoanInfoDisplay loan={loan} assignedUsers={loan.assignedToUsers} assignedDepartment={loan.assignedDepartment} />
              </TabsContent>
            )}
            
            {!isCrmPvrStage && (
              <TabsContent value="documents" className="p-6">
                <LoanDocumentsManager loan={loan} currentStageDef={currentStageDef} isSavingGlobal={isSaving} onVerifyDocument={async d => { await handleLocalAndUpdateService({ documents: loan.documents.map(x => x.id === d ? { ...x, status: AppLoanDocumentStatus.VERIFIED } : x) }, "Verified."); }} onCheckboxChange={canCurrentUserAct ? handleDocumentCheckboxChange : undefined} onOpenUploadDialog={r => { setCurrentDocumentRequirementToUpload(r); setIsUploadDocDialogOpen(true); }} referenceStage={appraisalReferenceStage} referenceTitle="Appraisal Committee Output"/>
              </TabsContent>
            )}

            {isCrmPvrStage && (
              <TabsContent value="pvr" className="p-6">
                <ValuationRequisitionForm 
                  loan={loan} 
                  isSaving={isSaving} 
                  onSave={async (data) => {
                    await handleLocalAndUpdateService(data, "PVR details finalized.");
                  }} 
                />
              </TabsContent>
            )}
            {loan.currentStageStatus === 'UNDER_ANALYSIS' && (
              <TabsContent value="analysis" className="p-6">
                <LoanAnalysisWork 
                  loan={loan} 
                  isSaving={isSaving} 
                  onSaveAnalysis={handleSaveAnalysis} 
                />
              </TabsContent>
            )}
            <TabsContent value="history" className="p-6"><LoanAuditTrail loan={loan} isSavingGlobal={isSaving} onRespondToRequest={e => { setSelectedEntryForResponse(e); setIsRespondToInfoDialogOpen(true); }}/></TabsContent>
          </Tabs>
            );
          })()}
        </CardContent>
      </Card>
      <EditLoanDetailsDialog isOpen={isEditLoanDialogOpen} onOpenChange={setIsEditLoanDialogOpen} loan={loan} users={users.filter(u => u.department === loan.assignedDepartment)} currentDepartment={loan.assignedDepartment} divisionOptions={wf05DivisionOptions} title={isWf05RoutingStage ? 'Assign & Move to Next Stage' : undefined} description={isWf05RoutingStage ? 'Assigning the next owner moves this case to their stage automatically.' : undefined} submitLabel={isWf05RoutingStage ? 'Assign & Move' : undefined} clearPreviousAssignments={isWf05RoutingStage} onSubmit={async d => { await handleAssignLoan(d.assignedTo || [], d.targetStageOrder); }} isSaving={isSaving} />
      <EditLoanDetailsDialog isOpen={isApproveReassignDialogOpen} onOpenChange={setIsApproveReassignDialogOpen} loan={loan} users={users.filter(u => u.department === loan.assignedDepartment)} currentDepartment={loan.assignedDepartment} title="Approve And Reassign" description="Select the users who should own the next stage in this same department. If the next stage moves to another department, the assignment will be cleared automatically." submitLabel="Approve And Promote" onSubmit={async d => { const uIds = d.assignedTo || []; await handleManagerPromoteLoan(false, users.filter(u => uIds.includes(u.id))); setIsApproveReassignDialogOpen(false); }} isSaving={isSaving} />
      <AddNoteToLoanDialog isOpen={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen} onSubmit={async n => { const h: LoanHistoryEntry = { id: `n-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', notes: n }; await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Note added."); setIsAddNoteDialogOpen(false); }} isSaving={isSaving} />
      <LogInfoRequestForLoanDialog isOpen={isLogInfoDialogOpen} onOpenChange={setIsLogInfoDialogOpen} onSubmit={async r => { const h: LoanHistoryEntry = { id: `ir-${Date.now()}`, stageName: currentStageDef?.name || 'N/A', timestamp: formatISO(new Date()), userId: currentUser?.id || 'sys', userName: currentUser?.fullName || 'sys', requiredFulfilment: r, isFulfilled: false }; await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Request logged."); setIsLogInfoDialogOpen(false); }} isSaving={isSaving} />
      <UploadLoanDocumentDialog isOpen={isUploadDocDialogOpen} onOpenChange={setIsUploadDocDialogOpen} loanId={loan.id} documentRequirement={currentDocumentRequirementToUpload} onSubmitAfterUpload={async (r, p, f) => { const nd: LoanDocument = { id: `doc-${Date.now()}`, name: r.name, requirementId: r.id, status: AppLoanDocumentStatus.SUBMITTED, filePath: p, uploadedAt: formatISO(new Date()) }; await handleLocalAndUpdateService({ documents: [...loan.documents, nd] }, "Uploaded."); setIsUploadDocDialogOpen(false); }} isParentSaving={isSaving} />
      <RespondToInfoRequestDialog isOpen={isRespondToInfoDialogOpen} onOpenChange={setIsRespondToInfoDialogOpen} entry={selectedEntryForResponse} onSubmit={async (id, res, fulfilled) => { await handleLocalAndUpdateService({ respondToInfoRequest: { entryId: id, response: res, markFulfilled: fulfilled } }, "Response saved."); setIsRespondToInfoDialogOpen(false); }} isSaving={isSaving} />
      <TerminateLoanDialog
        isOpen={isTerminateLoanDialogOpen}
        onOpenChange={setIsTerminateLoanDialogOpen}
        loan={loan}
        onSubmit={handleTerminateLoan}
        isSaving={isSaving}
      />
      <ManualTransitionDialog
        isOpen={isManualTransitionDialogOpen}
        onOpenChange={setIsManualTransitionDialogOpen}
        currentLoan={loan}
        workflowDefinitions={workflowDefinitions}
        onSubmit={handleManualTransition}
        isSaving={isSaving}
      />
      <ReturnLoanForReworkDialog 
        isOpen={isReturnForReworkDialogOpen} 
        onOpenChange={setIsReturnForReworkDialogOpen} 
        loan={loan} 
        forceCommentOnly={loan.submissionType === 'TYPE2' && loan.currentStageOrder === 7}
        users={
          loan.submissionType === 'TYPE2' && loan.currentStageOrder === 7
            ? users.filter(u => u.department === 'District' || u.department === 'Service Sector Department')
            : users.filter(u => u.department === loan.assignedDepartment)
        } 
        currentDepartment={
          loan.submissionType === 'TYPE2' && loan.currentStageOrder === 7
            ? 'District'
            : loan.assignedDepartment
        } 
        onSubmit={async (note, assigneeIds, isCommentOnly) => { 
          if (loan.submissionType === 'TYPE2' && loan.currentStageOrder === 7) {
            const result = await returnToDistrictAnalyst(loan.id, note, assigneeIds, true);
            if ('error' in result) {
               toast({ title: "Error", description: result.error, variant: "destructive" });
               return;
            }
          } else {
            const h: LoanHistoryEntry = { 
              id: `rw-${Date.now()}`, 
              stageName: currentStageDef?.name || 'N/A', 
              timestamp: formatISO(new Date()), 
              userId: currentUser?.id || 'sys', 
              userName: currentUser?.fullName || 'sys', 
              notes: `Returned for rework: ${note}` 
            }; 
            await recordCaseReview({ loanRequestId: loan.id, action: 'REWORKED', comment: note }); 
            await handleLocalAndUpdateService({ 
              assignedToUsers: users.filter(u => assigneeIds.includes(u.id)), 
              stageCompletedBy: [], 
              isReadyForManagerReview: false, 
              history: [...loan.history, h] 
            }, "Returned for rework."); 
          }
          setIsReturnForReworkDialogOpen(false); 
          router.refresh();
        }} 
        onReturnToCRM={handleReturnToCRM}
        isSaving={isSaving} 
      />

      <DistributeToCommitteeDialog
        isOpen={isDistributeDialogOpen}
        onOpenChange={setIsDistributeDialogOpen}
        loan={loan}
        onSubmit={handleDistributeToCommittee}
        isSaving={isSaving}
      />

      <Dialog open={isSkipPvrDialogOpen} onOpenChange={setIsSkipPvrDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SkipForward className="h-5 w-5 text-primary" /> Skip PVR and Valuation
            </DialogTitle>
            <DialogDescription>
              This will move the case directly to CRM LAF & Summary Preparation. You can add an optional reason below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <Textarea
              value={skipPvrReason}
              onChange={e => setSkipPvrReason(e.target.value)}
              placeholder="Optional reason for skipping PVR and Valuation"
              rows={4}
            />
          </div>
          <DialogFooter className="justify-between">
            <DialogClose asChild>
              <Button variant="outline" disabled={isSkippingPvr}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleConfirmSkipPvr} disabled={isSkippingPvr}>
              {isSkippingPvr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2 h-4 w-4" />}
              Confirm Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {loan && (
        <AnalystRemarkDialog 
          isOpen={isAnalystRemarkDialogOpen} 
          onOpenChange={setIsAnalystRemarkDialogOpen} 
          onSubmit={async (note, promote) => { 
            const h: LoanHistoryEntry = { 
              id: `remark-${Date.now()}`, 
              stageName: currentStageDef?.name || 'Analyst Review', 
              timestamp: formatISO(new Date()), 
              userId: currentUser?.id || '', 
              userName: currentUser?.fullName || '', 
              notes: `Analyst Remark: ${note}` 
            };
            
            if (promote) {
              const result = await approveDistrictAnalyst(loan.id, note);
              if ('error' in result) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
                return;
              }
              toast({ title: "Success", description: "Remark saved and case promoted to Final Manager Review." });
              router.refresh();
            } else {
              await handleLocalAndUpdateService({ history: [...loan.history, h] }, "Remark added successfully.");
            }
          }} 
          isSaving={isSaving}
          loanAmount={loan.loanAmount}
          currentStage={currentStageDef?.name || 'N/A'}
          loanNumber={loan.loanNumber}
          managerComments={loan.lafData?.managerComments}
          canPromoteToManager={canAnalystSubmitToFinalManager(loan)}
        />
      )}
    </div>
  );
}
