
'use client';

import React from 'react';
import type { LoanRequest, LoanHistoryEntry } from '@/types/loan';
import { HistoryEntryItem } from '@/components/loan/common/HistoryEntryItem';
import { 
  History, 
  BadgeCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AuditTrailProps {
  loan: LoanRequest;
  onRespondToRequest?: (entry: LoanHistoryEntry) => void;
  isSavingGlobal?: boolean;
}

export function LoanAuditTrail({ loan, onRespondToRequest, isSavingGlobal }: AuditTrailProps) {
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

      <div className="relative border-l-2 border-primary/20 ml-4 space-y-2 pb-4">
        {sortedHistory.map((entry) => (
          <HistoryEntryItem 
            key={entry.id} 
            entry={entry} 
            onRespondToRequest={onRespondToRequest}
            isSaving={isSavingGlobal}
          />
        ))}
      </div>
    </div>
  );
}
