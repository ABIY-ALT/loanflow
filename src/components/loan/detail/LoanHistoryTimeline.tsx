
'use client';

import type { LoanRequest, LoanHistoryEntry } from '@/types/loan';
import { LoanStage } from '@/types/loan';
import { Clock } from 'lucide-react';
import { HistoryEntryItem } from '@/components/loan/common/HistoryEntryItem';

interface LoanHistoryTimelineProps {
  loan: LoanRequest;
  onFulfillInfoRequest: (entryId: string, requirementText: string) => Promise<void>;
  isSavingGlobal: boolean;
}

export function LoanHistoryTimeline({ loan, onFulfillInfoRequest, isSavingGlobal }: LoanHistoryTimelineProps) {
  const activeInfoRequestEntry = loan.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED
    ? [...loan.history]
        .reverse()
        .find(entry => entry.requiredFulfilment && (!entry.notes || !entry.notes.includes("[FULFILLED MOCK]")))
    : undefined;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" />History & Timeline</h3>
      {loan.history.length > 0 ? (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {loan.history.slice().reverse().map(entry => (
            <HistoryEntryItem
              key={entry.id}
              entry={entry}
              loanCurrentStage={loan.currentStage}
              isActiveInfoRequest={activeInfoRequestEntry?.id === entry.id && loan.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED}
              onFulfillInfoRequest={onFulfillInfoRequest}
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
