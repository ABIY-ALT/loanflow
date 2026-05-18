/** District TYPE-2 workflow helpers for analyst ↔ operation manager handoffs */

export function isAnalystReturnedFromManager(loan: {
  currentStageOrder?: number;
  currentStageStatus?: string | null;
}): boolean {
  return (
    loan.currentStageOrder === 6 &&
    (loan.currentStageStatus === 'RETURNED_FOR_COMMENT' ||
      loan.currentStageStatus === 'RETURNED_FOR_REWORK')
  );
}

/** Analyst may forward to Final Operation Manager only on first pass at stage 6 */
export function canAnalystSubmitToFinalManager(loan: {
  currentStageOrder?: number;
  currentStageStatus?: string | null;
}): boolean {
  return loan.currentStageOrder === 6 && !isAnalystReturnedFromManager(loan);
}

/** Case may be distributed to Committee Approval (stage 9) from analyst return or committee distribution */
export function canDistributeToDistrictApproval(loan: {
  submissionType?: string | null;
  currentStageOrder?: number;
  currentStageStatus?: string | null;
}): boolean {
  if (loan.submissionType !== 'TYPE2') return false;
  if (loan.currentStageOrder === 8) return true;
  return isAnalystReturnedFromManager(loan);
}
