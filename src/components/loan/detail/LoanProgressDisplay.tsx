
'use client';

import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Clock } from 'lucide-react';

interface LoanProgressDisplayProps {
  loan: LoanRequest;
  progressPercentage: number;
  currentStageName: string; // Added
}

export function LoanProgressDisplay({ loan, progressPercentage, currentStageName }: LoanProgressDisplayProps) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-1">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">Loan Progress: {currentStageName}</Label>
        <span className="text-xs font-semibold text-primary">{progressPercentage.toFixed(0)}%</span>
      </div>
      <Progress value={progressPercentage} className="w-full h-3" />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>Submitted: {loan.submittedDate ? format(parseISO(loan.submittedDate), 'MMM dd, yyyy') : 'N/A'}</span>
        {loan.stageDeadline && (
          <span className={loan.isOverdue ? "text-destructive font-semibold" : ""}>
            <Clock className="inline h-3 w-3 mr-1" />
            Stage Deadline: {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}
            {loan.isOverdue && " (Overdue)"}
          </span>
        )}
      </div>
    </div>
  );
}
