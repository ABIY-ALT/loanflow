
'use client';

import type { LoanHistoryEntry } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare } from 'lucide-react';

// Generic color for history dots, stage specific color removed
const getHistoryDotColor = () => 'bg-primary';

interface HistoryEntryItemProps {
  entry: LoanHistoryEntry;
  isActiveInfoRequest?: boolean;
  onFulfillInfoRequest?: (entryId: string, requirementText: string) => void;
  isSaving?: boolean;
  isViewOnly?: boolean; // New prop
}

export function HistoryEntryItem({
  entry,
  isActiveInfoRequest,
  onFulfillInfoRequest,
  isSaving,
  isViewOnly, // Use new prop
}: HistoryEntryItemProps) {
  return (
    <div className="relative pl-6 pb-4 border-l border-border">
      <div className={`absolute -left-[0.30rem] top-1 w-2.5 h-2.5 rounded-full ${getHistoryDotColor()}`}></div>
      <p className="text-sm font-medium">{entry.stageName}</p>
      <p className="text-xs text-muted-foreground">
        {format(parseISO(entry.timestamp), 'MMM dd, yyyy, HH:mm')} by {entry.userName}
      </p>
      {entry.notes && <p className="text-sm mt-1 bg-background p-2 rounded-md border whitespace-pre-wrap">{entry.notes}</p>}
      {entry.requiredFulfilment && (
        <div className={`text-sm mt-1 p-2 rounded-md border ${isActiveInfoRequest ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-muted/50'}`}>
          <span className="font-semibold">Required:</span> {entry.requiredFulfilment}
          {isActiveInfoRequest && onFulfillInfoRequest && entry.requiredFulfilment && !isViewOnly && ( // Check isViewOnly
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full sm:w-auto border-amber-600 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-800 dark:hover:text-amber-200"
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

