

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { LoanRequest, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { PlusCircle, AlertTriangle, Loader2, ArrowRight, Building, Users as UsersIcon, FileDigit, ListFilter, KanbanSquare, ExternalLink, Flame, Clock, Search, AlertCircleIcon, XCircle, CheckCircle } from 'lucide-react';
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

interface PipelineLoan extends Pick<LoanRequest, 'id' | 'loanNumber' | 'customerName' | 'loanAmount' | 'isUrgent' | 'isOverdue' | 'lastUpdatedDate' | 'assignedToUsers' | 'loanType'> {}

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

type StatusFilter = 'all' | 'overdue' | 'terminated';


export default function LoanProcessPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [allLoans, setAllLoans] = useState<LoanRequest[]>([]);
  const [fetchedWorkflowDefinitions, setFetchedWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>([]);

  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);
  
  const loanStats = useMemo(() => {
    const totalCount = allLoans.length;
    const activeLoans = allLoans.filter(l => !l.isTerminalStage);
    const activeCount = activeLoans.length;
    const overdueCount = activeLoans.filter(l => l.isOverdue && !l.isTerminalStage).length;
    const terminatedCount = totalCount - activeCount;
    return { totalCount, activeCount, overdueCount, terminatedCount };
  }, [allLoans]);
  
  const loanOptions = useMemo(() => allLoans.map(loan => ({
    value: loan.loanNumber.toLowerCase(),
    label: `${loan.loanNumber} - ${loan.customerName}`,
  })), [allLoans]);

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
        setAllLoans(loansResult.loans); // Store all loans now
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

    let loansToDisplay: LoanRequest[];

    switch (statusFilter) {
        case 'overdue':
            loansToDisplay = allLoans.filter(l => l.isOverdue && !l.isTerminalStage);
            break;
        case 'terminated':
            loansToDisplay = allLoans.filter(l => l.isTerminalStage);
            break;
        case 'all':
        default:
            loansToDisplay = allLoans.filter(l => !l.isTerminalStage);
            break;
    }
    
    let filteredLoans = loansToDisplay;
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      filteredLoans = loansToDisplay.filter(loan =>
        loan.customerName.toLowerCase().includes(lowercasedFilter) ||
        loan.loanNumber.toLowerCase().includes(lowercasedFilter) ||
        loan.loanType.toLowerCase().includes(lowercasedFilter)
      );
    }

    const loansByStage: Record<string, PipelineLoan[]> = {};
    filteredLoans.forEach(loan => {
      const stageId = loan.currentStageId || 'unclassified';
      if (!loansByStage[stageId]) {
          loansByStage[stageId] = [];
      }
      loansByStage[stageId].push({
        id: loan.id,
        loanNumber: loan.loanNumber,
        customerName: loan.customerName,
        loanAmount: loan.loanAmount,
        isUrgent: loan.isUrgent,
        isOverdue: !!loan.isOverdue,
        lastUpdatedDate: loan.lastUpdatedDate,
        assignedToUsers: loan.assignedToUsers,
        loanType: loan.loanType,
      });
    });
    
    const loanTypesMap: Record<string, { loanTypeName: string, workflows: PipelineWorkflow[] }> = {};

    // First, initialize all loan types from definitions
    fetchedWorkflowDefinitions.forEach(wfDef => {
        if (!loanTypesMap[wfDef.loanTypeId]) {
            loanTypesMap[wfDef.loanTypeId] = {
                loanTypeName: wfDef.loanTypeName,
                workflows: []
            };
        }
    });

    // Then, populate workflows for each loan type
    for (const loanTypeId in loanTypesMap) {
        const workflowsForType = fetchedWorkflowDefinitions
            .filter(wf => wf.loanTypeId === loanTypeId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        workflowsForType.forEach(wfDef => {
            const activeVersion = wfDef.versions.find(v => v.isActive);
            if (!activeVersion) return; // Skip if no active version

            const stagesWithLoans: PipelineStage[] = activeVersion.stages.map(stage => ({
                ...stage,
                loans: loansByStage[stage.id] || [],
            }));

            // Only add the workflow to the map if it has stages.
            if (stagesWithLoans.length > 0) {
                 loanTypesMap[loanTypeId].workflows.push({
                    ...wfDef,
                    stages: stagesWithLoans,
                });
            }
        });
    }

    return Object.values(loanTypesMap);

  }, [allLoans, fetchedWorkflowDefinitions, searchTerm, statusFilter]);

  // Effect to set all accordion items to open by default when data loads or filters change
  useEffect(() => {
    if (pipelineData.length > 0) {
        const allItems = pipelineData.flatMap(p => [
            `loantype-${p.loanTypeName}`,
            ...p.workflows.map(w => `workflow-${w.id}`)
        ]);
        setOpenAccordionItems(allItems);
    } else {
        setOpenAccordionItems([]); // Clear open items if there's no data to display
    }
  }, [pipelineData, searchTerm, statusFilter]); // Re-evaluate when pipelineData is recalculated due to filter changes

  const filteredLoansCount = useMemo(() => {
    return pipelineData.reduce((total, loanType) => 
      total + loanType.workflows.reduce((wfTotal, wf) => 
        wfTotal + wf.stages.reduce((stageTotal, stage) => 
          stageTotal + stage.loans.length, 0), 0), 0);
  }, [pipelineData]);

  const getActiveFilterLabel = () => {
    switch (statusFilter) {
      case 'overdue': return `Overdue Loans (${loanStats.overdueCount})`;
      case 'terminated': return `Terminated Loans (${loanStats.terminatedCount})`;
      case 'all': default: return `Active Loans (${loanStats.activeCount})`;
    }
  };


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
            Loan Pipeline ({searchTerm ? `${filteredLoansCount} of ` : ''}{getActiveFilterLabel()})
          </h1>
          <div className="text-muted-foreground flex items-center gap-4 text-sm mt-1">
             <span>Click to filter by status:</span>
             <Button variant={statusFilter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setStatusFilter('all')} className={cn("h-auto px-2 py-1 flex items-center gap-1.5", statusFilter === 'all' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200')}>
                <CheckCircle className="h-4 w-4"/> {loanStats.activeCount} Active
             </Button>
             <Button variant={statusFilter === 'overdue' ? 'secondary' : 'ghost'} size="sm" onClick={() => setStatusFilter('overdue')} className={cn("h-auto px-2 py-1 flex items-center gap-1.5", statusFilter === 'overdue' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'text-amber-600 dark:text-amber-400')}>
                <AlertCircleIcon className="h-4 w-4"/> {loanStats.overdueCount} Overdue
             </Button>
             <Button variant={statusFilter === 'terminated' ? 'secondary' : 'ghost'} size="sm" onClick={() => setStatusFilter('terminated')} className={cn("h-auto px-2 py-1 flex items-center gap-1.5", statusFilter === 'terminated' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'text-red-600 dark:text-red-400')}>
                <XCircle className="h-4 w-4"/> {loanStats.terminatedCount} Terminated
             </Button>
          </div>
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
              placeholder="Search by name, loan #, or type..."
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
                {searchTerm ? 'No Loans Match Your Filter' : `No ${statusFilter} Loans`}
              </h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term.' : `There are no loans matching the selected status.`}
              </p>
               {currentUser && !searchTerm && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
                  <Link href="/loan-requests/new" passHref><Button className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Start a New Loan Request</Button></Link>
              )}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4" value={openAccordionItems} onValueChange={setOpenAccordionItems}>
          {pipelineData.map(({ loanTypeName, workflows }) => (
            <AccordionItem value={`loantype-${loanTypeName}`} key={`loantype-${loanTypeName}`} className="border-none">
              <Card className="shadow-sm">
                <AccordionTrigger className="hover:no-underline p-0 data-[state=open]:border-b">
                   <CardHeader className="flex flex-row justify-between items-center w-full p-4 hover:bg-muted/30 rounded-t-lg transition-colors">
                     <CardTitle className="text-xl font-semibold text-primary">{loanTypeName}</CardTitle>
                     <Badge variant="secondary">{workflows.reduce((sum, wf) => sum + wf.stages.reduce((s, st) => s + st.loans.length, 0), 0)} Matching Loans</Badge>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent className="p-4 space-y-4">
                  <Accordion type="multiple" className="w-full space-y-3" value={openAccordionItems} onValueChange={setOpenAccordionItems}>
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
                                {workflow.stages.map(stage => {
                                  const stageHasVisibleLoans = stage.loans.length > 0;
                                  if (!stageHasVisibleLoans && statusFilter !== 'all' && !searchTerm) {
                                      // If filtering, don't show empty stages
                                      return null;
                                  }
                                  return (
                                    <div key={stage.id} className="p-3 border rounded-md bg-background">
                                      <h5 className="font-medium text-sm mb-2 flex items-center justify-between">
                                        <span>{stage.order + 1}. {stage.name}</span>
                                        <span className="text-xs text-muted-foreground">({stage.loans.length} loans)</span>
                                      </h5>
                                       {stage.loans.length > 0 && (
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
                                       )}
                                    </div>
                                  );
                                })}
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
