
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, formatISO } from 'date-fns';
import type { LoanRequest, LoanDocument, LoanHistoryEntry, User as UserType } from '@/types/loan';
import { LoanStage, UserRole, loanStages } from '@/types/loan';
import { mockUsers } from '@/lib/mock-data'; 
import { initialStageConfigs } from '@/app/settings/page';
import React, { useState, useEffect, useCallback } from 'react';
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
import { PromoteLoanStageDialog } from '@/components/loan/dialogs/PromoteLoanStageDialog';
import { ReturnLoanForReworkDialog } from '@/components/loan/dialogs/ReturnLoanForReworkDialog';
import { UploadLoanDocumentDialog } from '@/components/loan/dialogs/UploadLoanDocumentDialog';

const getStageColor = (stage: LoanStage) => {
  switch (stage) {
    case LoanStage.APPLICATION_SUBMITTED: return 'bg-sky-500';
    case LoanStage.DOCUMENT_COLLECTION: return 'bg-blue-500';
    case LoanStage.UNDER_REVIEW: return 'bg-indigo-500';
    case LoanStage.ADDITIONAL_INFO_REQUIRED: return 'bg-yellow-500 text-black';
    case LoanStage.APPROVED: return 'bg-green-500';
    case LoanStage.REJECTED: return 'bg-red-500';
    case LoanStage.FUNDS_DISBURSED: return 'bg-emerald-600';
    default: return 'bg-gray-500';
  }
};

