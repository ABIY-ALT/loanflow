
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import type { LoanRequest, LoanDocument, LoanHistoryEntry, User as UserType, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
// Removed LoanStage, loanStages imports that are no longer central
import { mockUsers } from '@/lib/mock-data'; // Assuming mockWorkflowDefinitions are fetched if needed or part of loan
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLoanRequestById, updateLoanRequest } from '@/services/loan-service';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

import { LoanDetailHeader } from '@/components/loan/detail/LoanDetailHeader';
import { LoanProgressDisplay } from '@/components/loan/detail/LoanProgressDisplay';
import { LoanInfoDisplay } from '@/components/loan/detail/LoanInfoDisplay';
import { LoanDocumentsManager } from '@/components/loan/detail/LoanDocumentsManager';
import { LoanHistoryTimeline } from '@/components/loan/detail/LoanHistoryTimeline';

import { EditLoanDetailsDialog, UNASSIGNED_DIALOG_OPTION_VALUE } from '@/components/loan/dialogs/EditLoanDetailsDialog';
import { AddNoteToLoanDialog } from '@/components/loan/dialogs/AddNoteToLoanDialog';
import { LogInfoRequestForLoanDialog } from '@/components/loan/dialogs/LogInfoRequestForLoanDialog';
// PromoteLoanStageDialog might need to be removed or heavily refactored as promotion is automatic
import { ReturnLoanForReworkDialog } from '@/components/loan/dialogs/ReturnLoanForReworkDialog';
import { UploadLoanDocumentDialog } from '@/components/loan/dialogs/UploadLoanDocumentDialog';


