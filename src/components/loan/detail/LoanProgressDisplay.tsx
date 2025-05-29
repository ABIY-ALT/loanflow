
'use client';

import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Clock } from 'lucide-react';

interface LoanProgressDisplayProps {
  loan: LoanRequest;
  progressPercentage: number; // Accept pre-calculated percentage
}

export function LoanProgressDisplay({ loan, progressPercentage }: LoanProgressDisplayProps) {
  return (
    <div className="mb-6">
      <Label className="text-xs font-semibold uppercase text-muted-foreground">Loan Progress</Label>
      <Progress value={progressPercentage} className="w-full mt-1 h-3" />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>Submitted: {format(parseISO(loan.submittedDate), 'MMM dd, yyyy')}</span>
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

    