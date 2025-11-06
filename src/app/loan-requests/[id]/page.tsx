
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import type { LoanRequest, LoanDocument, LoanHistoryEntry, User as UserType, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, DocumentRequirement } from '@/types/loan';
import { LoanDocumentStatus, DocumentRequirementType } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLoanRequestById, updateLoanRequest, getWorkflowDefinitions } from '@/services/loan-service-prisma';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { Loader2, AlertCircle, MessageSquareWarning, Flame } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { LoanDetailHeader } from '@/components/loan/detail/LoanDetailHeader';
import { LoanProgressDisplay } from '@/components/loan/detail/LoanProgressDisplay';
import { LoanInfoDisplay } from '@/components/loan/detail/LoanInfoDisplay';
import { LoanDocumentsManager } from '@/components/loan/detail/LoanDocumentsManager';
import { LoanHistoryTimeline } from '@/components/loan/detail/LoanHistoryTimeline';

import { EditLoanDetailsDialog, UNASSIGNED_DIALOG_OPTION_VALUE } from '@/components/loan/dialogs/EditLoanDetailsDialog';
import { AddNoteToLoanDialog } from '@/components/loan/dialogs/AddNoteToLoanDialog';
import { LogInfoRequestForLoanDialog } from '@/components/loan/dialogs/LogInfoRequestForLoanDialog';
import { ReturnLoanForReworkDialog } from '@/components/loan/dialogs/ReturnLoanForReworkDialog';
import { UploadLoanDocumentDialog } from '@/components/loan/dialogs/UploadLoanDocumentDialog';
import { TerminateLoanDialog } from '@/components/loan/dialogs/TerminateLoanDialog';
import { ManualTransitionDialog } from '@/components/loan/dialogs/ManualTransitionDialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


