
'use client';

import React from 'react';
import type { LoanRequest, LoanHistoryEntry } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { 
  History, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ArrowDownCircle,
  Undo2,
  ShieldX,
  Shuffle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AuditTrailProps {
  loan: LoanRequest;
}

const getActionIcon = (notes?: string) => {
  const n = notes?.toLowerCase() || '';
  if (n.includes('submitted')) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (n.includes('promoted') || n.includes('approve')) return <ArrowRight className="h-4 w-4 text-blue-500" />;
  if (n.includes('rework')) return <Undo2 className="h-4 w-4 text-amber-500" />;
  if (n.includes('terminate')) return <ShieldX className="h-4 w-4 text-destructive" />;
  if (n.includes('manual transition')) return <Shuffle className="h-4 w-4 text-purple-500" />;
  if (n.includes('info request')) return <AlertCircle className="h-4 w-4 text-orange-500" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
};

export function LoanAuditTrail({ loan }: AuditTrailProps) {
  const sortedHistory = [...loan.history].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          Detailed Case Audit Trail
        </h3>
        <Badge variant="outline" className="text-muted-foreground">
          {sortedHistory.length} Recorded Actions
        </Badge>
      </div>

      <div className="relative border-l-2 border-primary/20 ml-4 space-y-8 pb-4">
        {sortedHistory.map((entry, index) => {
          const nextEntry = sortedHistory[index + 1];
          const hasStageChange = nextEntry && nextEntry.stageName !== entry.stageName;

          return (
            <div key={entry.id} className="relative pl-10 group">
              {/* Timeline Dot */}
              <div className="absolute -left-[11px] top-1.5 flex items-center justify-center">
                <div className="h-5 w-5 rounded-full bg-background border-2 border-primary group-hover:scale-110 transition-transform flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
              </div>

              <div className="bg-card border rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="bg-muted/30 px-4 py-3 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-primary font-mono">
                      {format(parseISO(entry.timestamp), 'MMM dd, yyyy HH:mm')}
                    </span>
                    <Badge variant="secondary" className="font-semibold bg-background">
                      {entry.stageName}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{entry.userName}</span>
                    {entry.userRole && (
                      <span className="text-muted-foreground">({entry.userRole})</span>
                    )}
                    {entry.userDepartment && (
                      <Badge variant="outline" className="text-[10px] uppercase h-5">
                        {entry.userDepartment}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 rounded-lg bg-primary/5">
                      {getActionIcon(entry.notes)}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {entry.notes || 'No description provided for this action.'}
                      </p>
                      
                      {entry.requiredFulfilment && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-medium text-amber-800 dark:text-amber-300">
                          <p className="uppercase text-[10px] mb-1 opacity-70">Requirement Logged:</p>
                          {entry.requiredFulfilment}
                        </div>
                      )}

                      {hasStageChange && (
                        <div className="flex items-center gap-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <span>{nextEntry.stageName}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-primary">{entry.stageName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