export default function LoanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const loanId = params.id as string;

  const [loan, setLoan] = useState<LoanRequest | null>(null);
  const [users, setUsers] = useState<UserType[]>(mockUsers);
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditLoanDialogOpen, setIsEditLoanDialogOpen] = useState(false);
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [isLogInfoDialogOpen, setIsLogInfoDialogOpen] = useState(false);
  const [isUploadDocDialogOpen, setIsUploadDocDialogOpen] = useState(false);
  const [currentDocumentToUpload, setCurrentDocumentToUpload] = useState<string | null>(null);
  const [isReturnForReworkDialogOpen, setIsReturnForReworkDialogOpen] = useState(false);
  
  // --- Workflow related derived state ---
  const currentWorkflowVersion = useMemo(() => {
    if (!loan || !workflowDefinitions) return null;
    const definition = workflowDefinitions.find(def => def.id === loan.workflowDefinitionId);
    return definition?.versions.find(v => v.id === loan.workflowVersionId) || null;
  }, [loan, workflowDefinitions]);

  const currentStageDef = useMemo(() => {
    if (!loan || !currentWorkflowVersion) return null;
    return currentWorkflowVersion.stages.find(s => s.id === loan.currentStageId) || null;
  }, [loan, currentWorkflowVersion]);

  const fetchLoanData = useCallback(async () => {
    if (!loanId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLoanRequestById(loanId);
      if (result.error) {
        setError(result.error);
        setLoan(null);
      } else if (result.loan) {
        setLoan(result.loan);
        setUsers(result.users || mockUsers);
        setWorkflowDefinitions(result.workflows || []); // Assuming workflows are fetched with loan
      } else {
        setError(`Loan request with ID "${loanId}" not found.`);
        setLoan(null);
      }
    } catch (err: any) {
      const errorMessage = err.message || "An unexpected error occurred while fetching loan data.";
      setError(errorMessage);
      setLoan(null);
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
    console.log("[LoanDetailPage] Updating local component state with:", updatedFields);
    
    const newLoanState: LoanRequest = {
      ...loan,
      ...updatedFields,
      history: updatedFields.history ? [...updatedFields.history] : [...loan.history],
      documents: updatedFields.documents ? [...updatedFields.documents] : [...loan.documents],
      lastUpdatedDate: formatISO(new Date()),
    };
    setLoan(newLoanState);

    try {
      const serviceResult = await updateLoanRequest(loan.id, newLoanState); // Pass full new state
      if (serviceResult.error || !serviceResult.success) {
        toast({ title: "Update Error", description: serviceResult.error || "Failed to update loan in service.", variant: "destructive" });
        await fetchLoanData(); // Revert optimistic update
        return false;
      }
      toast({ title: "Update Successful", description: successMessage, variant: "default" });
      // If service returns updated loan, use it:
      if(serviceResult.updatedLoan) setLoan(serviceResult.updatedLoan);
      return true;
    } catch (err: any) {
      toast({ title: "System Error", description: err.message || "A critical error occurred.", variant: "destructive" });
      await fetchLoanData();
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [loan, toast, fetchLoanData]);


  const onEditLoanSubmit = async (data: any) => { // Data type from EditLoanDetailsDialog
    if (!loan || !currentStageDef) return;
    const finalAssignedTo = data.assignedTo === UNASSIGNED_DIALOG_OPTION_VALUE ? undefined : data.assignedTo;
    
    let historyUpdate: LoanHistoryEntry[] = [...loan.history];
    if (finalAssignedTo !== loan.assignedTo) {
        const assignedUserName = finalAssignedTo ? users.find(u=>u.id === finalAssignedTo)?.name : 'Unassigned';
        historyUpdate.push({
            id: `hist-assign-${Date.now()}`,
            stageName: currentStageDef.name,
            timestamp: formatISO(new Date()),
            userId: 'mock-manager-user', // Assuming manager assigns
            userName: 'Manager (Mock)',
            notes: `Case assigned to ${assignedUserName || 'Unassigned'} within ${loan.assignedDepartment} department.`
        });
    }

    const success = await handleLocalAndUpdateService({
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      loanAmount: Number(data.loanAmount),
      loanType: data.loanType,
      loanPurpose: data.loanPurpose,
      assignedTo: finalAssignedTo,
      // assignedDepartment is set by stage, not directly editable here unless specific logic added
      history: historyUpdate,
    }, "Loan details updated.");
    if (success) setIsEditLoanDialogOpen(false);
  };

  const onAddNoteSubmit = async (noteContent: string) => {
    if (!noteContent.trim() || !loan || !currentStageDef) {
      toast({ title: "Note Required", description: "Please enter content for the note.", variant: "destructive" });
      return;
    }
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: 'mock-user-id', userName: 'Mock Bank User', notes: noteContent,
    };
    const success = await handleLocalAndUpdateService({ history: [...loan.history, newHistoryEntry] }, "Note added.");
    if (success) setIsAddNoteDialogOpen(false);
  };

  const onLogInfoRequestSubmit = async (infoToRequest: string) => {
    if (!infoToRequest.trim() || !loan || !currentStageDef) {
      toast({ title: "Info Required", description: "Please specify information needed.", variant: "destructive" });
      return;
    }
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: 'mock-user-id', userName: 'Mock Bank User', notes: `Logged information request: ${infoToRequest}`,
      requiredFulfilment: infoToRequest,
    };
    const success = await handleLocalAndUpdateService({ history: [...loan.history, newHistoryEntry] }, "Information request logged.");
    if (success) setIsLogInfoDialogOpen(false);
  };
  
  const handleFulfillInfoRequest = async (entryId: string, requirementText: string) => {
    if (!loan || !currentStageDef) return;
    const updatedHistory = loan.history.map(h =>
        h.id === entryId ? { ...h, notes: `${h.notes || ''}\n[FULFILLED MOCK] by customer on ${new Date().toLocaleDateString()}. Requirement: ${requirementText}` } : h
    );
    updatedHistory.push({
        id: `hist-mock-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
        userId: 'mock-user-id', userName: 'Mock Bank User',
        notes: `Information received for requirement: "${requirementText}". Ready for re-evaluation.`
    });
    await handleLocalAndUpdateService({ history: updatedHistory }, "Information fulfillment status updated.");
  };

  const validateCurrentStageRequirements = useCallback((): boolean => {
    if (!loan || !currentStageDef || !currentWorkflowVersion) return false;
    
    // Check for active information requests
    const activeInfoReq = [...loan.history].reverse().find(entry => entry.requiredFulfilment && (!entry.notes || !entry.notes.includes("[FULFILLED MOCK]")));
    if (activeInfoReq) {
      toast({ title: "Action Pending", description: `Outstanding action: '${activeInfoReq.requiredFulfilment}' must be resolved.`, variant: "destructive", duration: 7000 });
      return false;
    }

    // Check for required documents for the current stage definition
    if (currentStageDef.requiredDocumentNames.length > 0) {
      const pendingDocs = currentStageDef.requiredDocumentNames.filter(reqDocName => {
        const uploadedDoc = loan.documents.find(d => d.name === reqDocName);
        return !uploadedDoc || uploadedDoc.status !== 'Verified';
      });
      if (pendingDocs.length > 0) {
        toast({ title: "Documents Pending", description: `Cannot proceed. Docs for stage '${currentStageDef.name}' must be verified: ${pendingDocs.join(', ')}.`, variant: "destructive", duration: 7000 });
        return false;
      }
    }
    return true;
  }, [loan, currentStageDef, currentWorkflowVersion, toast]);

  const handleMarkStageComplete = async () => { // Officer action
    if (!loan || !currentStageDef || !validateCurrentStageRequirements()) return;
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-officer-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: loan.assignedTo || 'mock-officer-user', userName: users.find(u=>u.id === loan.assignedTo)?.name || 'Officer (Mock)',
      notes: `Staff marked stage '${currentStageDef.name}' complete. Submitted for manager review in ${loan.assignedDepartment} department.`,
    };
    await handleLocalAndUpdateService({ isReadyForManagerReview: true, history: [...loan.history, newHistoryEntry] }, `Loan submitted for manager review.`);
  };

  const handleManagerPromoteLoan = async () => { // Manager action
    if (!loan || !currentWorkflowVersion || !currentStageDef || !validateCurrentStageRequirements()) return;
    
    const currentStageIndex = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
    if (currentStageIndex === -1 || currentStageIndex === currentWorkflowVersion.stages.length - 1) {
      toast({ title: "Workflow End", description: "This is the last stage in the workflow. Consider closing or finalizing the loan.", variant: "info" });
      // Potentially handle loan closure here if it's the final stage
      // For now, we just prevent promotion beyond the last stage.
      // One could also add a "isTerminal" flag to WorkflowStageDefinition.
      // If it's the actual last stage, we might want to mark it as "Approved" or "Funds Disbursed"
      // For this example, we'll assume such stages are explicitly part of the workflow.
      
      // If current stage IS the last one for this workflow version
      if (currentStageIndex === currentWorkflowVersion.stages.length -1) {
          const terminalNote = `Loan has reached the final configured stage: '${currentStageDef.name}'. Further action (e.g. disbursement) may be manual or via specific stage logic.`;
          const finalHistory: LoanHistoryEntry = {
            id: `hist-final-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
            userId: 'mock-manager-user', userName: 'Manager (Mock)', notes: terminalNote,
          };
           await handleLocalAndUpdateService({ history: [...loan.history, finalHistory], isReadyForManagerReview: false }, "Loan reached final workflow stage.");
           return;
      } else { // Should not happen if check above is correct
          toast({ title: "Workflow Error", description: "Cannot determine next stage.", variant: "destructive" });
          return;
      }
    }

    const nextStageDef = currentWorkflowVersion.stages[currentStageIndex + 1];
    
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-promote-${Date.now()}`, stageName: nextStageDef.name, timestamp: formatISO(new Date()),
      userId: 'mock-manager-user', userName: 'Manager (Mock)', // TODO: Get actual manager user
      notes: `Manager approved stage '${currentStageDef.name}' and promoted to '${nextStageDef.name}'. Case moved to ${nextStageDef.responsibleDepartment} department, now unassigned.`
    };

    const success = await handleLocalAndUpdateService({
      currentStageId: nextStageDef.id,
      assignedDepartment: nextStageDef.responsibleDepartment,
      assignedTo: undefined, // Unassign user for the new department/stage
      history: [...loan.history, newHistoryEntry],
      isReadyForManagerReview: false,
      stageDeadline: formatISO(addDays(new Date(), nextStageDef.defaultTimelineDays)),
    }, `${loan.customerName} moved to ${nextStageDef.name}.`);
    
    // Note: PromoteLoanStageDialog is not used as selection is automatic.
  };

  const onReturnForReworkSubmit = async (reworkNote: string, reworkAssigneeId?: string) => {
    if (!loan || !currentStageDef) return;
    if (!reworkNote.trim()) {
      toast({ title: "Note Required", description: "Please provide reason for returning.", variant: "destructive" });
      return;
    }
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-rework-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: 'mock-manager-user', userName: 'Manager (Mock)',
      notes: `Manager returned case for rework in stage '${currentStageDef.name}'. Reason: ${reworkNote}`
    };
    const success = await handleLocalAndUpdateService({
      isReadyForManagerReview: false, 
      assignedTo: reworkAssigneeId === UNASSIGNED_DIALOG_OPTION_VALUE ? undefined : reworkAssigneeId, // Keep or change assignee
      history: [...loan.history, newHistoryEntry],
    }, "Loan case returned for rework.");
    if (success) setIsReturnForReworkDialogOpen(false);
  };

  const handleUploadDocument = async (docName: string) => {
    if (!loan) return;
    const existingDocIndex = loan.documents.findIndex(d => d.name === docName);
    let updatedDocuments: LoanDocument[];
    const timestamp = formatISO(new Date());
    if (existingDocIndex > -1) {
        updatedDocuments = loan.documents.map((doc, index) =>
            index === existingDocIndex ? { ...doc, status: 'Submitted', notes: 'File re-uploaded.', uploadedAt: timestamp } : doc
        );
    } else {
        updatedDocuments = [
            ...loan.documents,
            { id: `doc-mock-${Date.now()}`, name: docName, status: 'Submitted', notes: 'File uploaded.', uploadedAt: timestamp }
        ];
    }
    const success = await handleLocalAndUpdateService({ documents: updatedDocuments }, `Document ${docName} status updated to 'Submitted'.`);
    if (success) setIsUploadDocDialogOpen(false);
  };

  const handleVerifyDocument = async (docName: string) => {
    if (!loan) return;
    const updatedDocuments = loan.documents.map(doc =>
        doc.name === docName ? { ...doc, status: 'Verified', notes: 'Document verified.' } : doc
    );
    await handleLocalAndUpdateService({ documents: updatedDocuments }, `Document ${docName} status updated to 'Verified'.`);
  };


  if (isLoading && !loan) { /* ... loading UI ... */ 
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading loan details...</p>
      </div>
    );
  }
  if (error && !loan) { /* ... error UI ... */ 
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Error Loading Loan</h1>
        <p className="text-muted-foreground mb-6 break-words whitespace-pre-wrap">{error}</p>
        <button onClick={() => router.push('/loan-process')} className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90">
          Go Back to Loan Pipeline
        </button>
      </div>
    );
  }
  if (!loan || !currentStageDef || !currentWorkflowVersion) { /* ... not found or data incomplete UI ... */ 
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <p className="text-lg text-muted-foreground">Loan data or workflow configuration is incomplete.</p>
      </div>
    );
  }

  const assignedUser = users.find(u => u.id === loan.assignedTo);
  const isActionable = !currentStageDef.name.toLowerCase().includes("closed") && !currentStageDef.name.toLowerCase().includes("rejected") && !currentStageDef.name.toLowerCase().includes("disbursed");


  let progressPercentage = 0;
  const currentStageIndexInWorkflow = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
  if (currentStageIndexInWorkflow !== -1) {
      progressPercentage = currentWorkflowVersion.stages
          .slice(0, currentStageIndexInWorkflow + 1)
          .reduce((sum, stage) => sum + (stage.percentageWeight || 0), 0);
  }
  progressPercentage = Math.min(100, Math.max(0, progressPercentage));


  return (
    <div className="space-y-6">
      <LoanDetailHeader
        loan={loan}
        currentStageName={currentStageDef.name} // Pass current stage name
        onBack={() => router.back()}
        onOpenEditDialog={() => setIsEditLoanDialogOpen(true)}
        onOpenAddNoteDialog={() => setIsAddNoteDialogOpen(true)}
        onOpenLogInfoDialog={() => setIsLogInfoDialogOpen(true)}
        onMarkStageComplete={handleMarkStageComplete}
        onManagerPromoteLoan={handleManagerPromoteLoan} // Renamed
        onOpenReturnForReworkDialog={() => setIsReturnForReworkDialogOpen(true)}
        isSaving={isSaving}
        isActionableStage={isActionable}
      />

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle>
              <CardDescription>Loan: {loan.loanNumber} | Customer: {loan.customerNumber}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
                <Badge className={`px-3 py-1.5 text-sm font-medium`}> 
                  Stage: {currentStageDef.name}
                </Badge>
                 <Badge variant="outline" className="text-sm">Dept: {loan.assignedDepartment || 'N/A'}</Badge>
                {loan.isReadyForManagerReview && isActionable && (
                    <Badge variant="outline" className="text-orange-600 border-orange-500 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300">
                        Awaiting Manager Review
                    </Badge>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <LoanProgressDisplay loan={loan} progressPercentage={progressPercentage} currentStageName={currentStageDef.name}/>
          <LoanInfoDisplay loan={loan} assignedUser={assignedUser} assignedDepartment={loan.assignedDepartment} />
          <Separator className="my-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <LoanDocumentsManager
              loan={loan}
              currentStageDef={currentStageDef}
              onOpenUploadDialog={(docName) => { setCurrentDocumentToUpload(docName); setIsUploadDocDialogOpen(true); }}
              onVerifyDocument={handleVerifyDocument}
              isSavingGlobal={isSaving}
            />
            <LoanHistoryTimeline
              loan={loan}
              onFulfillInfoRequest={handleFulfillInfoRequest}
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

      <EditLoanDetailsDialog
        isOpen={isEditLoanDialogOpen}
        onOpenChange={setIsEditLoanDialogOpen}
        loan={loan}
        users={users.filter(u => !loan.assignedDepartment || u.department === loan.assignedDepartment)} // Filter users by current department
        currentDepartment={loan.assignedDepartment}
        onSubmit={onEditLoanSubmit}
        isSaving={isSaving}
      />
      <AddNoteToLoanDialog
        isOpen={isAddNoteDialogOpen}
        onOpenChange={setIsAddNoteDialogOpen}
        onSubmit={onAddNoteSubmit}
        isSaving={isSaving}
      />
      <LogInfoRequestForLoanDialog
        isOpen={isLogInfoDialogOpen}
        onOpenChange={setIsLogInfoDialogOpen}
        onSubmit={onLogInfoRequestSubmit}
        isSaving={isSaving}
      />
      <UploadLoanDocumentDialog
        isOpen={isUploadDocDialogOpen}
        onOpenChange={(isOpen) => { setIsUploadDocDialogOpen(isOpen); if (!isOpen) setCurrentDocumentToUpload(null);}}
        documentName={currentDocumentToUpload}
        onSubmit={handleUploadDocument}
        isSaving={isSaving}
      />
      {/* PromoteLoanStageDialog is removed as promotion is automatic */}
      <ReturnLoanForReworkDialog
        isOpen={isReturnForReworkDialogOpen}
        onOpenChange={setIsReturnForReworkDialogOpen}
        loan={loan}
        users={users.filter(u => !loan.assignedDepartment || u.department === loan.assignedDepartment)} // Filter users by current department
        currentDepartment={loan.assignedDepartment}
        onSubmit={onReturnForReworkSubmit}
        isSaving={isSaving}
      />
    </div>
  );
}