export default function LoanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const loanId = params.id as string;
  const { user: currentUser } = useAuth();

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
  
  // ALL HOOKS MOVED TO TOP LEVEL
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);

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
    if (!loanId) return;
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
      } else {
         setError(prev => prev ? `${prev}\nAn issue occurred loading workflow data.` : `An issue occurred loading workflow data.`);
      }

    } catch (err: any) {
      setError("An unexpected error occurred while fetching page data.");
    } finally {
      setIsLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    fetchLoanData();
  }, [fetchLoanData]);
  
  const handleLocalAndUpdateService = useCallback(async (
    updatedFields: Partial<Omit<LoanRequest, 'id'>>,
    successMessage: string,
  ): Promise<boolean> => {
    if (!loan) return false;
    setIsSaving(true);

    const optimisticLoanState: LoanRequest = {
        ...loan,
        ...updatedFields,
        history: updatedFields.history ? [...updatedFields.history] : [...loan.history],
        documents: updatedFields.documents !== undefined ? [...updatedFields.documents] : [...loan.documents],
        lastUpdatedDate: formatISO(new Date()),
    };

    setLoan(optimisticLoanState); 

    try {
      const servicePayload = { ...updatedFields, lastUpdatedDate: formatISO(new Date()) };
      
      const serviceResult = await updateLoanRequest(loan.id, servicePayload); 
      
      if (serviceResult.error || !serviceResult.success) {
        toast({ title: "Update Error", description: serviceResult.error || "Failed to update loan. The data has been refreshed.", variant: "destructive" });
        await fetchLoanData(); 
        return false;
      }
      
      toast({ title: "Update Successful", description: successMessage, variant: "default" });
      
      if(serviceResult.updatedLoan) {
        setLoan(serviceResult.updatedLoan);
      } else {
        await fetchLoanData(); 
      }
      return true;
    } catch (err: any) {
      toast({ title: "System Error", description: "A critical error occurred. Reverting changes.", variant: "destructive" });
      await fetchLoanData(); // Revert on critical failure
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [loan, toast, fetchLoanData]);


  const onEditLoanSubmit = async (data: any) => {
    if (!loan) return;
    
    const canEditDetails = userPermissions.has(PERMISSIONS.EDIT_LOAN_DETAILS);
    const canAssignStaff = userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF);

    if (!canEditDetails && !canAssignStaff) return;

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
            notes: `Case assignment changed. Now assigned to: ${assignedNames}.`
        });
    }
    
    const payload: Partial<Omit<LoanRequest, 'id'>> = { history: historyUpdate };
    if (canEditDetails) {
        Object.assign(payload, {
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: data.customerPhone,
            loanAmount: Number(data.loanAmount),
            loanType: data.loanType,
            loanPurpose: data.loanPurpose,
        });
    }
    if (canAssignStaff) {
        payload.assignedToUsers = Array.from(newAssignedUserIds).map(id => users.find(u => u.id === id)).filter(Boolean) as UserType[];
        payload.stageCompletedBy = [];
        payload.isReadyForManagerReview = false;
    }

    const success = await handleLocalAndUpdateService(payload, "Loan details updated.");
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
      notes: noteContent,
    };
    const success = await handleLocalAndUpdateService({ history: [...loan.history, newHistoryEntry] }, "Note added.");
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
      notes: `Logged information request: ${infoToRequest}`,
      requiredFulfilment: infoToRequest,
    };
    const success = await handleLocalAndUpdateService({ history: [...loan.history, newHistoryEntry] }, "Information request logged.");
    if (success) setIsLogInfoDialogOpen(false);
  };

  const handleFulfillInfoRequest = async (entryId: string, requirementText: string) => {
    if (!loan || !userPermissions.has(PERMISSIONS.FULFILL_INFO_REQUEST)) return;
    const stageNameToLog = currentStageDef?.name || loan.currentStageName || 'Current Stage';
    const currentUserName = currentUser?.fullName || 'User';
    const updatedHistory = loan.history.map(h =>
        h.id === entryId ? { ...h, notes: `${h.notes || ''}\n[FULFILLED MOCK] by ${currentUserName} on ${new Date().toLocaleDateString()}. Requirement: ${requirementText}` } : h
    );
    updatedHistory.push({
        id: `hist-fulfill-${Date.now()}`, stageName: stageNameToLog, timestamp: formatISO(new Date()),
        userId: currentUser?.id || 'system-prisma',
        userName: currentUserName,
        notes: `Information received for requirement: "${requirementText}". Ready for re-evaluation.`
    });
    await handleLocalAndUpdateService({ history: updatedHistory }, "Information fulfillment status updated.");
  };

  const validateCurrentStageRequirements = useCallback((): boolean => {
    if (!loan || !currentStageDef) {
      toast({
        title: 'Workflow Info Missing',
        description:
          'Cannot validate requirements as current stage definition is missing.',
        variant: 'destructive',
      });
      return false;
    }
  
    const activeInfoReq = [...loan.history]
      .reverse()
      .find(
        (entry) =>
          entry.requiredFulfilment &&
          (!entry.notes || !entry.notes.includes('[FULFILLED MOCK]'))
      );
    if (activeInfoReq) {
      toast({
        title: 'Action Pending',
        description: `Outstanding action: '${activeInfoReq.requiredFulfilment}' must be resolved.`,
        variant: 'destructive',
      });
      return false;
    }
  
    if (currentStageDef.documentRequirements.length > 0) {
      const pendingDocs = currentStageDef.documentRequirements.filter((req) => {
        if (!req.isMandatory) return false;
        const uploadedDoc = loan.documents.find(
          (d) => d.requirementId === req.id
        );
        return !uploadedDoc || uploadedDoc.status !== LoanDocumentStatus.VERIFIED;
      });
  
      if (pendingDocs.length > 0) {
        toast({
          title: 'Documents Pending',
          description: `Cannot proceed. Mandatory docs for stage '${
            currentStageDef.name
          }' must be fulfilled and verified: ${pendingDocs
            .map((p) => p.name)
            .join(', ')}.`,
          variant: 'destructive',
        });
        return false;
      }
    }
  
    return true;
  }, [loan, currentStageDef, toast]);

  const handleMarkStageComplete = async () => {
    if (!userPermissions.has(PERMISSIONS.MARK_STAGE_COMPLETE) || !loan || !currentStageDef || !validateCurrentStageRequirements() || !currentUser) return;

    const assignedUserIds = new Set(loan.assignedToUsers.map(u => u.id));
    if (assignedUserIds.size === 0) {
      toast({ title: "Action Not Allowed", description: "Cannot complete stage: No staff assigned.", variant: "destructive" });
      return;
    }

    const completedUserIds = new Set(loan.stageCompletedBy?.map(u => u.id) || []);
    
    if (!completedUserIds.has(currentUser.id)) {
        completedUserIds.add(currentUser.id);
    }
    
    const allAssignedHaveCompleted = Array.from(assignedUserIds).every(id => completedUserIds.has(id));

    const officerName = currentUser.fullName || 'Officer';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-officercomplete-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: currentUser.id,
      userName: officerName,
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
          toast({
              title: "Promotion Blocked",
              description: "Cannot promote stage. Not all assigned staff have marked their work as complete.",
              variant: "destructive",
          });
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
            .filter(def => def.loanTypeId === currentWorkflowDef.loanTypeId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentWorkflowIndexInPath = loanWorkflows.findIndex(def => def.id === currentWorkflowDef.id);

        if (currentWorkflowIndexInPath === -1 || currentWorkflowIndexInPath === loanWorkflows.length - 1) {
            toast({ title: "Process Complete", description: "This is the final workflow in the loan path. No further automatic promotion.", variant: "default" });
            return;
        }

        const nextWorkflowDef = loanWorkflows[currentWorkflowIndexInPath + 1];
        const nextActiveVersion = nextWorkflowDef.versions.find(v => v.isActive);

        if (!nextActiveVersion || nextActiveVersion.stages.length === 0) {
            toast({ title: "Promotion Error", description: `Next workflow "${nextWorkflowDef.name}" has no active version or stages. Cannot promote.`, variant: "destructive" });
            return;
        }

        const firstStageOfNextWorkflow = nextActiveVersion.stages[0];

        const newHistoryEntry: LoanHistoryEntry = {
            id: `hist-workflow-change-${Date.now()}`,
            stageName: firstStageOfNextWorkflow.name,
            timestamp: formatISO(new Date()),
            userId: currentUser.id,
            userName: currentUserName,
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
        }, `Loan automatically promoted to new workflow: ${firstStageOfNextWorkflow.name}.`);

    } else {
        const nextStageDef = currentWorkflowVersion.stages[currentStageIndex + 1];
        const newHistoryEntry: LoanHistoryEntry = {
          id: `hist-promote-${Date.now()}`, stageName: nextStageDef.name, timestamp: formatISO(new Date()),
          userId: currentUser.id,
          userName: currentUserName,
          notes: `Manager approved stage '${currentStageDef.name}' and promoted to '${nextStageDef.name}'. Case moved to ${nextStageDef.responsibleDepartment} department, now unassigned.`
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
        }, `${loan.customerName} moved to ${nextStageDef.name}.`);
    }
  };

  const onReturnForReworkSubmit = async (reworkNote: string, reworkAssigneeIds: string[]) => {
    if (!userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK) || !currentUser || !loan || !currentStageDef) {
        toast({title: "Cannot Return for Rework", description: "Current stage information is missing.", variant: "destructive"});
        return;
    }
    if (!reworkNote.trim()) {
      toast({ title: "Note Required", description: "Please provide reason for returning.", variant: "destructive" });
      return;
    }
    const currentUserName = currentUser.fullName || 'System Process (Manager Action)';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-rework-${Date.now()}`,
      stageName: currentStageDef.name,
      timestamp: formatISO(new Date()),
      userId: currentUser.id,
      userName: currentUserName,
      notes: `Manager returned case for rework. Reason: ${reworkNote}`
    };
    const success = await handleLocalAndUpdateService({
      isReadyForManagerReview: false,
      stageCompletedBy: [], 
      assignedToUsers: users.filter(u => reworkAssigneeIds.includes(u.id)),
      history: [...loan.history, newHistoryEntry],
    }, "Loan case returned for rework.");
    if (success) setIsReturnForReworkDialogOpen(false);
  };

  const onTerminateLoanSubmit = async (terminationReason: string) => {
    if (!userPermissions.has(PERMISSIONS.TERMINATE_LOAN_PROCESS) || !currentUser || !loan) {
      toast({ title: "Permission Denied", description: "You do not have permission to terminate this loan.", variant: "destructive" });
      return;
    }
    if (!terminationReason.trim()) {
      toast({ title: "Reason Required", description: "A reason for termination is mandatory.", variant: "destructive" });
      return;
    }

    const currentUserName = currentUser.fullName || 'System Process';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-terminate-${Date.now()}`,
      stageName: currentStageDef?.name || loan.currentStageName || 'N/A',
      timestamp: formatISO(new Date()),
      userId: currentUser.id,
      userName: currentUserName,
      notes: `Loan process terminated by higher authority. Reason: ${terminationReason}`,
    };

    const success = await handleLocalAndUpdateService({
      isTerminalStage: true,
      isReadyForManagerReview: false,
      currentStageStatus: "Terminated",
      history: [...loan.history, newHistoryEntry],
    }, "Loan process has been terminated.");

    if (success) {
      setIsTerminateLoanDialogOpen(false);
    }
  };

  const onManualTransitionSubmit = async (newWorkflowVersionId: string, newStageId: string, reason: string) => {
    if (!userPermissions.has(PERMISSIONS.MANUAL_STAGE_TRANSITION) || !currentUser || !loan) {
        toast({ title: "Permission Denied", variant: "destructive" });
        return;
    }

    const allVersions = workflowDefinitions.flatMap(def => def.versions);
    const newVersion = allVersions.find(v => v.id === newWorkflowVersionId);
    if (!newVersion) {
        toast({ title: "Error", description: "Selected workflow version not found.", variant: "destructive" });
        return;
    }
    const newStage = newVersion.stages.find(s => s.id === newStageId);
    if (!newStage) {
        toast({ title: "Error", description: "Selected stage not found in the chosen workflow.", variant: "destructive" });
        return;
    }

    const currentUserName = currentUser.fullName || 'System Process';
    const fromStageName = currentStageDef?.name || 'Unknown Stage';
    const newHistoryEntry: LoanHistoryEntry = {
        id: `hist-manual-transition-${Date.now()}`,
        stageName: newStage.name,
        timestamp: formatISO(new Date()),
        userId: currentUser.id,
        userName: currentUserName,
        notes: `MANUAL TRANSITION: Moved from '${fromStageName}' to '${newStage.name}' in workflow '${newVersion.workflowDefinitionId}'. Reason: ${reason}`,
    };

    const success = await handleLocalAndUpdateService({
        workflowVersionId: newWorkflowVersionId,
        currentStageId: newStageId,
        assignedDepartmentId: users.find(u => u.department === newStage.responsibleDepartment)?.departmentId,
        assignedToUsers: [],
        stageCompletedBy: [],
        isReadyForManagerReview: false,
        history: [...loan.history, newHistoryEntry],
        stageDeadline: formatISO(addDays(new Date(), newStage.defaultTimelineDays)),
    }, `Loan manually transitioned to ${newStage.name}.`);

    if (success) {
        setIsManualTransitionDialogOpen(false);
    }
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
        status: LoanDocumentStatus.SUBMITTED,
        notes: `File uploaded: ${originalUploadedFileName}.`,
        uploadedAt: timestamp,
        filePath: uploadedFilePath,
    };

    if (existingDocIndex > -1) {
        updatedDocuments = loan.documents.map((doc, index) =>
            index === existingDocIndex ? { ...newDocData, id: doc.id } : doc 
        );
    } else {
        updatedDocuments = [...loan.documents, newDocData];
    }

    const success = await handleLocalAndUpdateService({ documents: updatedDocuments }, `Document for '${requirement.name}' uploaded.`);
    if (success) setIsUploadDocDialogOpen(false);
  };
  
  const handleVerifyDocument = async (docId: string) => {
    if (!loan || !userPermissions.has(PERMISSIONS.VERIFY_LOAN_DOCUMENTS)) return;
    
    const updatedDocuments = loan.documents.map(doc =>
      doc.id === docId ? { ...doc, status: LoanDocumentStatus.VERIFIED, notes: (doc.notes || '') + `\nManually verified by ${currentUser?.fullName} on ${new Date().toLocaleDateString()}` } : doc
    );
    
    const docName = loan.documents.find(d => d.id === docId)?.name || 'Unknown';

    await handleLocalAndUpdateService({ documents: updatedDocuments }, `Document "${docName}" marked as Verified.`);
  };

  const handleCheckboxRequirementChange = async (
    requirement: DocumentRequirement,
    isChecked: boolean
  ) => {
    if (!loan || !currentUser) return;
  
    let updatedDocuments = [...loan.documents];
    const existingDocIndex = updatedDocuments.findIndex(
      (d) => d.requirementId === requirement.id
    );
  
    if (isChecked) {
      if (existingDocIndex === -1) {
        const newDoc: LoanDocument = {
          id: `doc-chk-${Date.now()}`,
          requirementId: requirement.id,
          name: requirement.name,
          status: LoanDocumentStatus.VERIFIED, // Checkboxes are instantly verified
          notes: `Confirmed by ${
            currentUser.fullName
          } on ${new Date().toLocaleDateString()}.`,
          uploadedAt: new Date().toISOString(),
        };
        updatedDocuments.push(newDoc);
      }
    } else {
      if (existingDocIndex > -1) {
        updatedDocuments.splice(existingDocIndex, 1);
      }
    }
  
    await handleLocalAndUpdateService(
      { documents: updatedDocuments },
      `Requirement '${requirement.name}' status updated.`
    );
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
        notes: `Stage status changed from "${loan.currentStageStatus || 'None'}" to "${newStatus}".`,
    };
    
    await handleLocalAndUpdateService({ 
      currentStageStatus: newStatus,
      history: [...loan.history, newHistoryEntry] 
    }, `Status updated to "${newStatus}".`);
  };

  const handleUrgencyChange = async (isUrgent: boolean) => {
    if (!loan || !userPermissions.has(PERMISSIONS.FLAG_URGENT_CASE)) return;

    const success = await handleLocalAndUpdateService(
      { isUrgent },
      `Loan marked as ${isUrgent ? 'urgent' : 'not urgent'}.`
    );
  };
  
  if (isLoading && !loan) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading loan details...</p>
      </div>
    );
  }

  if (!loan && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Loan Not Found</h1>
        <p className="text-muted-foreground mb-6">{error || `The loan request with ID "${loanId}" could not be found or loaded.`}</p>
        <button onClick={() => router.push('/loan-process')} className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90">
          Go Back to Loan Pipeline
        </button>
      </div>
    );
  }


  if (!loan) { 
    return (
        <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
            <AlertCircle className="h-8 w-8 text-destructive mr-2" />
            <p className="text-lg text-destructive">Critical Error: Loan data is unexpectedly null.</p>
        </div>
    );
  }

  const isActionable = !loan.isTerminalStage;
  let progressPercentage = 0;
  if (currentWorkflowVersion && loan?.currentStageId) {
      const currentStageIndexInWorkflow = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
      if (currentStageIndexInWorkflow > -1 && currentWorkflowVersion.stages.length > 0) {
          progressPercentage = currentWorkflowVersion.stages
              .slice(0, currentStageIndexInWorkflow)
              .reduce((sum, stage) => sum + (Number(stage.percentageWeight) || 0), 0);
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
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle>
              <CardDescription>Loan: {loan.loanNumber}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
                <Badge className={`px-3 py-1.5 text-sm font-medium`}>
                  Stage: {currentStageDef?.name || loan.currentStageName || 'Unknown Stage'}
                </Badge>
                {availableStatuses.length > 0 && isActionable ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select value={loan.currentStageStatus || ''} onValueChange={handleStatusChange} disabled={isSaving}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Set Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStatuses.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  loan.currentStageStatus && <Badge variant="secondary">{loan.currentStageStatus}</Badge>
                )}
                 <Badge variant="outline" className="text-sm">Dept: {loanCurrentDept || 'N/A'}</Badge>
                {loan.isUrgent && (
                    <Badge variant="destructive" className="bg-red-500 text-white">
                        <Flame className="mr-1 h-3 w-3"/> Urgent
                    </Badge>
                )}
                {loan.isReadyForManagerReview && isActionable && (
                    <Badge variant="outline" className="text-orange-600 border-orange-500 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300">
                        Awaiting Manager Review
                    </Badge>
                )}
                {loan.isTerminalStage && (
                     <Badge variant="destructive" className="text-base py-1.5 px-3 h-auto">
                        <span className="font-semibold">Terminated:</span>&nbsp;<span className="font-normal">{terminationReason}</span>
                     </Badge>
                )}
            </div>
          </div>
           {userPermissions.has(PERMISSIONS.FLAG_URGENT_CASE) && isActionable && (
              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  id="urgent-switch"
                  checked={loan.isUrgent}
                  onCheckedChange={handleUrgencyChange}
                  disabled={isSaving}
                />
                <Label htmlFor="urgent-switch" className="text-red-600 font-semibold">
                  Mark as Urgent
                </Label>
              </div>
            )}
        </CardHeader>
        <CardContent className="p-6">
          {error && error.toLowerCase().includes("workflow") && !isLoading && (
            <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitleShadCN>Workflow Configuration Issue</AlertTitleShadCN>
                <AlertDescriptionShadCN>{error}</AlertDescriptionShadCN>
            </Alert>
          )}

          {latestReworkNote && (
            <Alert variant="destructive" className="mb-6 bg-amber-50 border-amber-400 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600 [&>svg]:text-amber-600">
              <MessageSquareWarning className="h-5 w-5" />
              <AlertTitleShadCN>Returned for Rework by {latestReworkNote.userName} on {format(parseISO(latestReworkNote.timestamp), 'MMM dd, yyyy')}</AlertTitleShadCN>
              <AlertDescriptionShadCN className="font-medium whitespace-pre-wrap">
                {latestReworkNote.notes?.replace("Manager returned case for rework. Reason: ", "")}
              </AlertDescriptionShadCN>
            </Alert>
          )}

          <LoanProgressDisplay loan={loan} progressPercentage={progressPercentage} currentStageName={currentStageDef?.name || loan.currentStageName || 'Unknown Stage'}/>
          <LoanInfoDisplay loan={loan} assignedUsers={loan.assignedToUsers} assignedDepartment={loanCurrentDept} />
          <Separator className="my-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <LoanDocumentsManager
              loan={loan}
              currentStageDef={currentStageDef}
              onOpenUploadDialog={userPermissions.has(PERMISSIONS.UPLOAD_LOAN_DOCUMENTS) && isActionable ? (docReq) => { setCurrentDocumentRequirementToUpload(docReq); setIsUploadDocDialogOpen(true); } : undefined}
              onVerifyDocument={userPermissions.has(PERMISSIONS.VERIFY_LOAN_DOCUMENTS) && isActionable ? handleVerifyDocument : undefined}
              onCheckboxChange={handleCheckboxRequirementChange}
              isSavingGlobal={isSaving}
            />
            <LoanHistoryTimeline
              loan={loan}
              onFulfillInfoRequest={userPermissions.has(PERMISSIONS.FULFILL_INFO_REQUEST) && isActionable ? handleFulfillInfoRequest : undefined}
              isSavingGlobal={isSaving}
            />
          </div>
        </CardContent>
         <CardFooter className="p-6 border-t">
            <p className="text-xs text-muted-foreground">
                Last Updated: {loan.lastUpdatedDate ? format(parseISO(loan.lastUpdatedDate), 'PPpp') : 'N/A'}
            </p>
        </CardFooter>
      </Card>

      {(userPermissions.has(PERMISSIONS.EDIT_LOAN_DETAILS) || userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)) && <EditLoanDetailsDialog isOpen={isEditLoanDialogOpen} onOpenChange={setIsEditLoanDialogOpen} loan={loan} users={usersForDialog} currentDepartment={loanCurrentDept} onSubmit={onEditLoanSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.ADD_LOAN_NOTES) && <AddNoteToLoanDialog isOpen={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen} onSubmit={onAddNoteSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.LOG_INFO_REQUEST) && <LogInfoRequestForLoanDialog isOpen={isLogInfoDialogOpen} onOpenChange={setIsLogInfoDialogOpen} onSubmit={onLogInfoRequestSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.UPLOAD_LOAN_DOCUMENTS) && <UploadLoanDocumentDialog isOpen={isUploadDocDialogOpen} onOpenChange={(isOpen) => { setIsUploadDocDialogOpen(isOpen); if (!isOpen) setCurrentDocumentRequirementToUpload(null);}} loanId={loan.id} documentRequirement={currentDocumentRequirementToUpload} onSubmitAfterUpload={handleDocumentUploaded} isParentSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK) && <ReturnLoanForReworkDialog isOpen={isReturnForReworkDialogOpen} onOpenChange={setIsReturnForReworkDialogOpen} loan={loan} users={usersForDialog} currentDepartment={loanCurrentDept} onSubmit={onReturnForReworkSubmit} isSaving={isSaving} />}
      {userPermissions.has(PERMISSIONS.TERMINATE_LOAN_PROCESS) && <TerminateLoanDialog isOpen={isTerminateLoanDialogOpen} onOpenChange={setIsTerminateLoanDialogOpen} loan={loan} onSubmit={onTerminateLoanSubmit} isSaving={isSaving} />}
      
      {userPermissions.has(PERMISSIONS.MANUAL_STAGE_TRANSITION) && (
        <ManualTransitionDialog
          isOpen={isManualTransitionDialogOpen}
          onOpenChange={setIsManualTransitionDialogOpen}
          currentLoan={loan}
          workflowDefinitions={workflowDefinitions}
          onSubmit={onManualTransitionSubmit}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
