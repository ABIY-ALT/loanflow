

'use client';

import type { LoanRequest, LoanHistoryEntry } from '@/types/loan';
// Removed: import { LoanStage } from '@/types/loan';
import { Clock } from 'lucide-react';
import { HistoryEntryItem } from '@/components/loan/common/HistoryEntryItem';

interface LoanHistoryTimelineProps {
  loan: LoanRequest;
  onFulfillInfoRequest?: (entryId: string, requirementText: string, isFulfilling: boolean) => Promise<void>; // Made optional
  isSavingGlobal: boolean;
}

export function LoanHistoryTimeline({ loan, onFulfillInfoRequest, isSavingGlobal }: LoanHistoryTimelineProps) {
  // Logic to find active request is now handled inside HistoryEntryItem based on its own fulfilled status
    
  const isActionable = !loan.isTerminalStage;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" />History & Timeline</h3>
      {loan.history.length > 0 ? (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {loan.history.slice().reverse().map(entry => (
            <HistoryEntryItem
              key={entry.id}
              entry={entry}
              onFulfillInfoRequest={onFulfillInfoRequest && isActionable ? onFulfillInfoRequest : undefined}
              isSaving={isSavingGlobal}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No history entries for this loan yet.</p>
      )}
    </div>
  );
}
