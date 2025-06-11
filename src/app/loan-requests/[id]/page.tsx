
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import type { LoanRequest, LoanDocument, LoanHistoryEntry, User as UserType, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { UserRole } from '@/types/loan'; 
// import { mockUsers } from '@/lib/mock-data'; // Removed direct import of mockUsers
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getLoanRequestById, updateLoanRequest, getWorkflowDefinitions } from '@/services/loan-service-prisma';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context'; 

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


export default function LoanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const loanId = params.id as string;
  const { user: currentUser } = useAuth(); 

  const [loan, setLoan] = useState<LoanRequest | null>(null);
  const [users, setUsers] = useState<UserType[]>([]); // Initialize with empty array
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

  const isViewOnlyUser = currentUser?.role === UserRole.VIEW_ONLY;
  
  const currentWorkflowVersion = useMemo(() => {
    if (!loan || !workflowDefinitions || !loan.workflowDefinitionId || !loan.workflowVersionId) return null;
    const definition = workflowDefinitions.find(def => def.id === loan.workflowDefinitionId);
    return definition?.versions.find(v => v.id === loan.workflowVersionId) || null;
  }, [loan, workflowDefinitions]);

  const currentStageDef = useMemo(() => {
    if (!loan || !currentWorkflowVersion || !loan.currentStageId) return null;
    return currentWorkflowVersion.stages.find(s => s.id === loan.currentStageId) || null;
  }, [loan, currentWorkflowVersion]);

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
        setError(prev => prev ? `${prev}\nLoan: ${loanResult.error}` : `Loan: ${loanResult.error}`);
        setLoan(null);
      } else if (loanResult.loan) {
        setLoan(loanResult.loan);
        setUsers(loanResult.users || []); // Use users from service, or empty array
      } else {
        setError(prev => prev ? `${prev}\nLoan: Loan request with ID "${loanId}" not found.` : `Loan: Loan request with ID "${loanId}" not found.`);
        setLoan(null);
      }

      if (wfResult.error) {
        setError(prev => prev ? `${prev}\nWorkflows: ${wfResult.error}` : `Workflows: ${wfResult.error}`);
      } else if (wfResult.workflows) {
        setWorkflowDefinitions(wfResult.workflows);
      } else {
         setError(prev => prev ? `${prev}\nWorkflows: No workflow data received.` : `Workflows: No workflow data received.`);
      }

    } catch (err: any) {
      const errorMessage = err.message || "An unexpected error occurred while fetching page data.";
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
    if (isViewOnlyUser) {
      toast({ title: "Permission Denied", description: "View-only users cannot make changes.", variant: "destructive" });
      return false;
    }
    if (!loan) return false;
    setIsSaving(true);
    
    const newLoanState: LoanRequest = {
      ...loan,
      ...updatedFields,
      history: updatedFields.history ? [...updatedFields.history] : [...loan.history],
      documents: updatedFields.documents ? [...updatedFields.documents] : [...loan.documents],
      lastUpdatedDate: formatISO(new Date()),
    };
    setLoan(newLoanState);

    try {
      const serviceResult = await updateLoanRequest(loan.id, newLoanState);
      if (serviceResult.error || !serviceResult.success) {
        toast({ title: "Update Error", description: serviceResult.error || "Failed to update loan in service.", variant: "destructive" });
        await fetchLoanData(); 
        return false;
      }
      toast({ title: "Update Successful", description: successMessage, variant: "default" });
      if(serviceResult.updatedLoan) setLoan(serviceResult.updatedLoan);
      return true;
    } catch (err: any) {
      toast({ title: "System Error", description: err.message || "A critical error occurred.", variant: "destructive" });
      await fetchLoanData();
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [loan, toast, fetchLoanData, isViewOnlyUser]);


  const onEditLoanSubmit = async (data: any) => { 
    if (!loan || isViewOnlyUser) return;
    const finalAssignedTo = data.assignedTo === UNASSIGNED_DIALOG_OPTION_VALUE ? undefined : data.assignedTo;
    
    let historyUpdate: LoanHistoryEntry[] = [...loan.history];
    if (finalAssignedTo !== loan.assignedTo) {
        const assignedUserName = finalAssignedTo ? users.find(u=>u.id === finalAssignedTo)?.name : 'Unassigned';
        const currentUserName = currentUser?.fullName || currentUser?.name || 'System Process';
        historyUpdate.push({
            id: `hist-assign-${Date.now()}`,
            stageName: currentStageDef?.name || loan.currentStageName || 'Current Stage',
            timestamp: formatISO(new Date()),
            userId: currentUser?.id || 'system-prisma', 
            userName: currentUserName,
            notes: `Case assignment changed. Now assigned to ${assignedUserName || 'Unassigned'} within ${loan.assignedDepartment || 'N/A'} department by ${currentUserName}.`
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
      history: historyUpdate,
    }, "Loan details updated.");
    if (success) setIsEditLoanDialogOpen(false);
  };

  const onAddNoteSubmit = async (noteContent: string) => {
    if (isViewOnlyUser) return;
    if (!noteContent.trim() || !loan) {
      toast({ title: "Note Required", description: "Please enter content for the note.", variant: "destructive" });
      return;
    }
    const stageNameToLog = currentStageDef?.name || loan.currentStageName || 'Current Stage';
    const currentUserName = currentUser?.fullName || currentUser?.name || 'System Process';
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
    if (isViewOnlyUser) return;
    if (!infoToRequest.trim() || !loan) {
      toast({ title: "Info Required", description: "Please specify information needed.", variant: "destructive" });
      return;
    }
    const stageNameToLog = currentStageDef?.name || loan.currentStageName || 'Current Stage';
    const currentUserName = currentUser?.fullName || currentUser?.name || 'System Process';
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
    if (!loan || isViewOnlyUser) return;
    const stageNameToLog = currentStageDef?.name || loan.currentStageName || 'Current Stage';
    const currentUserName = currentUser?.fullName || currentUser?.name || 'User';
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
    if (isViewOnlyUser) return false;
    if (!loan || !currentStageDef || !currentWorkflowVersion) {
        if (!currentStageDef) toast({title: "Workflow Info Missing", description: "Cannot validate requirements as current stage definition is missing.", variant: "warning", duration: 5000});
        return false;
    }
    
    const activeInfoReq = [...loan.history].reverse().find(entry => entry.requiredFulfilment && (!entry.notes || !entry.notes.includes("[FULFILLED MOCK]")));
    if (activeInfoReq) {
      toast({ title: "Action Pending", description: `Outstanding action: '${activeInfoReq.requiredFulfilment}' must be resolved.`, variant: "destructive", duration: 7000 });
      return false;
    }

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
  }, [loan, currentStageDef, currentWorkflowVersion, toast, isViewOnlyUser]);

  const handleMarkStageComplete = async () => { 
    if (isViewOnlyUser || !loan || !currentStageDef || !validateCurrentStageRequirements() || !currentUser) return;
    
    const actingUserId = loan.assignedTo || currentUser.id;
    const actingUserName = loan.assignedTo ? (users.find(u=>u.id === loan.assignedTo)?.name || currentUser.name || 'Assigned Officer') : (currentUser.fullName || currentUser.name || 'System Process');

    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-officercomplete-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: actingUserId, 
      userName: actingUserName,
      notes: `Staff marked stage '${currentStageDef.name}' complete. Submitted for manager review in ${loan.assignedDepartment} department.`,
    };
    await handleLocalAndUpdateService({ isReadyForManagerReview: true, history: [...loan.history, newHistoryEntry] }, `Loan submitted for manager review.`);
  };

  const handleManagerPromoteLoan = async () => { 
    if (isViewOnlyUser || !currentUser || !loan || !currentWorkflowVersion || !currentStageDef || !validateCurrentStageRequirements()) return;
    
    const currentStageIndex = currentWorkflowVersion.stages.findIndex(s => s.id === loan.currentStageId);
    if (currentStageIndex === -1 || currentStageIndex === currentWorkflowVersion.stages.length - 1) {
      toast({ title: "Workflow End", description: "This is the last stage in the workflow. Consider closing or finalizing the loan.", variant: "info" });
      if (currentStageIndex === currentWorkflowVersion.stages.length -1) {
          const currentUserName = currentUser.fullName || currentUser.name || 'System Process';
          const terminalNote = `Loan has reached the final configured stage: '${currentStageDef.name}'. Further action may be manual or via specific stage logic.`;
          const finalHistory: LoanHistoryEntry = {
            id: `hist-final-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
            userId: currentUser.id,
            userName: currentUserName, 
            notes: terminalNote,
          };
           await handleLocalAndUpdateService({ history: [...loan.history, finalHistory], isReadyForManagerReview: false }, "Loan reached final workflow stage.");
      }
      return;
    }

    const nextStageDef = currentWorkflowVersion.stages[currentStageIndex + 1];
    const currentUserName = currentUser.fullName || currentUser.name || 'System Process';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-promote-${Date.now()}`, stageName: nextStageDef.name, timestamp: formatISO(new Date()),
      userId: currentUser.id, 
      userName: currentUserName,
      notes: `Manager approved stage '${currentStageDef.name}' and promoted to '${nextStageDef.name}'. Case moved to ${nextStageDef.responsibleDepartment} department, now unassigned.`
    };

    await handleLocalAndUpdateService({
      currentStageId: nextStageDef.id,
      assignedDepartment: nextStageDef.responsibleDepartment,
      assignedTo: undefined, 
      history: [...loan.history, newHistoryEntry],
      isReadyForManagerReview: false,
      stageDeadline: formatISO(addDays(new Date(), nextStageDef.defaultTimelineDays)),
      workflowDefinitionId: loan.workflowDefinitionId, 
      workflowVersionId: loan.workflowVersionId,     
    }, `${loan.customerName} moved to ${nextStageDef.name}.`);
  };

  const onReturnForReworkSubmit = async (reworkNote: string, reworkAssigneeId?: string) => {
    if (isViewOnlyUser || !currentUser || !loan || !currentStageDef) {
        toast({title: "Cannot Return for Rework", description: "Current stage information is missing.", variant: "destructive"});
        return;
    }
    if (!reworkNote.trim()) {
      toast({ title: "Note Required", description: "Please provide reason for returning.", variant: "destructive" });
      return;
    }
    const currentUserName = currentUser.fullName || currentUser.name || 'System Process (Manager Action)';
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-rework-${Date.now()}`, stageName: currentStageDef.name, timestamp: formatISO(new Date()),
      userId: currentUser.id, 
      userName: currentUserName,
      notes: `Manager returned case for rework in stage '${currentStageDef.name}'. Reason: ${reworkNote}`
    };
    const success = await handleLocalAndUpdateService({
      isReadyForManagerReview: false, 
      assignedTo: reworkAssigneeId === UNASSIGNED_DIALOG_OPTION_VALUE ? undefined : reworkAssigneeId,
      history: [...loan.history, newHistoryEntry],
    }, "Loan case returned for rework.");
    if (success) setIsReturnForReworkDialogOpen(false);
  };

  const handleUploadDocument = async (docName: string) => {
    if (!loan || isViewOnlyUser) return;
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
    if (!loan || isViewOnlyUser) return;
    const updatedDocuments = loan.documents.map(doc =>
        doc.name === docName ? { ...doc, status: 'Verified', notes: 'Document verified.' } : doc
    );
    await handleLocalAndUpdateService({ documents: updatedDocuments }, `Document ${docName} status updated to 'Verified'.`);
  };


  if (isLoading && !loan) { 
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading loan details...</p>
      </div>
    );
  }
  
  if (!loan && !isLoading && !error?.toLowerCase().includes("loan")) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Loan Not Found</h1>
        <p className="text-muted-foreground mb-6">The loan request with ID "{loanId}" could not be found or loaded.</p>
        <button onClick={() => router.push('/loan-process')} className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90">
          Go Back to Loan Pipeline
        </button>
      </div>
    );
  }
  
  if (error && error.toLowerCase().includes("loan") && !loan) { 
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
  
  if (!loan) { 
    return (
        <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
            <AlertCircle className="h-8 w-8 text-destructive mr-2" />
            <p className="text-lg text-destructive">Critical Error: Loan data is unexpectedly null after loading attempts.</p>
        </div>
    );
  }

  const assignedUser = users.find(u => u.id === loan.assignedTo);
  const isActionable = currentStageDef ? 
    !currentStageDef.name.toLowerCase().includes("closed") && 
    !currentStageDef.name.toLowerCase().includes("rejected") && 
    !currentStageDef.name.toLowerCase().includes("disbursed")
    : false;


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
        isSaving={isSaving}
        isActionableStage={isActionable && !!currentStageDef}
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
                  Stage: {currentStageDef?.name || loan.currentStageName || 'Unknown Stage'}
                </Badge>
                 <Badge variant="outline" className="text-sm">Dept: {loan.assignedDepartment || (currentStageDef?.responsibleDepartment) || 'N/A'}</Badge>
                {loan.isReadyForManagerReview && isActionable && (
                    <Badge variant="outline" className="text-orange-600 border-orange-500 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300">
                        Awaiting Manager Review
                    </Badge>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {error && error.toLowerCase().includes("workflows") && !isLoading && ( 
            <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitleShadCN>Workflow Configuration Issue</AlertTitleShadCN>
                <AlertDescriptionShadCN>{error.replace("Workflows:", "").trim()}</AlertDescriptionShadCN>
            </Alert>
          )}
          <LoanProgressDisplay loan={loan} progressPercentage={progressPercentage} currentStageName={currentStageDef?.name || loan.currentStageName || 'Unknown Stage'}/>
          <LoanInfoDisplay loan={loan} assignedUser={assignedUser} assignedDepartment={loan.assignedDepartment || (currentStageDef?.responsibleDepartment)} />
          <Separator className="my-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <LoanDocumentsManager
              loan={loan}
              currentStageDef={currentStageDef} 
              onOpenUploadDialog={isViewOnlyUser ? undefined : (docName) => { setCurrentDocumentToUpload(docName); setIsUploadDocDialogOpen(true); }}
              onVerifyDocument={isViewOnlyUser ? undefined : handleVerifyDocument}
              isSavingGlobal={isSaving}
              isViewOnly={isViewOnlyUser}
            />
            <LoanHistoryTimeline
              loan={loan}
              onFulfillInfoRequest={isViewOnlyUser ? undefined : handleFulfillInfoRequest}
              isSavingGlobal={isSaving}
              isViewOnly={isViewOnlyUser}
            />
          </div>
        </CardContent>
         <CardFooter className="p-6 border-t">
            <p className="text-xs text-muted-foreground">
                Last Updated: {loan.lastUpdatedDate ? format(parseISO(loan.lastUpdatedDate), 'PPpp') : 'N/A'}
            </p>
        </CardFooter>
      </Card>

      {!isViewOnlyUser && (
        <>
          <EditLoanDetailsDialog
            isOpen={isEditLoanDialogOpen}
            onOpenChange={setIsEditLoanDialogOpen}
            loan={loan}
            users={users.filter(u => !loan.assignedDepartment || u.department === loan.assignedDepartment || !u.department)} 
            currentDepartment={loan.assignedDepartment || (currentStageDef?.responsibleDepartment)}
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
          <ReturnLoanForReworkDialog
            isOpen={isReturnForReworkDialogOpen}
            onOpenChange={setIsReturnForReworkDialogOpen}
            loan={loan}
            users={users.filter(u => !loan.assignedDepartment || u.department === loan.assignedDepartment || !u.department)}
            currentDepartment={loan.assignedDepartment || (currentStageDef?.responsibleDepartment)}
            onSubmit={onReturnForReworkSubmit}
            isSaving={isSaving}
          />
        </>
      )}
    </div>
  );
}

    