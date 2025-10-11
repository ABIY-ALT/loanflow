

'use client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, StickyNote, Edit3, CheckSquare, ArrowRight, Undo2, Loader2, UserPlus, ShieldX } from 'lucide-react';
import type { LoanRequest } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/contexts/auth-context';
import { useMemo } from 'react';

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
  onOpenTerminateLoanDialog: () => void;
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
  onOpenTerminateLoanDialog,
  isSaving,
  isActionableStage,
}: LoanDetailHeaderProps) {
  const { user: currentUser } = useAuth();
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);

  if (!loan || !currentUser) return null;
  
  const canEditDetails = userPermissions.has(PERMISSIONS.EDIT_LOAN_DETAILS);
  const canAssignStaff = userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF);

  return (
    <div className="flex items-center justify-between mb-8 flex-wrap">
      <Button variant="outline" onClick={onBack} disabled={isSaving}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
        {(canEditDetails || canAssignStaff) && isActionableStage &&
            <Button variant="outline" onClick={onOpenEditDialog} disabled={isSaving}>
                {canEditDetails && canAssignStaff ? <Edit className="mr-2 h-4 w-4" /> : (canAssignStaff ? <UserPlus className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />)}
                {canEditDetails ? 'Edit / Assign' : 'Assign Staff'}
            </Button>
        }
        {userPermissions.has(PERMISSIONS.ADD_LOAN_NOTES) && isActionableStage && 
            <Button variant="outline" onClick={onOpenAddNoteDialog} disabled={isSaving}><StickyNote className="mr-2 h-4 w-4" /> Add Note</Button>
        }
        {isActionableStage && userPermissions.has(PERMISSIONS.LOG_INFO_REQUEST) &&
            <Button variant="outline" onClick={onOpenLogInfoDialog} disabled={isSaving}><Edit3 className="mr-2 h-4 w-4" /> Log Info Request</Button>
        }

        {isActionableStage && userPermissions.has(PERMISSIONS.MARK_STAGE_COMPLETE) && loan.assignedTo === currentUser.id && !loan.isReadyForManagerReview && (
          <Button onClick={onMarkStageComplete} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckSquare className="mr-2 h-4 w-4" /> Mark Stage Complete & Submit
          </Button>
        )}

        {isActionableStage && userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE) && loan.isReadyForManagerReview && (
            <Button onClick={onManagerPromoteLoan} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               <ArrowRight className="mr-2 h-4 w-4" /> Approve & Promote
            </Button>
        )}
        {isActionableStage && userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK) && loan.isReadyForManagerReview && (
             <Button variant="outline" onClick={onOpenReturnForReworkDialog} disabled={isSaving} className="border-amber-500 text-amber-700 hover:bg-amber-50">
                <Undo2 className="mr-2 h-4 w-4" /> Return for Rework
            </Button>
        )}
        {isActionableStage && userPermissions.has(PERMISSIONS.TERMINATE_LOAN_PROCESS) && (
            <Button variant="destructive" onClick={onOpenTerminateLoanDialog} disabled={isSaving}>
                <ShieldX className="mr-2 h-4 w-4" /> Terminate Process
            </Button>
        )}
      </div>
    </div>
  );
}
