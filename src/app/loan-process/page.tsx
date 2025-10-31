
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { LoanRequest, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { PlusCircle, AlertTriangle, Loader2, ArrowRight, Building, Users as UsersIcon, FileDigit, ListFilter, KanbanSquare, ExternalLink, Flame, Clock, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLoanRequests, getWorkflowDefinitions } from '@/services/loan-service-prisma';
import { Alert, AlertDescription as AlertDescShadCN, AlertTitle as AlertTitleShadCN } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';

interface PipelineLoan extends Pick<LoanRequest, 'id' | 'loanNumber' | 'customerName' | 'loanAmount' | 'isUrgent' | 'isOverdue' | 'lastUpdatedDate' | 'assignedToUsers'> {}

interface PipelineStage extends WorkflowStageDefinition {
  loans: PipelineLoan[];
}

interface PipelineWorkflow extends WorkflowDefinition {
  stages: PipelineStage[];
}

interface PipelineLoanType {
  loanTypeName: string;
  workflows: PipelineWorkflow[];
}

export default function LoanProcessPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [allLoans, setAllLoans] = useState<LoanRequest[]>([]);
  const [fetchedWorkflowDefinitions, setFetchedWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);
  
  const loanOptions = useMemo(() => allLoans.map(loan => ({
    value: loan.loanNumber.toLowerCase(),
    label: `${loan.loanNumber} - ${loan.customerName}`,
  })), [allLoans]);
  
  const totalActiveLoans = useMemo(() => {
    return allLoans.filter(l => !l.isTerminalStage).length;
  }, [allLoans]);

  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loansResult, wfResult] = await Promise.all([
        getLoanRequests(),
        getWorkflowDefinitions()
      ]);

      if (loansResult.error) { setError(prev => (prev ? `${prev}\nLoans: ${loansResult.error}` : `Loans: ${loansResult.error}`)); }
      else if (loansResult.loans) {
        setAllLoans(loansResult.loans.filter(l => !l.isTerminalStage));
      }

      if (wfResult.error) { setError(prev => (prev ? `${prev}\nWorkflows: ${wfResult.error}` : `Workflows: ${wfResult.error}`)); }
      else if (wfResult.workflows) { setFetchedWorkflowDefinitions(wfResult.workflows); }

    } catch (err: any) {
      setError(prev => (prev ? `${prev}\nFetchError: ${err.message || "Error fetching page data."}` : `FetchError: ${err.message || "Error fetching page data."}`));
    }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchPageData(); }, [fetchPageData]);
  
  const pipelineData = useMemo(() => {
    if (!fetchedWorkflowDefinitions.length) return [];

    let filteredLoans = allLoans;
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filteredLoans = allLoans.filter(loan =>
        loan.customerName.toLowerCase().includes(lowercasedFilter) ||
        loan.loanNumber.toLowerCase().includes(lowercasedFilter)
      );
    }

    const loansByStage: Record<string, PipelineLoan[]> = {};
    filteredLoans.forEach(loan => {
      if (loan.currentStageId) {
        if (!loansByStage[loan.currentStageId]) {
          loansByStage[loan.currentStageId] = [];
        }
        loansByStage[loan.currentStageId].push({
          id: loan.id,
          loanNumber: loan.loanNumber,
          customerName: loan.customerName,
          loanAmount: loan.loanAmount,
          isUrgent: loan.isUrgent,
          isOverdue: !!loan.isOverdue,
          lastUpdatedDate: loan.lastUpdatedDate,
          assignedToUsers: loan.assignedToUsers,
        });
      }
    });

    const workflowsByLoanType = fetchedWorkflowDefinitions.reduce((acc, wfDef) => {
      const activeVersion = wfDef.versions.find(v => v.isActive);
      if (!activeVersion || activeVersion.stages.length === 0) return acc;
      
      if (!acc[wfDef.loanTypeName]) {
        acc[wfDef.loanTypeName] = [];
      }

      const stagesWithLoans: PipelineStage[] = activeVersion.stages.map(stage => ({
        ...stage,
        loans: loansByStage[stage.id] || [],
      }));

      // Only include workflows that have loans after filtering
      if (stagesWithLoans.some(s => s.loans.length > 0)) {
          acc[wfDef.loanTypeName].push({
            ...wfDef,
            stages: stagesWithLoans,
          });
      }

      return acc;
    }, {} as Record<string, PipelineWorkflow[]>);

    return Object.entries(workflowsByLoanType).map(([loanTypeName, workflows]) => ({
      loanTypeName,
      workflows,
    })).filter(loanType => loanType.workflows.length > 0); // Only include loan types that have workflows with loans
  }, [allLoans, fetchedWorkflowDefinitions, searchTerm]);

  const filteredLoansCount = useMemo(() => {
    return pipelineData.reduce((total, loanType) => 
      total + loanType.workflows.reduce((wfTotal, wf) => 
        wfTotal + wf.stages.reduce((stageTotal, stage) => 
          stageTotal + stage.loans.length, 0), 0), 0);
  }, [pipelineData]);


  if (authLoading || isLoading) {
    return (<div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-3 text-lg">Loading loan pipeline...</p></div>);
  }
  if (error) { return (<Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertTriangle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescShadCN>{error}</AlertDescShadCN></Alert>); }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <KanbanSquare className="mr-3 h-8 w-8 text-primary" />
            Loan Pipeline ({searchTerm ? `${filteredLoansCount} of ` : ''}{totalActiveLoans})
          </h1>
          <p className="text-muted-foreground">Hierarchical view of all active loans by type, workflow, and stage.</p>
        </div>
         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Combobox
              options={loanOptions}
              value={searchTerm}
              onSelect={(currentValue) => {
                const loan = allLoans.find(l => l.loanNumber.toLowerCase() === currentValue);
                setSearchTerm(loan ? loan.loanNumber : '');
              }}
              onInputChange={(inputValue) => {
                setSearchTerm(inputValue);
              }}
              placeholder="Search or jump to loan..."
              searchPlaceholder="Filter by loan # or name..."
              notFoundText="No loan found."
              className="w-full sm:w-[300px]"
            />
          {currentUser && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
            <Link href="/loan-requests/new" passHref><Button className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> New Loan</Button></Link>
          )}
        </div>
      </div>

      {pipelineData.length === 0 && !isLoading ? (
        <Card className="text-center py-10">
          <CardContent>
              <h3 className="text-xl font-semibold text-muted-foreground">
                {searchTerm ? 'No Loans Match Your Filter' : 'No Active Loans or Workflows'}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term.' : 'There are no active loans, or no workflows with active versions are configured.'}
              </p>
               {currentUser && !searchTerm && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
                  <Link href="/loan-requests/new" passHref><Button className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Start a New Loan Request</Button></Link>
              )}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={pipelineData.map(p => `loantype-${p.loanTypeName}`)}>
          {pipelineData.map(({ loanTypeName, workflows }) => (
            <AccordionItem value={`loantype-${loanTypeName}`} key={`loantype-${loanTypeName}`} className="border-none">
              <Card className="shadow-sm">
                <AccordionTrigger className="hover:no-underline p-0 data-[state=open]:border-b">
                   <CardHeader className="flex flex-row justify-between items-center w-full p-4 hover:bg-muted/30 rounded-t-lg transition-colors">
                     <CardTitle className="text-xl font-semibold text-primary">{loanTypeName}</CardTitle>
                     <Badge variant="secondary">{workflows.reduce((sum, wf) => sum + wf.stages.reduce((s, st) => s + st.loans.length, 0), 0)} Active Loans</Badge>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent className="p-4 space-y-4">
                  <Accordion type="multiple" className="w-full space-y-3" defaultValue={workflows.map(w => `workflow-${w.id}`)}>
                    {workflows.map(workflow => (
                      <AccordionItem value={`workflow-${workflow.id}`} key={`workflow-${workflow.id}`} className="border-b-0">
                         <Card className="bg-muted/30">
                           <AccordionTrigger className="hover:no-underline p-0 data-[state=open]:border-b">
                              <CardHeader className="flex flex-row justify-between items-center w-full p-3 rounded-t-md hover:bg-background/50">
                                <div>
                                  <h4 className="font-semibold">{workflow.name}</h4>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building className="h-3 w-3" /> Dept: {workflow.departmentName}</p>
                                </div>
                                <Badge variant="outline">{workflow.stages.reduce((sum, st) => sum + st.loans.length, 0)} Loans</Badge>
                              </CardHeader>
                           </AccordionTrigger>
                           <AccordionContent className="p-3">
                              <div className="space-y-3">
                                {workflow.stages.map(stage => (
                                  stage.loans.length > 0 && (
                                    <div key={stage.id}>
                                      <h5 className="font-medium text-sm mb-2 flex items-center justify-between">
                                        <span>{stage.order + 1}. {stage.name}</span>
                                        <span className="text-xs font-normal text-muted-foreground">({stage.loans.length} loans)</span>
                                      </h5>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {stage.loans.map(loan => (
                                          <Card key={loan.id} className={cn("bg-background shadow-sm hover:shadow-md transition-shadow", loan.isUrgent && "border-2 border-destructive")}>
                                            <CardContent className="p-3 space-y-2">
                                              <div className="flex justify-between items-start">
                                                <p className="font-semibold text-sm truncate pr-2">{loan.customerName}</p>
                                                {loan.isUrgent && <Flame className="h-4 w-4 text-destructive shrink-0" />}
                                              </div>
                                              <p className="text-xs text-muted-foreground">{loan.loanNumber}</p>
                                              <div className="text-xs text-muted-foreground flex items-center justify-between pt-1">
                                                 <span className={cn("flex items-center gap-1", loan.isOverdue && "text-destructive font-semibold")}>
                                                   <Clock className="h-3 w-3"/>
                                                   {formatDistanceToNow(parseISO(loan.lastUpdatedDate), { addSuffix: true })}
                                                 </span>
                                                 <Link href={`/loan-requests/${loan.id}`} passHref>
                                                   <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                                     View <ExternalLink className="ml-1 h-3 w-3" />
                                                   </Button>
                                                 </Link>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                ))}
                              </div>
                           </AccordionContent>
                         </Card>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
