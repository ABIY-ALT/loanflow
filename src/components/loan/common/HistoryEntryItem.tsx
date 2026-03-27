
'use client';

import type { LoanHistoryEntry } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Undo2, BadgeCheck, MessageSquareReply, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Generic color for history dots
const getHistoryDotColor = () => 'bg-primary';

interface HistoryEntryItemProps {
  entry: LoanHistoryEntry;
  onRespondToRequest?: (entry: LoanHistoryEntry) => void;
  isSaving?: boolean;
}

export function HistoryEntryItem({
  entry,
  onRespondToRequest,
  isSaving,
}: HistoryEntryItemProps) {
  const isFulfilled = entry.isFulfilled;
  const isActiveInfoRequest = entry.requiredFulfilment && !isFulfilled;

  return (
    <div className="relative pl-6 pb-6 border-l border-border last:border-0">
      <div className={`absolute -left-[0.30rem] top-1 w-2.5 h-2.5 rounded-full ${getHistoryDotColor()}`}></div>
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <p className="text-sm font-bold text-primary">{entry.stageName}</p>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(parseISO(entry.timestamp), 'MMM dd, yyyy, HH:mm')}
        </span>
      </div>
      
      <p className="text-xs text-muted-foreground mb-2 font-medium">
        Action by: {entry.userName} {entry.userRole ? `(${entry.userRole})` : ''}
      </p>

      {entry.notes && (
        <p className="text-sm bg-background p-2.5 rounded-md border border-dashed border-border whitespace-pre-wrap mb-3 italic text-foreground/80">
          {entry.notes}
        </p>
      )}
      
      {entry.requiredFulfilment && (
        <div className={cn(
          "text-sm p-4 rounded-xl border shadow-sm space-y-3",
          isActiveInfoRequest 
            ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10' 
            : 'border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-900/10'
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "mt-0.5 p-1.5 rounded-full",
              isActiveInfoRequest ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
            )}>
              {isActiveInfoRequest ? <MessageSquare className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <p className={cn("text-[10px] uppercase font-bold tracking-wider mb-0.5", isActiveInfoRequest ? "text-amber-700" : "text-green-700")}>
                {isActiveInfoRequest ? 'Outstanding Requirement' : 'Fulfilled Requirement'}
              </p>
              <p className="font-semibold text-foreground">{entry.requiredFulfilment}</p>
            </div>
          </div>

          {entry.fulfillmentNotes && (
            <div className="pl-9 pt-2 border-t border-dashed border-muted-foreground/20">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Response / Result:</p>
              <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{entry.fulfillmentNotes}</p>
            </div>
          )}
          
          {onRespondToRequest && (
            <div className="pl-9 pt-2">
              <Button
                size="sm"
                variant={isActiveInfoRequest ? "default" : "outline"}
                className={cn(
                  "h-8 text-xs font-bold",
                  isActiveInfoRequest ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                )}
                onClick={() => onRespondToRequest(entry)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <MessageSquareReply className="mr-2 h-3 w-3" />
                )}
                {isActiveInfoRequest ? 'Respond to Request' : 'Edit Response'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
