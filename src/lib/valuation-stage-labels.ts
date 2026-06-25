/** Human-readable display labels for ValuationQueue status values, matching the seeded WF-02 stage names. */
export const VALUATION_STAGE_LABELS: Record<string, string> = {
  PENDING: 'Valuation Department Director',
  ASSIGNED_TO_MANAGER: 'Valuation Maker Manager',
  ASSIGNED_TO_OFFICER: 'Valuation 01-A',
  ASSIGNED_TO_CHECKER_MANAGER: 'Checker Manager',
  ASSIGNED_TO_CHECKER_OFFICER: 'Valuation Checker 01-A',
  PENDING_CHECKER_REVIEW: 'Checker Manager Review',
  PENDING_FINALIZATION: 'Valuation Maker Manager (Final Valuation Stage)',
  COMPLETED: 'Completed',
};

export function valuationStageLabel(status: string): string {
  return VALUATION_STAGE_LABELS[status] ?? status.replace(/_/g, ' ');
}
