
'use client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, StickyNote, Edit3, CheckSquare, ArrowRight, Undo2, Loader2 } from 'lucide-react';
import type { LoanRequest, User } from '@/types/loan';
import { UserRole } from '@/types/loan';
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

  const isViewOnly = currentUser.role === UserRole.VIEW_ONLY;
  const isManager = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.UNDERWRITER;
  const isStaff = currentUser.role === UserRole.STAFF || currentUser.role === UserRole.RELATIONSHIP_MANAGER;

  const canEditDetails = !isViewOnly && (isManager || (isStaff && loan.assignedTo === currentUser.id));
  const canAddNote = !isViewOnly; // All non-view-only roles can add notes for now
  const canLogInfoRequest = !isViewOnly && isActionableStage && (isManager || (isStaff && loan.assignedTo === currentUser.id));
  
  const canOfficerMarkComplete = !isViewOnly && isActionableStage && 
                                 (isStaff || (isManager && loan.assignedTo === currentUser.id)) && 
                                 loan.assignedTo === currentUser.id && 
                                 !loan.isReadyForManagerReview;

  const canManagerTakeAction = !isViewOnly && isActionableStage && 
                               isManager && 
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

        {canManagerTakeAction && (
           <>
            <Button onClick={onManagerPromoteLoan} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               <ArrowRight className="mr-2 h-4 w-4" /> Approve & Promote
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
