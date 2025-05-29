
'use client';

import type { LoanRequest, LoanHistoryEntry } from '@/types/loan';
import { LoanStage } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare } from 'lucide-react';

const getStageColor = (stage: LoanStage) => {
  switch (stage) {
    case LoanStage.APPLICATION_SUBMITTED: return 'bg-sky-500';
    case LoanStage.DOCUMENT_COLLECTION: return 'bg-blue-500';
    case LoanStage.UNDER_REVIEW: return 'bg-indigo-500';
    case LoanStage.ADDITIONAL_INFO_REQUIRED: return 'bg-yellow-500 text-black';
    case LoanStage.APPROVED: return 'bg-green-500';
    case LoanStage.REJECTED: return 'bg-red-500';
    case LoanStage.FUNDS_DISBURSED: return 'bg-emerald-600';
    default: return 'bg-gray-500';
  }
};

interface HistoryEntryItemProps {
  entry: LoanHistoryEntry;
  loanCurrentStage: LoanStage;
  isActiveInfoRequest?: boolean;
  onFulfillInfoRequest?: (entryId: string, requirementText: string) => void;
  isSaving?: boolean;
}

export function HistoryEntryItem({
  entry,
  loanCurrentStage,
  isActiveInfoRequest,
  onFulfillInfoRequest,
  isSaving,
}: HistoryEntryItemProps) {
  return (
    <div className="relative pl-6 pb-4 border-l border-border">
      <div className={`absolute -left-[0.30rem] top-1 w-2.5 h-2.5 rounded-full ${getStageColor(entry.stage)}`}></div>
      <p className="text-sm font-medium">{entry.stage}</p>
      <p className="text-xs text-muted-foreground">
        {format(parseISO(entry.timestamp), 'MMM dd, yyyy, HH:mm')} by {entry.userName}
      </p>
      {entry.notes && <p className="text-sm mt-1 bg-background p-2 rounded-md border whitespace-pre-wrap">{entry.notes}</p>}
      {entry.requiredFulfilment && (
        <div className={`text-sm mt-1 p-2 rounded-md border ${isActiveInfoRequest ? 'border-amber-500 bg-amber-50 text-amber-700' : 'bg-muted/50'}`}>
          <span className="font-semibold">Required:</span> {entry.requiredFulfilment}
          {isActiveInfoRequest && onFulfillInfoRequest && entry.requiredFulfilment && loanCurrentStage === LoanStage.ADDITIONAL_INFO_REQUIRED && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full sm:w-auto border-amber-600 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
              onClick={() => onFulfillInfoRequest(entry.id, entry.requiredFulfilment!)}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
              Mark Information Received
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
