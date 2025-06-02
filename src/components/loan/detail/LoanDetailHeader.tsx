
'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, StickyNote, Edit3, CheckSquare, ArrowRight, Undo2, Loader2 } from 'lucide-react';
import type { LoanRequest } from '@/types/loan';
// Removed LoanStage import

interface LoanDetailHeaderProps {
  loan: LoanRequest | null;
  currentStageName: string; // Added to display current stage
  onBack: () => void;
  onOpenEditDialog: () => void;
  onOpenAddNoteDialog: () => void;
  onOpenLogInfoDialog: () => void;
  onMarkStageComplete: () => Promise<void>; // Officer action
  onManagerPromoteLoan: () => Promise<void>; // Manager action, promotion is automatic
  onOpenReturnForReworkDialog: () => void;
  isSaving: boolean;
  isActionableStage: boolean;
}

export function LoanDetailHeader({
  loan,
  currentStageName,
  onBack,
  onOpenEditDialog,
  onOpenAddNoteDialog,
  onOpenLogInfoDialog,
  onMarkStageComplete,
  onManagerPromoteLoan,
  onOpenReturnForReworkDialog,
  isSaving,
  isActionableStage,
}: LoanDetailHeaderProps) {
  if (!loan) return null;

  const canOfficerMarkComplete = isActionableStage && !loan.isReadyForManagerReview && loan.assignedTo; // Officer must be assigned
  const canManagerTakeAction = isActionableStage && loan.isReadyForManagerReview;
  // Direct "Approve" button might be removed if approval is just part of the last stage promotion.
  // For now, let's assume promotion handles approval to the next logical step or finalization.

  return (
    <div className="flex items-center justify-between mb-8 flex-wrap">
      <Button variant="outline" onClick={onBack} disabled={isSaving}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
        <Button variant="outline" onClick={onOpenEditDialog} disabled={isSaving}><Edit className="mr-2 h-4 w-4" /> Edit Details / Assign</Button>
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
            <Button onClick={onManagerPromoteLoan} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               <ArrowRight className="mr-2 h-4 w-4" /> Manager: Approve & Promote to Next Stage
            </Button>
            <Button variant="outline" onClick={onOpenReturnForReworkDialog} disabled={isSaving} className="border-amber-500 text-amber-700 hover:bg-amber-50">
                <Undo2 className="mr-2 h-4 w-4" /> Return for Rework
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
