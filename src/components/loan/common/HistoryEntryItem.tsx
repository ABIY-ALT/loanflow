
'use client';

import type { LoanHistoryEntry } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Undo2, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Generic color for history dots, stage specific color removed
const getHistoryDotColor = () => 'bg-primary';

interface HistoryEntryItemProps {
  entry: LoanHistoryEntry;
  onFulfillInfoRequest?: (entryId: string, requirementText: string, isFulfilling: boolean) => void;
  isSaving?: boolean;
}

export function HistoryEntryItem({
  entry,
  onFulfillInfoRequest,
  isSaving,
}: HistoryEntryItemProps) {
  const isFulfilled = entry.notes?.includes('[FULFILLED]');
  const isActiveInfoRequest = entry.requiredFulfilment && !isFulfilled;
  
  const originalNote = entry.notes?.replace(/\[FULFILLED\].*$/gm, '').trim();

  return (
    <div className="relative pl-6 pb-4 border-l border-border">
      <div className={`absolute -left-[0.30rem] top-1 w-2.5 h-2.5 rounded-full ${getHistoryDotColor()}`}></div>
      <p className="text-sm font-medium">{entry.stageName}</p>
      <p className="text-xs text-muted-foreground">
        {format(parseISO(entry.timestamp), 'MMM dd, yyyy, HH:mm')} by {entry.userName}
      </p>
      {originalNote && <p className="text-sm mt-1 bg-background p-2 rounded-md border whitespace-pre-wrap">{originalNote}</p>}
      
      {entry.requiredFulfilment && (
        <div className={cn(
          "text-sm mt-2 p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2",
          isActiveInfoRequest ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300' : 'border-green-500 bg-green-50 text-green-800 dark:border-green-400 dark:bg-green-900/30 dark:text-green-300'
        )}>
          <div className="flex-grow">
            <span className="font-semibold">{isActiveInfoRequest ? 'Pending Action:' : 'Fulfilled Action:'}</span> {entry.requiredFulfilment}
          </div>
          
          {/* Conditional rendering based on whether the onFulfillInfoRequest function is provided (i.e., user has permission) */}
          {onFulfillInfoRequest ? (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "w-full sm:w-auto",
                isActiveInfoRequest ? "border-amber-600 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-800 dark:hover:text-amber-200" : "border-green-600 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-400 dark:text-green-300 dark:hover:bg-green-800 dark:hover:text-green-200"
              )}
              onClick={() => onFulfillInfoRequest(entry.id, entry.requiredFulfilment!, !isFulfilled)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isFulfilled ? (
                <Undo2 className="mr-2 h-4 w-4" />
              ) : (
                <MessageSquare className="mr-2 h-4 w-4" />
              )}
              {isFulfilled ? 'Mark as Received' : 'Mark Information Received'}
            </Button>
          ) : isFulfilled && (
             <Badge className="bg-green-600 hover:bg-green-600 text-white">
                <BadgeCheck className="mr-2 h-4 w-4" />
                Completed
             </Badge>
          )}
        </div>
      )}
    </div>
  );
}