export default function LoanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const loanId = params.id as string;

  const [loan, setLoan] = useState<LoanRequest | null>(null);
  const [users, setUsers] = useState<UserType[]>(mockUsers);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 
  const [error, setError] = useState<string | null>(null);

  const [isEditLoanDialogOpen, setIsEditLoanDialogOpen] = useState(false);
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [isLogInfoDialogOpen, setIsLogInfoDialogOpen] = useState(false);
  const [isUploadDocDialogOpen, setIsUploadDocDialogOpen] = useState(false);
  const [currentDocumentToUpload, setCurrentDocumentToUpload] = useState<string | null>(null);
  const [isPromoteLoanDialogOpen, setIsPromoteLoanDialogOpen] = useState(false);
  const [isReturnForReworkDialogOpen, setIsReturnForReworkDialogOpen] = useState(false);

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
      } else {
        setError(`Loan request with ID "${loanId}" not found.`);
        setLoan(null);
      }
    } catch (err: any) {
      const errorMessage = err.message || "An unexpected error occurred while fetching loan data.";
      setError(errorMessage);
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

    const newHistory = updatedFields.history || loan.history;
    const newLoanState: LoanRequest = {
      ...loan,
      ...updatedFields,
      history: [...newHistory], // Ensure history is a new array
      lastUpdatedDate: formatISO(new Date()),
    };
    setLoan(newLoanState); // Update local state immediately

    try {
      const serviceResult = await updateLoanRequest(loan.id, newLoanState); // Send the whole updated state
      if (serviceResult.error || !serviceResult.success) {
        toast({ title: "Update Error", description: serviceResult.error || "Failed to update loan in service.", variant: "destructive" });
        // Optionally revert local state or refetch from service if critical
        fetchLoanData(); // Refetch to ensure consistency if service update fails
        return false;
      }
      toast({ title: "Update Successful", description: successMessage, variant: "default" });
      // No need to setLoan again here if serviceResult.updatedLoan is the same as newLoanState
      // or if we trust the local update.
      return true;
    } catch (err: any) {
      toast({ title: "System Error", description: err.message || "A critical error occurred during update.", variant: "destructive" });
      fetchLoanData(); // Refetch on critical error
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [loan, toast, fetchLoanData]);


  const onEditLoanSubmit = async (data: any) => { 
    const finalAssignedTo = data.assignedTo === UNASSIGNED_DIALOG_OPTION_VALUE ? undefined : data.assignedTo;
    const success = await handleLocalAndUpdateService({
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      loanAmount: Number(data.loanAmount),
      loanType: data.loanType,
      loanPurpose: data.loanPurpose,
      assignedTo: finalAssignedTo,
    }, "Loan details updated.");
    if (success) setIsEditLoanDialogOpen(false);
  };

  const onAddNoteSubmit = async (noteContent: string) => {
    if (!noteContent.trim()) {
      toast({ title: "Note Required", description: "Please enter content for the note.", variant: "destructive" });
      return;
    }
    if(!loan) return;
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stage: loan.currentStage, timestamp: formatISO(new Date()),
      userId: 'mock-user-id', userName: 'Mock Bank User', notes: noteContent,
    };
    const success = await handleLocalAndUpdateService({ history: [...loan.history, newHistoryEntry] }, "Note added.");
    if (success) setIsAddNoteDialogOpen(false);
  };
  
  const onLogInfoRequestSubmit = async (infoToRequest: string) => {
    if (!infoToRequest.trim()) {
      toast({ title: "Info Required", description: "Please specify information needed.", variant: "destructive" });
      return;
    }
    if(!loan) return;
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stage: loan.currentStage, timestamp: formatISO(new Date()),
      userId: 'mock-user-id', userName: 'Mock Bank User', notes: `Logged information request: ${infoToRequest}`,
      requiredFulfilment: infoToRequest,
    };
    const success = await handleLocalAndUpdateService({ history: [...loan.history, newHistoryEntry] }, "Information request logged.");
    if (success) setIsLogInfoDialogOpen(false);
  };

  const handleFulfillInfoRequest = async (entryId: string, requirementText: string) => {
    if (!loan) return;
    const updatedHistory = loan.history.map(h =>
        h.id === entryId ? { ...h, notes: `${h.notes || ''}\n[FULFILLED MOCK] by customer on ${new Date().toLocaleDateString()}. Requirement: ${requirementText}` } : h
    );
    updatedHistory.push({
        id: `hist-mock-${Date.now()}`, stage: loan.currentStage, timestamp: formatISO(new Date()),
        userId: 'mock-user-id', userName: 'Mock Bank User',
        notes: `Information received for requirement: "${requirementText}". Ready for re-evaluation.`
    });
    await handleLocalAndUpdateService({ history: updatedHistory }, "Information fulfillment status updated.");
  };

  const validateCurrentStageRequirements = useCallback((): boolean => {
    if (!loan) return false;
    if (loan.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED) {
      const activeInfoReq = [...loan.history].reverse().find(entry => entry.requiredFulfilment && (!entry.notes || !entry.notes.includes("[FULFILLED MOCK]")));
      if (activeInfoReq) {
        toast({ title: "Action Pending", description: `Outstanding action: '${activeInfoReq.requiredFulfilment}' must be resolved.`, variant: "destructive", duration: 7000 });
        return false;
      }
    }
    const currentStageConfig = initialStageConfigs.find(c => c.loanStageEnum === loan.currentStage);
    if (currentStageConfig?.requiredDocuments.length) {
      const pendingDocs = currentStageConfig.requiredDocuments.filter(reqDoc => {
        const uploadedDoc = loan.documents.find(d => d.name === reqDoc.name);
        return !uploadedDoc || uploadedDoc.status !== 'Verified';
      });
      if (pendingDocs.length > 0) {
        toast({ title: "Documents Pending", description: `Cannot proceed. Documents for stage '${loan.currentStage}' must be verified: ${pendingDocs.map(d => d.name).join(', ')}.`, variant: "destructive", duration: 7000 });
        return false;
      }
    }
    return true;
  }, [loan, toast]);

  const handleMarkStageComplete = async () => {
    if (!loan || !validateCurrentStageRequirements()) return;
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stage: loan.currentStage, timestamp: formatISO(new Date()),
      userId: 'mock-officer-user', userName: 'Officer User (Mock)',
      notes: `Stage '${loan.currentStage}' marked complete. Submitted for manager review.`,
    };
    await handleLocalAndUpdateService({ isReadyForManagerReview: true, history: [...loan.history, newHistoryEntry] }, `Loan submitted for manager review.`);
  };

  const handlePromoteLoan = async (nextStage: LoanStage) => {
    if (!loan || !nextStage ) { 
      toast({ title: "Error", description: "Next stage must be selected.", variant: "destructive" });
      return;
    }
    
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stage: nextStage, timestamp: formatISO(new Date()),
      userId: 'mock-manager-user', userName: 'Manager User (Mock)',
      notes: `Manager promoted to ${nextStage}. Case is now unassigned.`
    };
    const success = await handleLocalAndUpdateService({
      currentStage: nextStage, assignedTo: undefined, 
      history: [...loan.history, newHistoryEntry], isReadyForManagerReview: false,
    }, `${loan.customerName} moved to ${nextStage} and is now unassigned.`);
    if (success) setIsPromoteLoanDialogOpen(false);
  };

  const handleApproveLoan = async () => {
    if (!loan || !validateCurrentStageRequirements()) return;
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stage: LoanStage.APPROVED, timestamp: formatISO(new Date()),
      userId: 'mock-manager-user', userName: 'Manager User (Mock)',
      notes: 'Loan directly approved by manager. Case unassigned.'
    };
    await handleLocalAndUpdateService({
      currentStage: LoanStage.APPROVED, assignedTo: undefined,
      isReadyForManagerReview: false, history: [...loan.history, newHistoryEntry]
    }, 'Loan approved by manager.');
  };
  
  const onReturnForReworkSubmit = async (reworkNote: string, reworkAssigneeId?: string) => {
    if (!loan) return;
    if (!reworkNote.trim()) {
      toast({ title: "Note Required", description: "Please provide reason for returning.", variant: "destructive" });
      return;
    }
    const newHistoryEntry: LoanHistoryEntry = {
      id: `hist-mock-${Date.now()}`, stage: loan.currentStage, timestamp: formatISO(new Date()),
      userId: 'mock-manager-user', userName: 'Manager User (Mock)',
      notes: `Manager returned case for rework. Reason: ${reworkNote}`
    };
    const success = await handleLocalAndUpdateService({
      isReadyForManagerReview: false, assignedTo: reworkAssigneeId,
      history: [...loan.history, newHistoryEntry],
    }, "Loan case returned for rework.");
    if (success) setIsReturnForReworkDialogOpen(false);
  };

  const handleUploadDocument = async (docName: string) => {
    if (!loan) return;
    const existingDocIndex = loan.documents.findIndex(d => d.name === docName);
    let updatedDocuments: LoanDocument[];
    if (existingDocIndex > -1) {
        updatedDocuments = loan.documents.map((doc, index) =>
            index === existingDocIndex ? { ...doc, status: 'Submitted', notes: 'File re-uploaded.' } : doc
        );
    } else {
        updatedDocuments = [
            ...loan.documents,
            { id: `doc-mock-${Date.now()}`, name: docName, status: 'Submitted', notes: 'File uploaded.' }
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


  if (isLoading && !loan) { // Show loader only if loan data is not yet available
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading loan details...</p>
      </div>
    );
  }

  if (error && !loan) { // Show error only if loan could not be loaded
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Error Loading Loan</h1>
        <p className="text-muted-foreground mb-6 break-words whitespace-pre-wrap">
          {error || `The loan request with ID "${loanId}" could not be found.`}
        </p>
        <button onClick={() => router.push('/loan-process')} className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90">
          Go Back to Loan Pipeline
        </button>
      </div>
    );
  }

  if (!loan) { // Fallback if loan is null after loading (e.g. not found but no error string)
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <p className="text-lg text-muted-foreground">Loan not found.</p>
      </div>
    );
  }
  
  const assignedUser = users.find(u => u.id === loan.assignedTo);
  const isActionableStage = ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED].includes(loan.currentStage);

  let progressPercentage = 0;
  if (loan.currentStage === LoanStage.FUNDS_DISBURSED) {
      progressPercentage = 100;
  } else if (loan.currentStage === LoanStage.REJECTED) {
      let cumulativeWeight = 0;
      let rejectedFound = false;
      for (const stageCfg of initialStageConfigs) {
          if (stageCfg.loanStageEnum === LoanStage.REJECTED) {
              rejectedFound = true;
              break;
          }
          cumulativeWeight += Number(stageCfg.percentageWeight) || 0;
      }
      progressPercentage = rejectedFound ? cumulativeWeight : 0;
  } else {
      let cumulativeWeight = 0;
      let stageFoundInConfig = false;
      for (const stageCfg of initialStageConfigs) {
          cumulativeWeight += Number(stageCfg.percentageWeight) || 0;
          if (stageCfg.loanStageEnum === loan.currentStage) {
              stageFoundInConfig = true;
              break;
          }
      }
      progressPercentage = stageFoundInConfig ? cumulativeWeight : 0;
  }
  progressPercentage = Math.min(100, Math.max(0, progressPercentage));


  return (
    <div className="space-y-6">
      <LoanDetailHeader
        loan={loan}
        onBack={() => router.back()}
        onOpenEditDialog={() => setIsEditLoanDialogOpen(true)}
        onOpenAddNoteDialog={() => setIsAddNoteDialogOpen(true)}
        onOpenLogInfoDialog={() => setIsLogInfoDialogOpen(true)}
        onMarkStageComplete={handleMarkStageComplete}
        onOpenPromotionDialog={() => {
            if (!validateCurrentStageRequirements()) return;
            setIsPromoteLoanDialogOpen(true);
        }}
        onApproveLoan={() => {
            if (!validateCurrentStageRequirements()) return;
            handleApproveLoan();
        }}
        onOpenReturnForReworkDialog={() => setIsReturnForReworkDialogOpen(true)}
        isSaving={isSaving}
        isActionableStage={isActionableStage}
      />

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle>
              <CardDescription>Loan Number: {loan.loanNumber} | Customer Number: {loan.customerNumber}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
                <Badge className={`px-3 py-1.5 text-sm font-medium text-white ${getStageColor(loan.currentStage)}`}>
                {loan.currentStage}
                </Badge>
                {loan.isReadyForManagerReview && isActionableStage && (
                    <Badge variant="outline" className="text-orange-600 border-orange-500 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300">
                        Awaiting Manager Review
                    </Badge>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <LoanProgressDisplay loan={loan} progressPercentage={progressPercentage} />
          <LoanInfoDisplay loan={loan} assignedUser={assignedUser} />
          <Separator className="my-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <LoanDocumentsManager
              loan={loan}
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
        users={users}
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
      <PromoteLoanStageDialog
        isOpen={isPromoteLoanDialogOpen}
        onOpenChange={setIsPromoteLoanDialogOpen}
        loan={loan}
        onSubmit={handlePromoteLoan}
        isSaving={isSaving}
        validateCurrentStageRequirements={validateCurrentStageRequirements}
      />
      <ReturnLoanForReworkDialog
        isOpen={isReturnForReworkDialogOpen}
        onOpenChange={setIsReturnForReworkDialogOpen}
        loan={loan}
        users={users}
        onSubmit={onReturnForReworkSubmit}
        isSaving={isSaving}
      />
    </div>
  );
}
