
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import type { LoanRequest, LoanDocument, LoanHistoryEntry, User as UserType, WorkflowDefinition, WorkflowStageDefinition, DocumentRequirement } from '@/types/loan';
import { LoanDocumentStatus, DocumentRequirementType, LoanDocumentStatus as AppLoanDocumentStatus } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLoanRequestById, updateLoanRequest, getWorkflowDefinitions } from '@/services/loan-service-prisma';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { Loader2, AlertCircle, MessageSquareWarning, Flame, ArrowLeft, History, Info as InfoIcon, FileText, ClipboardList } from 'lucide-react';
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
  const canViewPage = useMemo(() => userPermissions.has(PERMISSIONS.VIEW_LOAN_DETAILS), [userPermissions]);

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
  
  const terminationReason = useMemo(() => {
    if (!loan?.isTerminalStage) return null;

    const terminationEntry = [...loan.history]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .find(h => h.notes?.startsWith("Loan process terminated by higher authority. Reason:"));

    if (terminationEntry?.notes) {
      return terminationEntry.notes.replace("Loan process terminated by higher authority. Reason: ", "").trim();
    }
    
    return "No reason provided.";
  }, [loan]);

  const fetchLoanData = useCallback(async () => {
    if (!loanId || !canViewPage) {
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
      } else {
        setError(`Loan request with ID "${loanId}" not found.`);
        setLoan(null);
      }

      if (wfResult.error) {
         setError(prev => prev ? `${prev}\n${wfResult.error}` : wfResult.error);
      } else if (wfResult.workflows) {
        setWorkflowDefinitions(wfResult.workflows);
      }

    } catch (err: any) {
      setError("An unexpected error occurred while fetching page data.");
    } finally {
      setIsLoading(false);
    }
  }, [loanId, canViewPage]);

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
        toast({ title: "Update Error", description: serviceResult.error || "Failed to update loan. The data has been refreshed.", variant: "destructive" });
        await fetchLoanData();
        return {success: false};
      }
      
      toast({ title: "Update Successful", description: successMessage, variant: "default" });
      
      if(serviceResult.updatedLoan) {
        setLoan(serviceResult.updatedLoan);
        return {success: true, finalLoanState: serviceResult.updatedLoan};
      } else {
        await fetchLoanData();
        return {success: true, finalLoanState: undefined};
      }

    } catch (err: any) {
      toast({ title: "System Error", description: "A critical error occurred. Reverting changes.", variant: "destructive" });
      await fetchLoanData();
      return {success: false};
    } finally {
      setIsSaving(false);
    }
  }, [loan, toast, fetchLoanData]);


  const onAssignStaffSubmit = async (data: { assignedTo?: string[] }) => {
    if (!loan) return;
    
    const canAssignStaff = userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF);
    if (!canAssignStaff) return;

    const newAssignedUserIds = new Set(data.assignedTo || []);
    const currentAssignedUserIds = new Set(loan.assignedToUsers.map(u => u.id));

    let historyUpdate: LoanHistoryEntry[] = [...loan.history];
    
    const assignmentChanged = newAssignedUserIds.size !== currentAssignedUserIds.size ||
      !Array.from(newAssignedUserIds).every(id => currentAssignedUserIds.has(id));

    if (canAssignStaff && assignmentChanged) {
        const assignedUsers = users.filter(u => newAssignedUserIds.has(u.id));
        const assignedNames = assignedUsers.length > 0 ? assignedUsers.map(u => u.fullName).join(', ') : 'Unassigned';
        const currentUserName = currentUser?.fullName || 'System Process';
        historyUpdate.push({
            id: `hist-assign-${Date.now()}`,
            stageName: currentStageDef?.name || loan.currentStageName || 'Current Stage',
            timestamp: formatISO(new Date()),
            userId: currentUser?.id || 'system-prisma',
            userName: currentUserName,
            userRole: currentUser?.customRoleName || 'Administrator',
            userDepartment: currentUser?.department || 'System',
            notes: `Case assignment changed. Now assigned to: ${assignedNames}.`
        });
    }
    
    const payload: Partial<Omit<LoanRequest, 'id'>> = { history: historyUpdate };

    if (canAssignStaff) {
        payload.assignedToUsers = Array.from(newAssignedUserIds).map(id => users.find(u => u.id === id)).filter(Boolean) as UserType[];
        payload.stageCompletedBy = [];
        payload.isReadyForManagerReview = false;
    }

    const {success} = await handleLocalAndUpdateService(payload, "Staff assignment updated.");
    if (success) setIsEditLoanDialogOpen(false);
  };

  const onAddNoteSubmit = async (noteContent: string) => {
    if (!userPermissions.has(PERMISSIONS.ADD_LOAN_NOTES)) return;
    if (!noteContent.trim() || !loan) {
      toast({ title: "Note Required", description: "Please enter content for the note.", variant: "destructive" });
      return;
    }
    const stageNameToLog = currentStageDef?.name || loan.currentStageName || 'Current Stage';
    const currentUserName = currentUser?.fullName || 'System Process';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-note-${Date.now()}`, stageName: stageNameToLog, timestamp: formatISO(new Date()),
      userId: currentUser?.id || 'system-prisma',
      userName: currentUserName,
      userRole: currentUser?.customRoleName,
      userDepartment: currentUser?.department,
      notes: noteContent,
    };
    const {success} = await handleLocalAndUpdateService({ history: [...loan.history, newHistoryEntry] }, "Note added.");
    if (success) setIsAddNoteDialogOpen(false);
  };

  const onLogInfoRequestSubmit = async (infoToRequest: string) => {
    if (!userPermissions.has(PERMISSIONS.LOG_INFO_REQUEST)) return;
    if (!infoToRequest.trim() || !loan) {
      toast({ title: "Info Required", description: "Please specify information needed.", variant: "destructive" });
      return;
    }
    const stageNameToLog = currentStageDef?.name || loan.currentStageName || 'Current Stage';
    const currentUserName = currentUser?.fullName || 'System Process';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-inforeq-${Date.now()}`, stageName: stageNameToLog, timestamp: formatISO(new Date()),
      userId: currentUser?.id || 'system-prisma',
      userName: currentUserName,
      userRole: currentUser?.customRoleName,
      userDepartment: currentUser?.department,
      notes: `Logged information request: ${infoToRequest}`,
      requiredFulfilment: infoToRequest,
      isFulfilled: false,
    };
    const {success} = await handleLocalAndUpdateService({ history: [...loan.history, newHistoryEntry] }, "Information request logged.");
    if (success) setIsLogInfoDialogOpen(false);
  };

  const onRespondToInfoRequestSubmit = async (entryId: string, response: string, markFulfilled: boolean) => {
    if (!loan || !userPermissions.has(PERMISSIONS.FULFILL_INFO_REQUEST)) return;
    
    const { success } = await handleLocalAndUpdateService(
        { respondToInfoRequest: { entryId, response, markFulfilled } },
        markFulfilled ? "Information requirement fulfilled." : "Response saved."
    );

    if (success) {
        setIsRespondToInfoDialogOpen(false);
        setSelectedEntryForResponse(null);
    }
  };
  
  const validateCurrentStageRequirements = useCallback((loanForValidation?: LoanRequest | null): boolean => {
    const loanToUse = loanForValidation || loan;
    if (!loanToUse || !currentStageDef) {
        toast({ title: 'Workflow Info Missing', description: 'Cannot validate requirements as current stage definition is missing.', variant: 'destructive' });
        return false;
    }

    const activeInfoReq = loanToUse.history.find(entry => entry.requiredFulfilment && !entry.isFulfilled);
    if (activeInfoReq) {
        toast({ title: 'Action Pending', description: `Outstanding action: '${activeInfoReq.requiredFulfilment}' must be resolved.`, variant: 'destructive', duration: 7000 });
        return false;
    }

    if (currentStageDef.documentRequirements.length > 0) {
        const pendingDocs = currentStageDef.documentRequirements.filter(req => {
            if (!req.isMandatory) return false;
            const uploadedDoc = loanToUse.documents.find(d => d.requirementId === req.id);
            return !uploadedDoc || uploadedDoc.status !== LoanDocumentStatus.VERIFIED;
        });

        if (pendingDocs.length > 0) {
            toast({ title: 'Documents Pending', description: `Cannot proceed. Mandatory docs for stage '${currentStageDef.name}' must be fulfilled and verified: ${pendingDocs.map(p => p.name).join(', ')}.`, variant: 'destructive', duration: 9000 });
            return false;
        }
    }

    return true;
  }, [loan, currentStageDef, toast]);

  const handleMarkStageComplete = async () => {
    if (!userPermissions.has(PERMISSIONS.MARK_STAGE_COMPLETE) || !loan || !currentStageDef || !currentUser) return;
    if (!validateCurrentStageRequirements()) return;

    const assignedUserIds = new Set(loan.assignedToUsers.map(u => u.id));
    if (assignedUserIds.size === 0) {
      toast({ title: "Action Not Allowed", description: "Cannot complete stage: No staff assigned.", variant: "destructive" });
      return;
    }

    const completedUserIds = new Set(loan.stageCompletedBy?.map(u => u.id) || []);
    if (!completedUserIds.has(currentUser.id)) completedUserIds.add(currentUser.id);
    
    const allAssignedHaveCompleted = Array.from(assignedUserIds).every(id => completedUserIds.has(id));

    const officerName = currentUser.fullName || 'Officer';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-officercomplete-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: currentUser.id,
      userName: officerName,
      userRole: currentUser.customRoleName,
      userDepartment: currentUser.department,
      notes: `Staff marked stage '${currentStageDef.name}' as their part complete.`,
    };

    if (allAssignedHaveCompleted) {
        newHistoryEntry.notes += ` All assigned staff have completed their tasks. Submitted for manager review in ${loan.assignedDepartment} department.`;
    } else {
        const remainingCount = assignedUserIds.size - completedUserIds.size;
        newHistoryEntry.notes += ` Waiting for ${remainingCount} other assigned staff to complete.`;
    }
    
    const updatedStageCompletedBy = users.filter(u => completedUserIds.has(u.id));

    await handleLocalAndUpdateService({
        isReadyForManagerReview: allAssignedHaveCompleted,
        stageCompletedBy: updatedStageCompletedBy,
        history: [...loan.history, newHistoryEntry] 
    }, `Your part in stage '${currentStageDef.name}' marked complete.`);
  };

  const handleManagerPromoteLoan = async () => {
    if (!userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE) || !currentUser || !loan || !currentWorkflowVersion || !currentStageDef || !currentWorkflowDef) return;

    const assignedUserIds = new Set(loan.assignedToUsers.map(u => u.id));
    if (assignedUserIds.size > 0) {
      const completedUserIds = new Set(loan.stageCompletedBy.map(u => u.id));
      if (!Array.from(assignedUserIds).every(id => completedUserIds.has(id))) {
          toast({ title: "Promotion Blocked", description: "Not all assigned staff have marked their work as complete.", variant: "destructive" });
          return;
      }
    }

    if (!validateCurrentStageRequirements()) return;

    const currentStageIndex = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
    if (currentStageIndex === -1) {
      toast({ title: "Error", description: "Could not determine current stage index.", variant: "destructive" });
      return;
    }

    const currentUserName = currentUser.fullName || 'System Process';
    if (currentStageIndex === currentWorkflowVersion.stages.length - 1) {
        const loanWorkflows = workflowDefinitions
            .filter(def => def.parentSectorId === currentWorkflowDef.parentSectorId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentWorkflowIndexInPath = loanWorkflows.findIndex(def => def.id === currentWorkflowDef.id);

        if (currentWorkflowIndexInPath === -1 || currentWorkflowIndexInPath === loanWorkflows.length - 1) {
            toast({ title: "Process Complete", description: "Final workflow in path reached.", variant: "default" });
            return;
        }

        const nextWorkflowDef = loanWorkflows[currentWorkflowIndexInPath + 1];
        const nextActiveVersion = nextWorkflowDef.versions.find(v => v.isActive);

        if (!nextActiveVersion || nextActiveVersion.stages.length === 0) {
            toast({ title: "Promotion Error", description: `Next workflow "${nextWorkflowDef.name}" is misconfigured.`, variant: "destructive" });
            return;
        }

        const firstStageOfNextWorkflow = nextActiveVersion.stages[0];

        const newHistoryEntry: LoanHistoryEntry = {
            id: `hist-workflow-change-${Date.now()}`,
            stageName: firstStageOfNextWorkflow.name,
            timestamp: formatISO(new Date()),
            userId: currentUser.id,
            userName: currentUserName,
            userRole: currentUser.customRoleName,
            userDepartment: currentUser.department,
            notes: `Workflow '${currentWorkflowDef.name}' complete. Automatically promoted to new workflow: '${nextWorkflowDef.name}', Stage: '${firstStageOfNextWorkflow.name}'.`,
        };

        await handleLocalAndUpdateService({
            workflowVersionId: nextActiveVersion.id,
            currentStageId: firstStageOfNextWorkflow.id,
            assignedDepartmentId: nextWorkflowDef.departmentId, 
            assignedToUsers: [], 
            stageCompletedBy: [],
            isReadyForManagerReview: false,
            history: [...loan.history, newHistoryEntry],
            stageDeadline: formatISO(addDays(new Date(), firstStageOfNextWorkflow.defaultTimelineDays)),
        }, `Loan promoted to ${nextWorkflowDef.name} (${nextWorkflowDef.departmentName} Dept).`);

    } else {
        const nextStageDef = currentWorkflowVersion.stages[currentStageIndex + 1];
        const newHistoryEntry: LoanHistoryEntry = {
          id: `hist-promote-${Date.now()}`, stageName: nextStageDef.name, timestamp: formatISO(new Date()),
          userId: currentUser.id,
          userName: currentUserName,
          userRole: currentUser.customRoleName,
          userDepartment: currentUser.department,
          notes: `Manager approved stage '${currentStageDef.name}' and promoted to '${nextStageDef.name}'. Case moved to ${nextStageDef.responsibleDepartment} department.`
        };
        
        const statusForNextDept = nextStageDef.availableStatuses?.[nextStageDef.responsibleDepartment] || [];
        const initialStatusForNextStage = statusForNextDept.length > 0 ? statusForNextDept[0] : 'Initiated';

        await handleLocalAndUpdateService({
          currentStageId: nextStageDef.id,
          currentStageStatus: initialStatusForNextStage,
          assignedDepartmentId: users.find(u => u.department === nextStageDef.responsibleDepartment)?.departmentId,
          assignedToUsers: [],
          stageCompletedBy: [], 
          history: [...loan.history, newHistoryEntry],
          isReadyForManagerReview: false,
          stageDeadline: formatISO(addDays(new Date(), nextStageDef.defaultTimelineDays)),
          workflowVersionId: loan.workflowVersionId,
        }, `Loan promoted to ${nextStageDef.name} (${nextStageDef.responsibleDepartment} Dept).`);
    }
  };

  const onReturnForReworkSubmit = async (reworkNote: string, reworkAssigneeIds: string[]) => {
    if (!userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK) || !currentUser || !loan || !currentStageDef) return;
    if (!reworkNote.trim()) {
      toast({ title: "Note Required", description: "Please provide reason for returning.", variant: "destructive" });
      return;
    }
    const currentUserName = currentUser.fullName || 'System Process';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-rework-${Date.now()}`,
      stageName: currentStageDef.name,
      timestamp: formatISO(new Date()),
      userId: currentUser.id,
      userName: currentUserName,
      userRole: currentUser.customRoleName,
      userDepartment: currentUser.department,
      notes: `Manager returned case for rework. Reason: ${reworkNote}`
    };
    const {success} = await handleLocalAndUpdateService({
      isReadyForManagerReview: false,
      stageCompletedBy: [], 
      assignedToUsers: users.filter(u => reworkAssigneeIds.includes(u.id)),
      history: [...loan.history, newHistoryEntry],
    }, "Loan case returned for rework.");
    if (success) setIsReturnForReworkDialogOpen(false);
  };

  const onTerminateLoanSubmit = async (terminationReason: string) => {
    if (!userPermissions.has(PERMISSIONS.TERMINATE_LOAN_PROCESS) || !currentUser || !loan) return;
    if (!terminationReason.trim()) {
      toast({ title: "Reason Required", variant: "destructive" });
      return;
    }

    const currentUserName = currentUser.fullName || 'System Process';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-terminate-${Date.now()}`,
      stageName: currentStageDef?.name || loan.currentStageName || 'N/A',
      timestamp: formatISO(new Date()),
      userId: currentUser.id,
      userName: currentUserName,
      userRole: currentUser.customRoleName,
      userDepartment: currentUser.department,
      notes: `Loan process terminated by higher authority. Reason: ${terminationReason}`,
    };

    const {success} = await handleLocalAndUpdateService({
      isTerminalStage: true,
      isReadyForManagerReview: false,
      currentStageStatus: "Terminated",
      history: [...loan.history, newHistoryEntry],
    }, "Loan process has been terminated.");

    if (success) setIsTerminateLoanDialogOpen(false);
  };

  const onManualTransitionSubmit = async (newWorkflowVersionId: string, newStageId: string, reason: string) => {
    if (!userPermissions.has(PERMISSIONS.MANUAL_STAGE_TRANSITION) || !currentUser || !loan) return;

    const allVersions = workflowDefinitions.flatMap(def => def.versions);
    const newVersion = allVersions.find(v => v.id === newWorkflowVersionId);
    if (!newVersion) return;
    const newStage = newVersion.stages.find(s => s.id === newStageId);
    if (!newStage) return;

    const currentUserName = currentUser.fullName || 'System Process';
    const fromStageName = currentStageDef?.name || 'Unknown Stage';
    const newHistoryEntry: LoanHistoryEntry = {
        id: `hist-manual-transition-${Date.now()}`,
        stageName: newStage.name,
        timestamp: formatISO(new Date()),
        userId: currentUser.id,
        userName: currentUserName,
        userRole: currentUser.customRoleName,
        userDepartment: currentUser.department,
        notes: `MANUAL TRANSITION: Moved from '${fromStageName}' to '${newStage.name}'. Reason: ${reason}`,
    };

    const {success} = await handleLocalAndUpdateService({
        workflowVersionId: newWorkflowVersionId,
        currentStageId: newStageId,
        assignedDepartmentId: users.find(u => u.department === newStage.responsibleDepartment)?.departmentId,
        assignedToUsers: [],
        stageCompletedBy: [],
        isReadyForManagerReview: false,
        history: [...loan.history, newHistoryEntry],
        stageDeadline: formatISO(addDays(new Date(), newStage.defaultTimelineDays)),
    }, `Loan manually transitioned to ${newStage.name}.`);

    if (success) setIsManualTransitionDialogOpen(false);
  };


  const handleDocumentUploaded = async (requirement: DocumentRequirement, uploadedFilePath: string, originalUploadedFileName: string) => {
    if (!loan || !userPermissions.has(PERMISSIONS.UPLOAD_LOAN_DOCUMENTS)) return;
    
    const existingDocIndex = loan.documents.findIndex(d => d.requirementId === requirement.id);
    let updatedDocuments: LoanDocument[];
    const timestamp = formatISO(new Date());

    const newDocData: LoanDocument = {
        id: existingDocIndex > -1 ? loan.documents[existingDocIndex].id : `doc-fs-${Date.now()}`,
        name: requirement.name,
        requirementId: requirement.id,
        status: AppLoanDocumentStatus.SUBMITTED,
        notes: `File uploaded: ${originalUploadedFileName}.`,
        uploadedAt: timestamp,
        filePath: uploadedFilePath,
    };

    if (existingDocIndex > -1) {
        updatedDocuments = loan.documents.map((doc, index) => index === existingDocIndex ? { ...newDocData, id: doc.id } : doc );
    } else {
        updatedDocuments = [...loan.documents, newDocData];
    }

    const {success} = await handleLocalAndUpdateService({ documents: updatedDocuments }, `Document for '${requirement.name}' uploaded.`);
    if (success) setIsUploadDocDialogOpen(false);
  };
  
  const handleVerifyDocument = async (docId: string) => {
    if (!loan || !userPermissions.has(PERMISSIONS.VERIFY_LOAN_DOCUMENTS)) return;
    
    const updatedDocuments = loan.documents.map(doc =>
      doc.id === docId ? { ...doc, status: AppLoanDocumentStatus.VERIFIED, notes: (doc.notes || '') + `\nManually verified by ${currentUser?.fullName} on ${new Date().toLocaleDateString()}` } : doc
    );
    
    const docName = loan.documents.find(d => d.id === docId)?.name || 'Unknown';
    await handleLocalAndUpdateService({ documents: updatedDocuments }, `Document "${docName}" marked as Verified.`);
  };

  const handleCheckboxRequirementChange = async (requirement: DocumentRequirement, isChecked: boolean) => {
    if (!loan || !currentUser) return;
  
    let updatedDocuments = [...loan.documents];
    const existingDocIndex = updatedDocuments.findIndex((d) => d.requirementId === requirement.id);
  
    if (isChecked) {
      if (existingDocIndex === -1) {
        const newDoc: LoanDocument = {
          id: `doc-chk-${Date.now()}`,
          requirementId: requirement.id,
          name: requirement.name,
          status: AppLoanDocumentStatus.VERIFIED,
          notes: `Confirmed by ${currentUser.fullName} on ${new Date().toLocaleDateString()}.`,
          uploadedAt: new Date().toISOString(),
        };
        updatedDocuments.push(newDoc);
      }
    } else {
      if (existingDocIndex > -1) updatedDocuments.splice(existingDocIndex, 1);
    }
  
    await handleLocalAndUpdateService({ documents: updatedDocuments }, `Requirement '${requirement.name}' updated.`);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!loan || !loan.assignedDepartment || !currentStageDef?.availableStatuses) return;
    const availableStatuses = currentStageDef.availableStatuses[loan.assignedDepartment] || [];
    if (!availableStatuses.includes(newStatus) || loan.currentStageStatus === newStatus) return;
    
    const currentUserName = currentUser?.fullName || 'System';
    const newHistoryEntry: LoanHistoryEntry = {
        id: `hist-statuschange-${Date.now()}`,
        stageName: currentStageDef.name,
        timestamp: formatISO(new Date()),
        userId: currentUser?.id || 'system-prisma',
        userName: currentUserName,
        userRole: currentUser?.customRoleName,
        userDepartment: currentUser?.department,
        notes: `Stage status changed from "${loan.currentStageStatus || 'None'}" to "${newStatus}".`,
    };
    
    await handleLocalAndUpdateService({ currentStageStatus: newStatus, history: [...loan.history, newHistoryEntry] }, `Status updated to "${newStatus}".`);
  };

  const handleUrgencyChange = async (isUrgent: boolean) => {
    if (!loan || !userPermissions.has(PERMISSIONS.FLAG_URGENT_CASE)) return;
    await handleLocalAndUpdateService({ isUrgent }, `Loan marked as ${isUrgent ? 'urgent' : 'not urgent'}.`);
  };
  
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading loan details...</p>
      </div>
    );
  }

  if (!canViewPage) {
     return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view loan details.</p>
            <Button variant="outline" onClick={() => router.push('/')}><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
        </div>
    );
  }

  if (!loan) { 
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Loan Not Found</h1>
            <p className="text-muted-foreground mb-6">{error || `Could not find loan.`}</p>
            <Button onClick={() => router.push('/loan-process')}>Back to Pipeline</Button>
        </div>
    );
  }

  const isActionable = !loan.isTerminalStage;
  let progressPercentage = 0;
  if (currentWorkflowVersion && loan?.currentStageId) {
      const currentStageIndexInWorkflow = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
      if (currentStageIndexInWorkflow > -1 && currentWorkflowVersion.stages.length > 0) {
          progressPercentage = currentWorkflowVersion.stages.slice(0, currentStageIndexInWorkflow).reduce((sum, stage) => sum + (Number(stage.percentageWeight) || 0), 0);
      }
  }
  progressPercentage = Math.min(100, Math.max(0, progressPercentage));

  const loanCurrentDept = loan.assignedDepartment || currentStageDef?.responsibleDepartment;
  const usersForDialog = users.filter(user => user.department === loanCurrentDept);
  const availableStatuses = (currentStageDef?.availableStatuses && loanCurrentDept && currentStageDef.availableStatuses[loanCurrentDept]) || [];

  const latestReworkNote = [...loan.history]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .find(h => h.notes?.startsWith("Manager returned case for rework."));


  return (
    <div className="space-y-6">
      <LoanDetailHeader
        loan={loan}
        currentStageName={currentStageDef?.name || loan.currentStageName || 'Unknown Stage'}
        onBack={() => router.back()}
        onOpenEditDialog={() => setIsEditLoanDialogOpen(true)}
        onOpenAddNoteDialog={() => setIsAddNoteDialogOpen(true)}
        onOpenLogInfoDialog={() => setIsLogInfoDialogOpen(true)}
        onMarkStageComplete={handleMarkStageComplete}
        onManagerPromoteLoan={handleManagerPromoteLoan}
        onOpenReturnForReworkDialog={() => setIsReturnForReworkDialogOpen(true)}
        onOpenTerminateLoanDialog={() => setIsTerminateLoanDialogOpen(true)}
        onOpenManualTransitionDialog={() => setIsManualTransitionDialogOpen(true)}
        isSaving={isSaving}
        isActionableStage={isActionable}
      />

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle>
              <CardDescription>Loan ID: {loan.loanNumber}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
                <Badge className={`px-3 py-1.5 text-sm font-medium`}>
                  Stage: {currentStageDef?.name || loan.currentStageName || 'Unknown Stage'}
                </Badge>
                {availableStatuses.length > 0 && isActionable ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select value={loan.currentStageStatus || ''} onValueChange={handleStatusChange} disabled={isSaving}>
                      <SelectTrigger className="h-8 text-sm w-40"><SelectValue placeholder="Set Status" /></SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  loan.currentStageStatus && <Badge variant="secondary">{loan.currentStageStatus}</Badge>
                )}
                 <Badge variant="outline" className="text-sm">Dept: {loanCurrentDept || 'N/A'}</Badge>
                {loan.isUrgent && <Badge variant="destructive" className="bg-red-500 text-white animate-pulse"><Flame className="mr-1 h-3 w-3"/> Urgent</Badge>}
                {loan.isReadyForManagerReview && isActionable && <Badge variant="outline" className="text-orange-600 border-orange-500 bg-orange-50 font-bold">Awaiting Manager Review</Badge>}
                {loan.isTerminalStage && <Badge variant="destructive" className="text-base py-1.5 px-3 h-auto"><span className="font-semibold">Terminated:</span>&nbsp;<span className="font-normal">{terminationReason}</span></Badge>}
            </div>
          </div>
           {userPermissions.has(PERMISSIONS.FLAG_URGENT_CASE) && isActionable && (
              <div className="flex items-center space-x-2 pt-4 border-t mt-4">
                <Switch id="urgent-switch" checked={loan.isUrgent} onCheckedChange={handleUrgencyChange} disabled={isSaving} />
                <Label htmlFor="urgent-switch" className="text-red-600 font-semibold cursor-pointer">Flag as Urgent Case</Label>
              </div>
            )}
        </CardHeader>
        <CardContent className="p-0">
          {latestReworkNote && (
            <Alert variant="destructive" className="m-6 bg-amber-50 border-amber-400 text-amber-800">
              <MessageSquareWarning className="h-5 w-5" />
              <AlertTitleShadCN>Returned for Rework by {latestReworkNote.userName} on {format(parseISO(latestReworkNote.timestamp), 'MMM dd, yyyy')}</AlertTitleShadCN>
              <AlertDescriptionShadCN className="font-medium whitespace-pre-wrap">{latestReworkNote.notes?.replace("Manager returned case for rework. Reason: ", "")}</AlertDescriptionShadCN>
            </Alert>
          )}

          <div className="px-6 pt-6">
            <LoanProgressDisplay loan={loan} progressPercentage={progressPercentage} currentStageName={currentStageDef?.name || loan.currentStageName || 'Unknown Stage'}/>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-12">
              <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-2"><InfoIcon className="h-4 w-4"/> Application Info</TabsTrigger>
              <TabsTrigger value="documents" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-2"><FileText className="h-4 w-4"/> Requirements & Docs</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 gap-2"><ClipboardList className="h-4 w-4"/> Case History (Audit Trail)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="p-6 focus-visible:ring-0">
               <LoanInfoDisplay loan={loan} assignedUsers={loan.assignedToUsers} assignedDepartment={loanCurrentDept} />
            </TabsContent>

            <TabsContent value="documents" className="p-6 focus-visible:ring-0">
               <div className="max-w-4xl">
                <LoanDocumentsManager
                  loan={loan}
                  currentStageDef={currentStageDef}
                  onOpenUploadDialog={userPermissions.has(PERMISSIONS.UPLOAD_LOAN_DOCUMENTS) && isActionable ? (docReq) => { setCurrentDocumentRequirementToUpload(docReq); setIsUploadDocDialogOpen(true); } : undefined}
                  onVerifyDocument={userPermissions.has(PERMISSIONS.VERIFY_LOAN_DOCUMENTS) && isActionable ? handleVerifyDocument : undefined}
                  onCheckboxChange={handleCheckboxRequirementChange}
                  isSavingGlobal={isSaving}
                />
               </div>
            </TabsContent>

            <TabsContent value="history" className="p-6 focus-visible:ring-0">
               <LoanAuditTrail 
                loan={loan} 
                onRespondToRequest={userPermissions.has(PERMISSIONS.FULFILL_INFO_REQUEST) && isActionable ? (entry) => { setSelectedEntryForResponse(entry); setIsRespondToInfoDialogOpen(true); } : undefined}
                isSavingGlobal={isSaving}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
         <CardFooter className="p-6 border-t bg-muted/5">
            <p className="text-xs text-muted-foreground">Last Database Sync: {loan.lastUpdatedDate ? format(parseISO(loan.lastUpdatedDate), 'PPpp') : 'N/A'}</p>
        </CardFooter>
      </Card>

      {userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF) && <EditLoanDetailsDialog isOpen={isEditLoanDialogOpen} onOpenChange={setIsEditLoanDialogOpen} loan={loan} users={usersForDialog} currentDepartment={loanCurrentDept} onSubmit={onAssignStaffSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.ADD_LOAN_NOTES) && <AddNoteToLoanDialog isOpen={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen} onSubmit={onAddNoteSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.LOG_INFO_REQUEST) && <LogInfoRequestForLoanDialog isOpen={isLogInfoDialogOpen} onOpenChange={setIsLogInfoDialogOpen} onSubmit={onLogInfoRequestSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.UPLOAD_LOAN_DOCUMENTS) && <UploadLoanDocumentDialog isOpen={isUploadDocDialogOpen} onOpenChange={(isOpen) => { setIsUploadDocDialogOpen(isOpen); if (!isOpen) setCurrentDocumentRequirementToUpload(null);}} loanId={loan.id} documentRequirement={currentDocumentRequirementToUpload} onSubmitAfterUpload={handleDocumentUploaded} isParentSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK) && <ReturnLoanForReworkDialog isOpen={isReturnForReworkDialogOpen} onOpenChange={setIsReturnForReworkDialogOpen} loan={loan} users={usersForDialog} currentDepartment={loanCurrentDept} onSubmit={onReturnForReworkSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.TERMINATE_LOAN_PROCESS) && <TerminateLoanDialog isOpen={isTerminateLoanDialogOpen} onOpenChange={setIsTerminateLoanDialogOpen} loan={loan} onSubmit={onTerminateLoanSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.MANUAL_STAGE_TRANSITION) && <ManualTransitionDialog isOpen={isManualTransitionDialogOpen} onOpenChange={setIsManualTransitionDialogOpen} currentLoan={loan} workflowDefinitions={workflowDefinitions} onSubmit={onManualTransitionSubmit} isSaving={isSaving} />}
      {selectedEntryForResponse && <RespondToInfoRequestDialog isOpen={isRespondToInfoDialogOpen} onOpenChange={(isOpen) => { setIsRespondToInfoDialogOpen(isOpen); if(!isOpen) setSelectedEntryForResponse(null); }} entry={selectedEntryForResponse} onSubmit={onRespondToInfoRequestSubmit} isSaving={isSaving} />}
    </div>
  );
}
