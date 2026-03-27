
'use client';

import type { LoanHistoryEntry } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquareReply, Clock, AlertCircle, BadgeCheck, User, Building, Shield } from 'lucide-react';
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
    <div className="relative pl-8 pb-10 border-l-2 border-border last:border-0 last:pb-0 ml-4">
      {/* Timeline Dot */}
      <div className={cn(
        "absolute -left-[0.55rem] top-0 w-4 h-4 rounded-full border-2 border-background shadow-sm z-10",
        isActiveInfoRequest ? "bg-amber-500 animate-pulse" : "bg-primary"
      )}></div>
      
      <div className="flex flex-col gap-3">
        {/* Header Metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
              {entry.stageName}
            </span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {entry.userName}
            </div>
            {entry.userRole && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1 font-bold bg-blue-50 text-blue-700 border-blue-200">
                <Shield className="h-2.5 w-2.5" />
                {entry.userRole}
              </Badge>
            )}
            {entry.userDepartment && (
              <Badge variant="outline" className="text-[10px] h-5 gap-1 font-bold bg-muted/30 text-muted-foreground">
                <Building className="h-2.5 w-2.5" />
                {entry.userDepartment}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {format(parseISO(entry.timestamp), 'MMM dd, yyyy • HH:mm:ss')}
          </div>
        </div>

        {/* Content Section */}
        <div className={cn(
          "p-4 rounded-lg border shadow-sm transition-all",
          isActiveInfoRequest 
            ? "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10 ring-1 ring-amber-200" 
            : "border-border bg-card hover:border-primary/30"
        )}>
          {entry.notes && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {entry.notes}
            </p>
          )}
          
          {entry.requiredFulfilment && (
            <div className={cn(
              "mt-4 p-4 rounded-md border-2 border-dashed flex flex-col gap-3",
              isActiveInfoRequest 
                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20" 
                : "border-green-400 bg-green-50 dark:bg-green-900/20"
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-1.5 rounded-full",
                  isActiveInfoRequest ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
                )}>
                  {isActiveInfoRequest ? <AlertCircle className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                </div>
                <div className="flex-1 space-y-1">
                  <p className={cn("text-xs font-black uppercase tracking-wider", isActiveInfoRequest ? "text-amber-800" : "text-green-800")}>
                    {isActiveInfoRequest ? 'Outstanding Action Required' : 'Action Requirement Fulfilled'}
                  </p>
                  <p className="text-sm font-bold leading-tight">{entry.requiredFulfilment}</p>
                </div>
              </div>

              {entry.fulfillmentNotes && (
                <div className="pl-10 py-2 border-t border-dashed border-muted-foreground/30 mt-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Response / Confirmation Details:</p>
                  <p className="text-sm font-medium text-foreground whitespace-pre-wrap bg-background/50 p-2 rounded italic">
                    "{entry.fulfillmentNotes}"
                  </p>
                </div>
              )}
              
              {onRespondToRequest && (
                <div className="pl-10">
                  <Button
                    size="sm"
                    variant={isActiveInfoRequest ? "default" : "outline"}
                    className={cn(
                      "h-8 text-xs font-bold px-4 shadow-sm",
                      isActiveInfoRequest ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-700" : "h-7"
                    )}
                    onClick={() => onRespondToRequest(entry)}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <MessageSquareReply className="mr-2 h-3.5 w-3.5" />}
                    {isActiveInfoRequest ? 'Provide Details / Resolve' : 'Update Response'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
