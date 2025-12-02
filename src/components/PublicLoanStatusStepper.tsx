

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PublicLoanStatus } from '@/services/loan-service-prisma';
import {
  CheckCircle,
  CircleDashed,
  Loader,
  Building,
  Clock,
  Flag,
  CalendarCheck,
  FileClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface StepperProps {
  loanData: PublicLoanStatus & {
    workflowSequence: {
      stageId: string;
      stageName: string;
      stageTimelineDays: number;
      departmentName: string;
      entryDate?: string;
    }[];
  };
}

const getStatusIcon = (status: 'completed' | 'current' | 'pending') => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    case 'current':
      return <Loader className="h-6 w-6 text-blue-500 animate-spin" />;
    case 'pending':
      return <CircleDashed className="h-6 w-6 text-muted-foreground" />;
  }
};

export function PublicLoanStatusStepper({
  loanData,
}: StepperProps) {
  const {
    loanNumber,
    customerName,
    submittedDate,
    currentStageId,
    isTerminalStage,
    workflowSequence,
  } = loanData;
  const currentStageIndex = workflowSequence.findIndex(
    (item) => item.stageId === currentStageId
  );
  const totalTimeline = workflowSequence.reduce(
    (sum, item) => sum + item.stageTimelineDays,
    0
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-2">
            <div>
                <CardTitle>Loan Application for {customerName}</CardTitle>
                <CardDescription>Loan ID: {loanNumber}</CardDescription>
            </div>
             <div className="text-right">
                <p className="text-sm text-muted-foreground">Submitted On</p>
                <p className="font-semibold">{format(parseISO(submittedDate), 'PP')}</p>
             </div>
        </div>
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
            <h3 className="text-sm font-medium text-muted-foreground">ESTIMATED TOTAL PROCESSING TIME</h3>
            <p className="text-2xl font-bold text-primary">{totalTimeline} days</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {workflowSequence.map((item, index) => {
            const isCompleted = currentStageIndex > index;
            const isCurrent = currentStageIndex === index && !isTerminalStage;
            const isPending = currentStageIndex < index && !isTerminalStage;
            const status: 'completed' | 'current' | 'pending' = isCompleted
              ? 'completed'
              : isCurrent
              ? 'current'
              : 'pending';

            return (
              <div
                key={item.stageId}
                className={cn(
                  'relative pl-12 pb-8 transition-opacity duration-500',
                  { 'opacity-40': isPending }
                )}
              >
                {/* Vertical line connector */}
                {index < workflowSequence.length - 1 && (
                  <div className="absolute left-[1.1rem] top-2 h-full w-0.5 bg-border" />
                )}
                <div className="absolute left-0 top-0 flex items-center">
                  <div className="z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background border-2 border-border">
                    {getStatusIcon(status)}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="font-semibold text-lg flex items-center gap-2">
                    {isCompleted && (
                       <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>
                    )}
                     {isCurrent && (
                       <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Current Stage</Badge>
                    )}
                    <span>{item.stageName}</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Building className="h-4 w-4"/> {item.departmentName} Dept.</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4"/> Est. {item.stageTimelineDays} days</span>
                     {item.entryDate && (
                      <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                        <CalendarCheck className="h-4 w-4 text-green-600"/>
                        Entered: {format(parseISO(item.entryDate), 'dd MMM yyyy, HH:mm')}
                      </span>
                    )}
                  </div>
                   {isCurrent && loanData.currentStageStatus && (
                      <p className="text-sm pt-1"><span className="font-semibold">Status:</span> {loanData.currentStageStatus}</p>
                   )}
                </div>
              </div>
            );
          })}
           {isTerminalStage && (
             <div className="relative pl-12">
                <div className="absolute left-0 top-0 flex items-center">
                  <div className="z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background border-2 border-primary">
                    <Flag className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                    <h4 className="font-semibold text-lg text-primary">Process Completed</h4>
                    <p className="text-muted-foreground">This loan request has completed processing.</p>
                     {loanData.currentStageStatus && (
                         <Badge variant="default" className="mt-1">{loanData.currentStageStatus}</Badge>
                     )}
                </div>
            </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
