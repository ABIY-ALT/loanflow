
'use client';

import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import type { LoanRequest } from '@/types/loan';
import { initialStageConfigs } from '@/app/settings/page'; // For progress calculation
import { LoanStage } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import { Clock } from 'lucide-react';

interface LoanProgressDisplayProps {
  loan: LoanRequest;
}

export function LoanProgressDisplay({ loan }: LoanProgressDisplayProps) {
  const currentStageEnum = loan.currentStage;
  let progressPercentage = 0;

  if (currentStageEnum === LoanStage.FUNDS_DISBURSED) {
      progressPercentage = 100;
  } else if (currentStageEnum === LoanStage.REJECTED) {
      let cumulativeWeight = 0;
      let rejectedFound = false;
      for (const stageCfg of initialStageConfigs) {
          if (stageCfg.loanStageEnum === LoanStage.REJECTED) {
              rejectedFound = true;
              break;
          }
          cumulativeWeight += Number(stageCfg.percentageWeight) || 0;
      }
      progressPercentage = rejectedFound ? cumulativeWeight : 0;
  } else {
      let cumulativeWeight = 0;
      let stageFoundInConfig = false;
      for (const stageCfg of initialStageConfigs) {
          cumulativeWeight += Number(stageCfg.percentageWeight) || 0;
          if (stageCfg.loanStageEnum === currentStageEnum) {
              stageFoundInConfig = true;
              break;
          }
      }
      progressPercentage = stageFoundInConfig ? cumulativeWeight : 0;
  }
  progressPercentage = Math.min(100, Math.max(0, progressPercentage));

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
