
'use client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, StickyNote, Edit3, CheckSquare, ArrowRight, Undo2, Loader2 } from 'lucide-react';
import type { LoanRequest, User } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions'; // Import PERMISSIONS
import { useAuth } from '@/contexts/auth-context';

interface LoanDetailHeaderProps {
  loan: LoanRequest | null;
  currentStageName: string; 
  onBack: () => void;
  onOpenEditDialog: () => void;
  onOpenAddNoteDialog: () => void;
  onOpenLogInfoDialog: () => void;
  onMarkStageComplete: () => Promise<void>; 
  onManagerPromoteLoan: () => Promise<void>; 
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
  const { user: currentUser } = useAuth();

  if (!loan || !currentUser) return null;

  const canEditDetails = currentUser.permissions.includes(PERMISSIONS.EDIT_LOAN_DETAILS);
  const canAddNote = currentUser.permissions.includes(PERMISSIONS.ADD_LOAN_NOTES);
  const canLogInfoRequest = currentUser.permissions.includes(PERMISSIONS.LOG_INFO_REQUEST) && isActionableStage;
  
  const canOfficerMarkComplete = currentUser.permissions.includes(PERMISSIONS.MARK_STAGE_COMPLETE) && 
                                 isActionableStage && 
                                 loan.assignedTo === currentUser.id && 
                                 !loan.isReadyForManagerReview;

  const canManagerPromote = currentUser.permissions.includes(PERMISSIONS.PROMOTE_LOAN_STAGE) &&
                            isActionableStage && 
                            loan.isReadyForManagerReview;

  const canManagerReturnForRework = currentUser.permissions.includes(PERMISSIONS.RETURN_LOAN_FOR_REWORK) &&
                                    isActionableStage && 
                                    loan.isReadyForManagerReview;

  return (
    <div className="flex items-center justify-between mb-8 flex-wrap">
      <Button variant="outline" onClick={onBack} disabled={isSaving}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
        {canEditDetails && 
            <Button variant="outline" onClick={onOpenEditDialog} disabled={isSaving}><Edit className="mr-2 h-4 w-4" /> Edit Details / Assign</Button>
        }
        {canAddNote && 
            <Button variant="outline" onClick={onOpenAddNoteDialog} disabled={isSaving}><StickyNote className="mr-2 h-4 w-4" /> Add Note</Button>
        }
        {canLogInfoRequest &&
            <Button variant="outline" onClick={onOpenLogInfoDialog} disabled={isSaving}><Edit3 className="mr-2 h-4 w-4" /> Log Info Request</Button>
        }

        {canOfficerMarkComplete && (
          <Button onClick={onMarkStageComplete} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckSquare className="mr-2 h-4 w-4" /> Mark Stage Complete & Submit
          </Button>
        )}

        {canManagerPromote && (
            <Button onClick={onManagerPromoteLoan} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               <ArrowRight className="mr-2 h-4 w-4" /> Approve & Promote
            </Button>
        )}
        {canManagerReturnForRework && (
             <Button variant="outline" onClick={onOpenReturnForReworkDialog} disabled={isSaving} className="border-amber-500 text-amber-700 hover:bg-amber-50">
                <Undo2 className="mr-2 h-4 w-4" /> Return for Rework
            </Button>
        )}
      </div>
    </div>
  );
}
