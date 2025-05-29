
'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, StickyNote, Edit3, CheckSquare, ArrowRight, UserCheck, Undo2, Loader2 } from 'lucide-react';
import type { LoanRequest } from '@/types/loan';
import { LoanStage } from '@/types/loan';

interface LoanDetailHeaderProps {
  loan: LoanRequest | null;
  onBack: () => void;
  onOpenEditDialog: () => void;
  onOpenAddNoteDialog: () => void;
  onOpenLogInfoDialog: () => void;
  onMarkStageComplete: () => Promise<void>;
  onOpenPromotionDialog: () => void;
  onApproveLoan: () => Promise<void>;
  onOpenReturnForReworkDialog: () => void;
  isSaving: boolean; // General saving state for actions initiated from header
  isActionableStage: boolean;
}

export function LoanDetailHeader({
  loan,
  onBack,
  onOpenEditDialog,
  onOpenAddNoteDialog,
  onOpenLogInfoDialog,
  onMarkStageComplete,
  onOpenPromotionDialog,
  onApproveLoan,
  onOpenReturnForReworkDialog,
  isSaving,
  isActionableStage,
}: LoanDetailHeaderProps) {
  if (!loan) return null;

  const canOfficerMarkComplete = isActionableStage && !loan.isReadyForManagerReview;
  const canManagerTakeAction = isActionableStage && loan.isReadyForManagerReview;
  const canManagerApprove = canManagerTakeAction && loan.currentStage !== LoanStage.APPROVED && loan.currentStage !== LoanStage.REJECTED && loan.currentStage !== LoanStage.FUNDS_DISBURSED;

  return (
    <div className="flex items-center justify-between mb-8">
      <Button variant="outline" onClick={onBack} disabled={isSaving}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onOpenEditDialog} disabled={isSaving}><Edit className="mr-2 h-4 w-4" /> Edit Details</Button>
        <Button variant="outline" onClick={onOpenAddNoteDialog} disabled={isSaving}><StickyNote className="mr-2 h-4 w-4" /> Add Note</Button>
        <Button variant="outline" onClick={onOpenLogInfoDialog} disabled={isSaving || !isActionableStage}><Edit3 className="mr-2 h-4 w-4" /> Log Info Request</Button>

        {canOfficerMarkComplete && (
          <Button onClick={onMarkStageComplete} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckSquare className="mr-2 h-4 w-4" /> Mark Stage Complete & Submit for Review
          </Button>
        )}

        {canManagerTakeAction && (
           <>
            <Button onClick={onOpenPromotionDialog} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               <ArrowRight className="mr-2 h-4 w-4" /> Manager: Promote Loan
            </Button>
             {canManagerApprove && (
                <Button
                  variant="default"
                  onClick={onApproveLoan}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <UserCheck className="mr-2 h-4 w-4" /> Manager: Approve Loan
                </Button>
            )}
            <Button variant="outline" onClick={onOpenReturnForReworkDialog} disabled={isSaving} className="border-amber-500 text-amber-700 hover:bg-amber-50">
                <Undo2 className="mr-2 h-4 w-4" /> Return for Rework
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
