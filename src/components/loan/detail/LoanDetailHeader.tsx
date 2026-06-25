'use client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  CheckCircle2,
  FileText,
  SearchCheck,
  SkipForward,
  AlertCircle,
} from 'lucide-react';
import type { LoanRequest } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { canDistributeToDistrictApproval } from '@/lib/district-workflow';
import { useAuth } from '@/contexts/auth-context';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface LoanDetailHeaderProps {
  loan: LoanRequest | null;
  currentStageName: string;
  onBack: () => void;
  onOpenEditDialog: () => void;
  onOpenAddNoteDialog: () => void;
  onOpenLogInfoDialog: () => void;
  onMarkStageComplete: () => Promise<void>;
  onManagerPromoteLoan: () => Promise<void>;
  onOpenApproveReassignDialog: () => void;
  onOpenReturnForReworkDialog: () => void;
  onOpenTerminateLoanDialog: () => void;
  onOpenManualTransitionDialog: () => void;
  onOpenDistributeDialog?: () => void;
  onSkipPvr?: () => void;
  isSkippingPvr?: boolean;
  isSaving: boolean;
  isActionableStage: boolean;
  canPromote: boolean;
  requiresApproval: boolean;
  // WF-05 routing stages: the stage moves when staff is assigned, so the
  // promote button is replaced by guidance pointing at the Assign action.
  assignMovesStage?: boolean;
  hasOutstandingInfoRequest?: boolean;
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
  onOpenApproveReassignDialog,
  onOpenReturnForReworkDialog,
  onOpenTerminateLoanDialog,
  onOpenManualTransitionDialog,
  onOpenDistributeDialog,
  onSkipPvr,
  isSkippingPvr,
  hasOutstandingInfoRequest = false,
  isSaving,
  isActionableStage,
  canPromote,
  requiresApproval,
  assignMovesStage,
}: LoanDetailHeaderProps) {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);

  if (!loan || !currentUser) return null;

  const isAdmin = userPermissions.has(PERMISSIONS.MANAGE_USERS);
  const isDistrict = loan.submissionType === 'TYPE2';

  const canAssignStaff = isAdmin || userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF);
  const isCurrentUserAssigned = loan.assignedToUsers.some((u) => u.id === currentUser.id);
  const hasCurrentUserCompleted =
    loan.stageCompletedBy?.some((u) => u.id === currentUser.id) || false;

  const canApprove = isAdmin || userPermissions.has(PERMISSIONS.PROMOTE_LOAN_STAGE);
  const canDistributeToApproval =
    (isAdmin || userPermissions.has(PERMISSIONS.DISTRIBUTE_TO_DISTRICT_APPROVAL)) &&
    canDistributeToDistrictApproval(loan);

  const stageGuidance = useMemo(() => {
    if (loan.currentStageOrder === 6 && loan.currentStageStatus === 'RETURNED_FOR_COMMENT') {
      return 'Returned by Operations Manager for comment only. Review the case and distribute to Committee Approval when ready.';
    }
    if (loan.currentStageOrder === 6 && loan.currentStageStatus === 'RETURNED_FOR_REWORK') {
      return 'Returned by Operations Manager for rework. Update the analysis and distribute to Committee Approval once the case is ready.';
    }
    if (loan.currentStageOrder === 7) {
      return 'Final Operation Manager Review: add feedback, or return to the analyst for comment/rework and later committee distribution.';
    }
    if (loan.currentStageStatus === 'RETURNED_FROM_VALUATION') {
      return 'Returned from Valuation to District CRM. Resume the CRM review and prepare the case for the next district analyst handoff.';
    }
    if (loan.currentStageOrder === 8) {
      return 'Committee Distribution stage: this case is ready for Committee Approval after analyst distribution.';
    }
    return undefined;
  }, [loan.currentStageOrder, loan.currentStageStatus]);
  const canReturn = isAdmin || userPermissions.has(PERMISSIONS.RETURN_LOAN_FOR_REWORK);
  const canMarkStageComplete = isAdmin || userPermissions.has(PERMISSIONS.MARK_STAGE_COMPLETE);
  const canSkipPvr =
    (isAdmin || userPermissions.has(PERMISSIONS.SKIP_PVR_AND_VALUATION)) &&
    isDistrict &&
    (
      [2, 3].includes(loan.currentStageOrder) ||
      (currentStageName || '').toLowerCase().includes('pvr') ||
      (currentStageName || '').toLowerCase().includes('valuation')
    );
  const canDirectPromote = isAdmin || canPromote;
  const isDirectPromotion = !requiresApproval;

  /* ─── Shared utility blocks ─── */
  const SharedLeftActions = (
    <>
      {(isAdmin || canAssignStaff) && isActionableStage && (
        <Button variant="outline" onClick={onOpenEditDialog} disabled={isSaving}>
          <UserPlus className="mr-2 h-4 w-4" /> Assign
        </Button>
      )}
      {(isAdmin || userPermissions.has(PERMISSIONS.ADD_LOAN_NOTES) ||
        (isDistrict && loan.currentStageOrder === 6)) &&
        isActionableStage && (
          <Button variant="outline" onClick={onOpenAddNoteDialog} disabled={isSaving}>
            <StickyNote className="mr-2 h-4 w-4" />
            {isDistrict && loan.currentStageOrder === 6 ? 'Add Remark' : 'Add Note'}
          </Button>
        )}
      {isActionableStage && (isAdmin || userPermissions.has(PERMISSIONS.LOG_INFO_REQUEST)) && (
        <Button variant="outline" onClick={onOpenLogInfoDialog} disabled={isSaving}>
          <Edit3 className="mr-2 h-4 w-4" /> Log Request
        </Button>
      )}
    </>
  );

  const SharedRightActions = (
    <>
      {isActionableStage && (isAdmin || userPermissions.has(PERMISSIONS.MANUAL_STAGE_TRANSITION)) && (
        <Button variant="secondary" onClick={onOpenManualTransitionDialog} disabled={isSaving}>
          <Shuffle className="mr-2 h-4 w-4" /> Manual Transition
        </Button>
      )}
      {isActionableStage && (isAdmin || userPermissions.has(PERMISSIONS.TERMINATE_LOAN_PROCESS)) && (
        <Button variant="destructive" onClick={onOpenTerminateLoanDialog} disabled={isSaving}>
          <ShieldX className="mr-2 h-4 w-4" /> Terminate
        </Button>
      )}
    </>
  );

  /* ════════════════════════════════════════════════════
     🏢  DISTRICT SPECIALIZED WORKFLOW  (TYPE-2)
  ════════════════════════════════════════════════════ */
  if (isDistrict) {
    return (
      <div className="space-y-3 mb-8">
        {/* Path banner */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="outline" onClick={onBack} disabled={isSaving}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-300 shadow-sm flex-shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-bold text-amber-800 tracking-wide uppercase">
              District Specialized Workflow
            </span>
            <Badge className="ml-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] px-2 py-0">
              TYPE-2
            </Badge>
            <span className="text-xs text-amber-600 font-medium hidden sm:inline">
              · Stage {loan.currentStageOrder}
            </span>
          </div>
        </div>

        {/* Action bar — amber tinted */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
          {/* LEFT: general utility */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 hidden sm:inline">
              General
            </span>
            {SharedLeftActions}
          </div>

          {/* CENTRE: workflow guidance */}
          {stageGuidance ? (
            <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 sm:w-auto">
              {stageGuidance}
            </div>
          ) : null}

          {/* CENTRE: core workflow progression */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Staff mark complete */}
            {isActionableStage &&
              (isAdmin || isCurrentUserAssigned || canDirectPromote) &&
              !loan.isReadyForManagerReview &&
              (canMarkStageComplete || canDirectPromote) && (
                <Button
                  onClick={hasOutstandingInfoRequest ? undefined : onMarkStageComplete}
                  disabled={isSaving || hasCurrentUserCompleted || hasOutstandingInfoRequest}
                  title={hasOutstandingInfoRequest ? 'An info request must be resolved before this stage can be completed.' : undefined}
                  className={cn(
                    canDirectPromote
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : isDirectPromotion
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : ''
                  )}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {hasOutstandingInfoRequest ? (
                    <AlertCircle className="mr-2 h-4 w-4" />
                  ) : hasCurrentUserCompleted ? (
                    <BadgeCheck className="mr-2 h-4 w-4" />
                  ) : canDirectPromote ? (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  ) : isDirectPromotion ? (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  ) : (
                    <CheckSquare className="mr-2 h-4 w-4" />
                  )}
                  {hasOutstandingInfoRequest
                    ? 'Info Request Pending'
                    : hasCurrentUserCompleted
                    ? 'Part Submitted'
                    : canDirectPromote
                    ? 'Approve & Promote'
                    : isDirectPromotion
                    ? 'Complete & Promote'
                    : 'Mark Stage Complete & Submit'}
                </Button>
              )}

            {/* Manager approval */}
            {isActionableStage && loan.isReadyForManagerReview && canApprove && (
              <>
                <Button
                  onClick={onManagerPromoteLoan}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <ArrowRight className="mr-2 h-4 w-4" /> Approve
                </Button>
                {canAssignStaff && (
                  <Button variant="outline" onClick={onOpenApproveReassignDialog} disabled={isSaving}>
                    <UserPlus className="mr-2 h-4 w-4" /> Approve & Reassign
                  </Button>
                )}
              </>
            )}

            {/* Stage 7 → Operation Manager returns case for comment ONLY */}
            {isActionableStage && loan.currentStageOrder === 7 && canReturn && (
              <Button
                variant="outline"
                onClick={onOpenReturnForReworkDialog}
                className="border-indigo-500 text-indigo-700 hover:bg-indigo-50"
                disabled={isSaving}
              >
                <Undo2 className="mr-2 h-4 w-4" /> Return for Comment
              </Button>
            )}

            {/* Analyst distributes to District Approval (returned stage 6 or committee distribution stage 8) */}
            {canDistributeToApproval && onOpenDistributeDialog && (
              <Button
                onClick={onOpenDistributeDialog}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold animate-pulse"
              >
                <ArrowRight className="mr-2 h-4 w-4" /> Distribute for District Approval
              </Button>
            )}
          </div>

          {/* RIGHT: district document tools + admin */}
          <div className="flex flex-wrap gap-2 items-center">
            {isActionableStage && (
              <>
                {(currentStageName.includes('PVR Preparation') ||
                  currentStageName.includes('Valuation Review')) && (
                  <Button
                    variant="secondary"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() =>
                      router.push(`/loan-requests/district/pvr/${loan.id}`)
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {currentStageName.includes('Valuation') ? 'View PVR Form' : 'Prepare PVR Form'}
                  </Button>
                )}
                {canSkipPvr && onSkipPvr && (
                  <Button
                    variant="outline"
                    className="border-amber-500 text-amber-700 hover:bg-amber-50"
                    onClick={onSkipPvr}
                    disabled={isSaving || isSkippingPvr}
                  >
                    {isSkippingPvr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2 h-4 w-4" />}
                    Skip PVR
                  </Button>
                )}
                {currentStageName.includes('LAF & Summary Preparation') && (
                  <>
                    <Button
                      variant="secondary"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() =>
                        router.push(`/loan-requests/district/laf/${loan.id}`)
                      }
                    >
                      <FileText className="mr-2 h-4 w-4" /> Prepare LAF
                    </Button>
                    <Button
                      variant="secondary"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() =>
                        router.push(
                          `/loan-requests/district/customer-summary/${loan.id}`
                        )
                      }
                    >
                      <FileText className="mr-2 h-4 w-4" /> Prepare Customer Summary
                    </Button>
                  </>
                )}
                {(currentStageName.includes('Analyst Review') ||
                  currentStageName.includes('Manager Check')) && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(`/loan-requests/district/laf/${loan.id}`)
                      }
                    >
                      <SearchCheck className="mr-2 h-4 w-4" /> Review LAF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/loan-requests/district/customer-summary/${loan.id}`
                        )
                      }
                    >
                      <SearchCheck className="mr-2 h-4 w-4" /> Review Summary
                    </Button>
                  </>
                )}
              </>
            )}
            {SharedRightActions}
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════
     🏦  HEAD OFFICE NORMAL WORKFLOW  (TYPE-1)
  ════════════════════════════════════════════════════ */
  return (
    <div className="space-y-3 mb-8">
      {/* Path banner */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="outline" onClick={onBack} disabled={isSaving}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-300 shadow-sm flex-shrink-0">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          <span className="text-sm font-bold text-blue-800 tracking-wide uppercase">
            Head Office Normal Workflow
          </span>
          <Badge className="ml-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-0">
            TYPE-1
          </Badge>
        </div>
      </div>

      {/* Action bar — blue tinted */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 flex flex-wrap gap-3 items-center justify-between">
        {/* LEFT: general utility */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700 hidden sm:inline">
            General
          </span>
          {SharedLeftActions}
        </div>

        {/* CENTRE: core workflow progression */}
        <div className="flex flex-wrap gap-2 items-center">
          {isActionableStage && assignMovesStage && canAssignStaff && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-900">
              Routing stage: use <span className="font-semibold">Assign</span> to pick the next owner — the case moves to their stage automatically.
            </div>
          )}
          {isActionableStage &&
            !assignMovesStage &&
            (isAdmin || isCurrentUserAssigned || canDirectPromote) &&
            !loan.isReadyForManagerReview &&
            (canMarkStageComplete || canDirectPromote) && (
              <Button
                onClick={hasOutstandingInfoRequest ? undefined : onMarkStageComplete}
                disabled={isSaving || hasCurrentUserCompleted || hasOutstandingInfoRequest}
                title={hasOutstandingInfoRequest ? 'An info request must be resolved before this stage can be completed.' : undefined}
                className={cn(
                  canDirectPromote
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : isDirectPromotion
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : ''
                )}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasOutstandingInfoRequest ? (
                  <AlertCircle className="mr-2 h-4 w-4" />
                ) : hasCurrentUserCompleted ? (
                  <BadgeCheck className="mr-2 h-4 w-4" />
                ) : canDirectPromote ? (
                  <ArrowRight className="mr-2 h-4 w-4" />
                ) : isDirectPromotion ? (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                ) : (
                  <CheckSquare className="mr-2 h-4 w-4" />
                )}
                {hasOutstandingInfoRequest
                  ? 'Info Request Pending'
                  : hasCurrentUserCompleted
                  ? 'Part Submitted'
                  : canDirectPromote
                  ? 'Approve & Promote'
                  : isDirectPromotion
                  ? 'Complete & Promote'
                  : 'Mark Stage Complete & Submit'}
              </Button>
            )}

          {isActionableStage && loan.isReadyForManagerReview && canApprove && (
            <>
              <Button
                onClick={onManagerPromoteLoan}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <ArrowRight className="mr-2 h-4 w-4" /> Approve
              </Button>
              {canAssignStaff && (
                <Button variant="outline" onClick={onOpenApproveReassignDialog} disabled={isSaving}>
                  <UserPlus className="mr-2 h-4 w-4" /> Approve & Reassign
                </Button>
              )}
            </>
          )}

          {/* Return for Rework — Head Office path only */}
          {isActionableStage && (
            <Button
              variant="outline"
              onClick={canReturn ? onOpenReturnForReworkDialog : undefined}
              disabled={isSaving || !canReturn}
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
              title={
                canReturn ? undefined : 'You do not have permission to return for rework'
              }
            >
              <Undo2 className="mr-2 h-4 w-4" /> Return for Rework
            </Button>
          )}
        </div>

        {/* RIGHT: admin */}
        <div className="flex flex-wrap gap-2 items-center">{SharedRightActions}</div>
      </div>
    </div>
  );
}