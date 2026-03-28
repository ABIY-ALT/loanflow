'use client';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  StickyNote, 
  Edit3, 
  CheckSquare, 
  ArrowRight, 
  Undo2, 
  Loader2, 
  UserPlus, 
  ShieldX, 
  Shuffle, 
  BadgeCheck, 
  CheckCircle2 
} from 'lucide-react';
import type { LoanRequest } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/contexts/auth-context';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

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
  onOpenManualTransitionDialog: () => void;
  isSaving: boolean;
  isActionableStage: boolean;
  canPromote: boolean;
  requiresApproval: boolean;
}

export function LoanDetailHeader({
  loan,
  onBack,
  onOpenEditDialog,
  onOpenAddNoteDialog,
  onOpenLogInfoDialog,
  onMarkStageComplete,
  onManagerPromoteLoan,
  onOpenReturnForReworkDialog,
  onOpenTerminateLoanDialog,
  onOpenManualTransitionDialog,
  isSaving,
  isActionableStage,
  canPromote,
  requiresApproval,
}: LoanDetailHeaderProps) {
  const { user: currentUser } = useAuth();
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);

  if (!loan || !currentUser) return null;
  
  const canEditDetails = userPermissions.has(PERMISSIONS.EDIT_LOAN_DETAILS);
  const canAssignStaff = userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF);
  const isCurrentUserAssigned = loan.assignedToUsers.some(u => u.id === currentUser.id);
  const hasCurrentUserCompleted = loan.stageCompletedBy?.some(u => u.id === currentUser.id) || false;

  // Permission-based checks for manager actions
  const canApprove = userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE);
  const canReturn = userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK);
  // Determine if this user can promote the stage directly (if configured)
  const canDirectPromote = !requiresApproval && canPromote;
  const isDirectPromotion = !requiresApproval;

  return (
    <div className="flex items-center justify-between mb-8 flex-wrap gap-2">
      <Button variant="outline" onClick={onBack} disabled={isSaving}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <div className="flex flex-wrap gap-2 mt-2 sm:mt-0 justify-end flex-grow">
        {(canEditDetails || canAssignStaff) && isActionableStage &&
            <Button variant="outline" onClick={onOpenEditDialog} disabled={isSaving}>
                <UserPlus className="mr-2 h-4 w-4" /> Edit / Assign
            </Button>
        }
        {userPermissions.has(PERMISSIONS.ADD_LOAN_NOTES) && isActionableStage && 
            <Button variant="outline" onClick={onOpenAddNoteDialog} disabled={isSaving}><StickyNote className="mr-2 h-4 w-4" /> Add Note</Button>
        }
        {isActionableStage && userPermissions.has(PERMISSIONS.LOG_INFO_REQUEST) &&
            <Button variant="outline" onClick={onOpenLogInfoDialog} disabled={isSaving}><Edit3 className="mr-2 h-4 w-4" /> Log Request</Button>
        }

        {/* Primary Staff Action Button: Dynamically changes based on direct promotion capability */}
        {isActionableStage && isCurrentUserAssigned && !loan.isReadyForManagerReview && (
          <Button 
            onClick={onMarkStageComplete} 
            disabled={isSaving || hasCurrentUserCompleted}
            className={cn(
              canDirectPromote ? "bg-green-600 hover:bg-green-700" : 
              isDirectPromotion ? "bg-blue-600 hover:bg-blue-700" : ""
            )}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hasCurrentUserCompleted ? (
              <BadgeCheck className="mr-2 h-4 w-4" />
            ) : canDirectPromote ? (
              <ArrowRight className="mr-2 h-4 w-4" />
            ) : isDirectPromotion ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <CheckSquare className="mr-2 h-4 w-4" />
            )}

            {hasCurrentUserCompleted ? 'Part Submitted' : 
             canDirectPromote ? 'Approve & Promote' :
             isDirectPromotion ? 'Complete & Promote' : 
             'Mark Stage Complete & Submit'}
          </Button>
        )}

        {/* Manager Approval Button: Always shown, disabled if no permission */}
        {isActionableStage && (
            <Button 
              onClick={canApprove ? onManagerPromoteLoan : undefined}
              disabled={isSaving || !canApprove}
              className="bg-green-600 hover:bg-green-700 text-white font-bold"
              title={canApprove ? undefined : 'You do not have permission to approve'}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               <ArrowRight className="mr-2 h-4 w-4" /> Approve & Promote
            </Button>
        )}

        {/* Return for Rework Button: Always shown, disabled if no permission */}
        {isActionableStage && (
             <Button 
               variant="outline" 
               onClick={canReturn ? onOpenReturnForReworkDialog : undefined}
               disabled={isSaving || !canReturn}
               className="border-amber-500 text-amber-700 hover:bg-amber-50"
               title={canReturn ? undefined : 'You do not have permission to return for rework'}
             >
                <Undo2 className="mr-2 h-4 w-4" /> Return for Rework
            </Button>
        )}
        {isActionableStage && userPermissions.has(PERMISSIONS.MANUAL_STAGE_TRANSITION) && (
             <Button variant="secondary" onClick={onOpenManualTransitionDialog} disabled={isSaving}>
                <Shuffle className="mr-2 h-4 w-4" /> Manual Transition
            </Button>
        )}
        {isActionableStage && userPermissions.has(PERMISSIONS.TERMINATE_LOAN_PROCESS) && (
            <Button variant="destructive" onClick={onOpenTerminateLoanDialog} disabled={isSaving}>
                <ShieldX className="mr-2 h-4 w-4" /> Terminate
            </Button>
        )}
      </div>
    </div>
  );
}