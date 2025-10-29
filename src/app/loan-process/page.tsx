
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { PlusCircle, AlertTriangle, Loader2, ArrowRight, Building, Eye, Users as UsersIcon, FileDigit } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

export default function LoanProcessPage() {
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [allLoans, setAllLoans] = useState<LoanRequest[]>([]);
  const [fetchedWorkflowDefinitions, setFetchedWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);

  const loansWithWorkflows = useMemo(() => {
    if (!allLoans.length || !fetchedWorkflowDefinitions.length) return [];
    
    return allLoans.map(loan => {
      const workflowDefinition = fetchedWorkflowDefinitions.find(def => def.id === loan.workflowDefinitionId);
      const workflowVersion = workflowDefinition?.versions.find(v => v.id === loan.workflowVersionId);
      
      if (!workflowVersion || !workflowDefinition) return null;

      // Group stages by department
      const stagesByDept = workflowVersion.stages.reduce((acc, stage) => {
        const dept = stage.responsibleDepartment;
        if (!acc[dept]) {
          acc[dept] = [];
        }
        acc[dept].push(stage);
        return acc;
      }, {} as Record<string, WorkflowStageDefinition[]>);


      return {
        loan,
        workflowDefinition,
        workflowVersion,
        stagesByDept,
      };
    }).filter(Boolean) as { loan: LoanRequest; workflowDefinition: WorkflowDefinition; workflowVersion: WorkflowVersion; stagesByDept: Record<string, WorkflowStageDefinition[]> }[];
  }, [allLoans, fetchedWorkflowDefinitions]);


  const getStageDefById = useCallback((versionId?: string, stageId?: string): WorkflowStageDefinition | null => {
    if (!versionId || !stageId || !fetchedWorkflowDefinitions) return null;
    for (const def of fetchedWorkflowDefinitions) {
      const version = def.versions.find(v => v.id === versionId);
      if (version) {
        const stage = version.stages.find(s => s.id === stageId);
        if (stage) return stage;
      }
    }
    return null;
  }, [fetchedWorkflowDefinitions]);


  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loansResult, wfResult] = await Promise.all([
        getLoanRequests(),
        getWorkflowDefinitions()
      ]);

      if (loansResult.error) { setError(prev => (prev ? `${prev}\nLoans: ${loansResult.error}` : `Loans: ${loansResult.error}`)); setAllLoans([]); }
      else if (loansResult.loans) {
        // Filter out terminal loans from this view
        setAllLoans(loansResult.loans.filter(l => !l.isTerminalStage));
      }
      else { setError(prev => (prev ? `${prev}\nLoans: No loan data received.` : `Loans: No loan data received.`)); setAllLoans([]); }

      if (wfResult.error) { setError(prev => (prev ? `${prev}\nWorkflows: ${wfResult.error}` : `Workflows: ${wfResult.error}`)); setFetchedWorkflowDefinitions([]); }
      else if (wfResult.workflows) { setFetchedWorkflowDefinitions(wfResult.workflows); }
      else { setError(prev => (prev ? `${prev}\nWorkflows: No workflow data received.` : `Workflows: No workflow data received.`)); setFetchedWorkflowDefinitions([]); }

    } catch (err: any) {
      setError(prev => (prev ? `${prev}\nFetchError: ${err.message || "Error fetching page data."}` : `FetchError: ${err.message || "Error fetching page data."}`));
      setAllLoans([]);
      setFetchedWorkflowDefinitions([]);
    }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchPageData(); }, [fetchPageData]);

  if (authLoading || isLoading) {
    return (<div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-3 text-lg">Loading loan pipelines & workflows...</p></div>);
  }
  if (error) { return (<Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertTriangle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescShadCN>{error}</AlertDescShadCN></Alert>); }

  if (loansWithWorkflows.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Pipeline</h1>
            <p className="text-muted-foreground">Visualize and manage loans through their lifecycle.</p>
          </div>
          {currentUser && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
            <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
          )}
        </div>
        <Card className="text-center py-10">
            <CardContent>
                <h3 className="text-xl font-semibold text-muted-foreground">No Active Loans</h3>
                <p className="text-muted-foreground">There are no active loans in the system to display in the pipeline.</p>
                 {currentUser && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
                    <Link href="/loan-requests/new" passHref><Button className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Start a New Loan Request</Button></Link>
                )}
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Pipeline</h1>
          <p className="text-muted-foreground">Expand a loan to view its complete workflow, grouped by department.</p>
        </div>
        {currentUser && userPermissions.has(PERMISSIONS.CREATE_LOAN_REQUEST) && (
           <Link href="/loan-requests/new" passHref><Button><PlusCircle className="mr-2 h-4 w-4" /> New Loan Request</Button></Link>
        )}
      </div>

      <Accordion type="multiple" className="w-full space-y-4">
        {loansWithWorkflows.map(({ loan, workflowVersion, stagesByDept, workflowDefinition }) => (
          <AccordionItem value={loan.id} key={loan.id} className="border-none">
             <Card className="shadow-sm hover:shadow-md transition-shadow">
                <AccordionTrigger className="hover:no-underline data-[state=open]:border-b-0 p-0">
                  <CardHeader className="flex flex-row justify-between items-center w-full p-4 hover:bg-muted/30 rounded-t-lg transition-colors">
                     <div className="text-left">
                        <CardTitle className="text-xl font-semibold text-primary flex items-center">
                          {loan.loanType}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          {loan.loanNumber} - {loan.customerName}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                          <Badge variant={loan.currentStageId === workflowVersion.stages[workflowVersion.stages.length - 1].id ? 'default' : 'secondary'}>
                            {getStageDefById(loan.workflowVersionId, loan.currentStageId)?.name || 'Unknown Stage'}
                          </Badge>
                      </div>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-semibold text-foreground">
                          Workflow: {workflowDefinition.name} (v{workflowVersion.versionNumber})
                        </h3>
                      </div>
                      {Object.entries(stagesByDept).map(([dept, stages]) => (
                        <div key={dept}>
                          <h4 className="text-lg font-semibold mb-2 flex items-center gap-2">
                             <Building className="h-5 w-5 text-muted-foreground"/>
                             Dept: {dept}
                          </h4>
                          <ScrollArea className="w-full whitespace-nowrap pb-4">
                            <div className="flex gap-4">
                              {stages.map((stageDef) => (
                                <div key={stageDef.id} className={cn("flex-shrink-0 w-72 rounded-lg p-3 min-h-[150px] border-2 flex flex-col", loan.currentStageId === stageDef.id ? 'border-primary bg-primary/5' : 'bg-muted/30')}>
                                  <div className="flex-grow">
                                      <div className="flex justify-between items-center mb-2 gap-2">
                                          <h5 className="font-semibold text-foreground truncate whitespace-normal">{stageDef.order + 1}. {stageDef.name}</h5>
                                          {loan.currentStageId === stageDef.id && <Badge>Current</Badge>}
                                      </div>
                                      <div className="p-2 text-sm text-muted-foreground space-y-1">
                                          <p><span className="font-semibold">Timeline:</span> {stageDef.defaultTimelineDays} days</p>
                                          <p><span className="font-semibold">Docs:</span> {stageDef.documentRequirements.length}</p>
                                      </div>
                                  </div>
                                  {loan.currentStageId === stageDef.id && (
                                    <div className="mt-auto pt-2">
                                      <p className="text-sm mb-2 flex items-center gap-1.5 text-foreground"><UsersIcon className="h-4 w-4"/>
                                        {loan.assignedToUsers.length > 0 ? loan.assignedToUsers.map(u => u.fullName).join(', ') : <span className="italic text-muted-foreground">Unassigned</span>}
                                      </p>
                                      <Link href={`/loan-requests/${loan.id}`} passHref>
                                        <Button variant="outline" size="sm" className="w-full">
                                          <Eye className="mr-2 h-4 w-4" /> View Details
                                        </Button>
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </div>
                      ))}
                    </CardContent>
                </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
