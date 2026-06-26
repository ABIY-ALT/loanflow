/** Human-readable display labels for ValuationQueue status values, matching the seeded WF-02 stage names. */
export const VALUATION_STAGE_LABELS: Record<string, string> = {
  PENDING: 'Valuation Director',
  ASSIGNED_TO_MANAGER: 'Valuation Maker',
  ASSIGNED_TO_OFFICER: 'Valuation 01-A',
  ASSIGNED_TO_CHECKER_MANAGER: 'Valuation Checker',
  ASSIGNED_TO_CHECKER_OFFICER: 'Valuation Checker 01-A',
  PENDING_CHECKER_REVIEW: 'Valuation Checker Review',
  PENDING_FINALIZATION: 'Valuation Finalization',
  PENDING_DIRECTOR_FINALIZATION: 'Valuation Director Finalization',
  COMPLETED: 'Completed',
};

export function valuationStageLabel(status: string): string {
  return VALUATION_STAGE_LABELS[status] ?? status.replace(/_/g, ' ');
}
