
'use client';

import type { LoanHistoryEntry } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, BadgeCheck, MessageSquareReply, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="relative pl-6 pb-8 border-l border-border last:border-0">
      <div className={cn(
        "absolute -left-[0.35rem] top-1 w-3 h-3 rounded-full border-2 border-background shadow-sm",
        isActiveInfoRequest ? "bg-amber-500 animate-pulse" : "bg-primary"
      )}></div>
      
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-primary uppercase tracking-tight">{entry.stageName}</p>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(parseISO(entry.timestamp), 'HH:mm')}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground font-medium">
          {format(parseISO(entry.timestamp), 'MMM dd, yyyy')} • {entry.userName}
        </p>
      </div>

      {entry.notes && (
        <p className="text-xs bg-muted/30 p-2 rounded border border-dashed whitespace-pre-wrap mb-3 italic">
          {entry.notes}
        </p>
      )}
      
      {entry.requiredFulfilment && (
        <div className={cn(
          "text-sm p-3 rounded-lg border shadow-sm space-y-2",
          isActiveInfoRequest 
            ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20' 
            : 'border-green-300 bg-green-50 dark:bg-green-900/20'
        )}>
          <div className="flex items-start gap-2">
            <div className={cn(
              "mt-0.5 p-1 rounded-full",
              isActiveInfoRequest ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
            )}>
              {isActiveInfoRequest ? <AlertCircle className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1">
              <p className={cn("text-[10px] uppercase font-bold tracking-wider", isActiveInfoRequest ? "text-amber-700" : "text-green-700")}>
                {isActiveInfoRequest ? 'Outstanding Requirement' : 'Requirement Received'}
              </p>
              <p className="font-semibold text-xs leading-snug">{entry.requiredFulfilment}</p>
            </div>
          </div>

          {entry.fulfillmentNotes && (
            <div className="pl-7 pt-1 border-t border-dashed border-muted-foreground/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Response:</p>
              <p className="text-xs font-medium text-foreground whitespace-pre-wrap">{entry.fulfillmentNotes}</p>
            </div>
          )}
          
          {onRespondToRequest && (
            <div className="pl-7 pt-1">
              <Button
                size="sm"
                variant={isActiveInfoRequest ? "default" : "outline"}
                className={cn(
                  "h-7 text-[10px] font-bold px-3",
                  isActiveInfoRequest ? "bg-amber-600 hover:bg-amber-700 text-white" : "h-6"
                )}
                onClick={() => onRespondToRequest(entry)}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <MessageSquareReply className="mr-1.5 h-3 w-3" />}
                {isActiveInfoRequest ? 'Provide Details' : 'Edit Response'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
