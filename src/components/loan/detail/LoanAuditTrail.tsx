
'use client';

import React from 'react';
import type { LoanRequest, LoanHistoryEntry } from '@/types/loan';
import { HistoryEntryItem } from '@/components/loan/common/HistoryEntryItem';
import { 
  History, 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AuditTrailProps {
  loan: LoanRequest;
  onRespondToRequest?: (entry: LoanHistoryEntry) => void;
  isSavingGlobal?: boolean;
  isRestricted?: boolean;
}

export function LoanAuditTrail({ loan, onRespondToRequest, isSavingGlobal, isRestricted }: AuditTrailProps) {
  const sortedHistory = [...loan.history].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight">Loan Lifecycle Audit Trail</h3>
            <p className="text-sm text-muted-foreground font-medium">
              {isRestricted ? 'Chronological record of stage movements and process status.' : 'A complete, high-fidelity chronological record of all system and user activities.'}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="px-3 py-1 font-bold">
          {sortedHistory.length} Total Events
        </Badge>
      </div>

      <div className="max-w-5xl">
        {sortedHistory.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed rounded-xl bg-muted/5">
            <History className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-bold text-muted-foreground">No history entries found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedHistory.map((entry) => (
              <HistoryEntryItem 
                key={entry.id} 
                entry={entry} 
                onRespondToRequest={onRespondToRequest}
                isSaving={isSavingGlobal}
                isRestricted={isRestricted}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
