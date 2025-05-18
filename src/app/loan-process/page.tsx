'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { LoanRequest } from '@/types/loan';
import { loanStages, LoanStage } from '@/types/loan';
import { mockLoanRequests } from '@/lib/mock-data';
import { PlusCircle, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

// Dummy DND context and hooks - replace with actual library if needed
const DndContext = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
const useDraggable = (id: string) => ({ attributes: {}, listeners: {}, setNodeRef: null, isDragging: false });
const useDroppable = (id: LoanStage) => ({ setNodeRef: null, isOver: false });


interface LoanCardProps {
  loan: LoanRequest;
}

function LoanCard({ loan }: LoanCardProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable(loan.id);
  const style = {
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-3 cursor-grab active:cursor-grabbing shadow-md hover:shadow-lg transition-shadow"
    >
      <CardHeader className="p-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base font-semibold">
            <Link href={`/loan-requests/${loan.id}`} className="hover:underline">
              {loan.customerName}
            </Link>
          </CardTitle>
          {loan.isOverdue && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>This loan process is overdue.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <CardDescription className="text-xs">{loan.loanNumber} / {loan.customerNumber}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 text-sm space-y-2">
        <p>Amount: ${loan.loanAmount.toLocaleString()}</p>
        <p>Type: {loan.loanType}</p>
        {loan.stageDeadline && (
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Deadline: {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}
          </div>
        )}
        {loan.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED && loan.history.find(h => h.stage === LoanStage.ADDITIONAL_INFO_REQUIRED)?.requiredFulfilment && (
          <Badge variant="outline" className="mt-2 text-amber-700 border-amber-500">
            Action Needed: {loan.history.find(h => h.stage === LoanStage.ADDITIONAL_INFO_REQUIRED)?.requiredFulfilment}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"


interface KanbanColumnProps {
  stage: LoanStage;
  loans: LoanRequest[];
}

function KanbanColumn({ stage, loans }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable(stage);
  const style = {
    backgroundColor: isOver ? 'hsl(var(--accent)/0.1)' : undefined,
    minHeight: '300px'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 w-80 bg-muted/50 rounded-lg p-1 md:p-2"
    >
      <div className="flex justify-between items-center p-2 mb-2">
        <h3 className="font-semibold text-foreground">{stage}</h3>
        <Badge variant="secondary">{loans.length}</Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-20rem)] pr-2"> {/* Adjust height as needed */}
        {loans.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground p-4 text-center">
            <p>No loan requests in this stage.</p>
          </div>
        )}
        {loans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} />
        ))}
      </ScrollArea>
    </div>
  );
}

export default function LoanProcessPage() {
  // In a real app, this would come from state management or API
  const loansByStage = (stage: LoanStage) =>
    mockLoanRequests.filter((loan) => loan.currentStage === stage);

  // DND handlers would be implemented here
  // const handleDragEnd = (event: any) => { ... }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Pipeline</h1>
          <p className="text-muted-foreground">
            Visualize and manage loan applications through various stages.
          </p>
        </div>
        <Link href="/loan-requests/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> New Loan Request
          </Button>
        </Link>
      </div>
      
      <DndContext onDragEnd={() => {/* handleDragEnd */}}>
        <ScrollArea className="w-full whitespace-nowrap pb-4">
          <div className="flex gap-4">
            {loanStages.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                loans={loansByStage(stage)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DndContext>
    </div>
  );
}
