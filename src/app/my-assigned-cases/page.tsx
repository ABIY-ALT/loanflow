
'use client';

import Link from 'next/link';
import { ArrowLeft, ClipboardUser, ExternalLink, Loader2, AlertCircle, Building, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests, getWorkflowDefinitions } from '@/services/loan-service';
import type { LoanRequest, WorkflowDefinition } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useCallback } from 'react';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { mockUsers } from '@/lib/mock-data'; // For mock user details

// SIMULATED LOGGED-IN USER - REPLACE WITH ACTUAL AUTHENTICATION
const MOCK_LOGGED_IN_USER_ID = 'user-jane-doe'; // e.g., Jane Doe from mockUsers
const MOCK_LOGGED_IN_USER_NAME = mockUsers.find(u => u.id === MOCK_LOGGED_IN_USER_ID)?.name || 'Mock User';

export default function MyAssignedCasesPage() {
  const [assignedLoans, setAssignedLoans] = useState<LoanRequest[]>([]);
  const [fetchedWorkflowDefinitions, setFetchedWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getStageName = useCallback((workflowVersionId?: string, stageId?: string): string => {
    if (!workflowVersionId || !stageId || !fetchedWorkflowDefinitions) return "Unknown Stage";
    for (const def of fetchedWorkflowDefinitions) {
      const version = def.versions.find(v => v.id === workflowVersionId);
      if (version) {
        const stage = version.stages.find(s => s.id === stageId);
        if (stage) return stage.name;
      }
    }
    return "Unknown Stage";
  }, [fetchedWorkflowDefinitions]);

  const getDepartmentFromStage = useCallback((workflowVersionId?: string, stageId?: string): string => {
    if (!workflowVersionId || !stageId || !fetchedWorkflowDefinitions) return "N/A";
    for (const def of fetchedWorkflowDefinitions) {
      const version = def.versions.find(v => v.id === workflowVersionId);
      if (version) {
        const stage = version.stages.find(s => s.id === stageId);
        if (stage) return stage.responsibleDepartment;
      }
    }
    return "N/A";
  }, [fetchedWorkflowDefinitions]);


  useEffect(() => {
    async function fetchPageData() {
      setIsLoading(true);
      setError(null);
      try {
        const [loansResult, wfResult] = await Promise.all([
          getLoanRequests(),
          getWorkflowDefinitions()
        ]);

        if (loansResult.error) {
          setError(prev => (prev ? `${prev}\nLoans: ${loansResult.error}` : `Loans: ${loansResult.error}`));
          setAssignedLoans([]);
        } else if (loansResult.loans) {
          const filteredLoans = loansResult.loans.filter(loan =>
            loan.assignedTo === MOCK_LOGGED_IN_USER_ID && !loan.isReadyForManagerReview
          );
          setAssignedLoans(filteredLoans);
        } else {
           setError(prev => (prev ? `${prev}\nLoans: No loan data received.` : `Loans: No loan data received.`));
           setAssignedLoans([]);
        }

        if (wfResult.error) {
          setError(prev => (prev ? `${prev}\nWorkflows: ${wfResult.error}` : `Workflows: ${wfResult.error}`));
          setFetchedWorkflowDefinitions([]);
        } else if (wfResult.workflows) {
          setFetchedWorkflowDefinitions(wfResult.workflows);
        } else {
           setError(prev => (prev ? `${prev}\nWorkflows: No workflow data received.` : `Workflows: No workflow data received.`));
           setFetchedWorkflowDefinitions([]);
        }

      } catch (err: any) {
        const errorMessage = err.message || "An unknown error occurred fetching page data.";
        setError(errorMessage);
        setAssignedLoans([]);
        setFetchedWorkflowDefinitions([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
  }, []);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading your assigned cases...</p>
      </div>
    );
  }
  
  if (error && (assignedLoans.length === 0 || fetchedWorkflowDefinitions.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight flex items-center"><ClipboardUser className="mr-3 h-8 w-8 text-primary" />My Assigned Cases</h1></div>
           <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
        </div>
         <Alert variant="default" className="bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300">
            <AlertCircle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
            <AlertTitleShadCN>Viewing as Mock User</AlertTitleShadCN>
            <AlertDescriptionShadCN>
              This page displays cases assigned to <strong>{MOCK_LOGGED_IN_USER_NAME} (ID: {MOCK_LOGGED_IN_USER_ID})</strong>.
              In a full application, this would be dynamic based on your login.
            </AlertDescriptionShadCN>
        </Alert>
        <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertCircle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescriptionShadCN>{error}</AlertDescriptionShadCN></Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <ClipboardUser className="mr-3 h-8 w-8 text-primary" />
            My Assigned Cases
          </h1>
          <p className="text-muted-foreground">
            These are loan requests assigned to you for processing.
          </p>
        </div>
        <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
      </div>
      
      <Alert variant="default" className="bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300">
          <AlertCircle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
          <AlertTitleShadCN>Viewing as Mock User: {MOCK_LOGGED_IN_USER_NAME}</AlertTitleShadCN>
          <AlertDescriptionShadCN>
            This page displays cases assigned to <strong>{MOCK_LOGGED_IN_USER_NAME} (ID: {MOCK_LOGGED_IN_USER_ID})</strong>.
            In a full application, this would be dynamic based on your login.
          </AlertDescriptionShadCN>
      </Alert>

      {error && !(assignedLoans.length === 0 || fetchedWorkflowDefinitions.length === 0) && (
         <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
            <AlertCircle className="h-5 w-5" />
            <AlertTitleShadCN>Partial Data Error</AlertTitleShadCN>
            <AlertDescriptionShadCN>There was an issue loading some data: {error}. Displayed data might be incomplete.</AlertDescriptionShadCN>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Active Cases ({assignedLoans.length})</CardTitle>
          <CardDescription>
            Review details, complete necessary tasks, and mark stages complete for manager review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedLoans.length === 0 && !isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 lucide lucide-folder-check"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="m9 13 2 2 4-4"/></svg>
              <p className="text-lg font-semibold">No Cases Currently Assigned to You</p>
              <p>Or, all your assigned cases are currently awaiting manager review.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Stage Deadline</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedLoans.map((loan: LoanRequest) => (
                  <TableRow key={loan.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{loan.customerName}</TableCell>
                    <TableCell>{loan.loanNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getStageName(loan.workflowVersionId, loan.currentStageId)}</Badge>
                    </TableCell>
                    <TableCell><Building className="inline h-4 w-4 mr-1 text-muted-foreground"/>{getDepartmentFromStage(loan.workflowVersionId, loan.currentStageId)}</TableCell>
                    <TableCell>
                        {loan.stageDeadline ? (
                             <span className={loan.isOverdue ? "text-destructive font-semibold flex items-center" : "flex items-center"}>
                                <Clock className="mr-1 h-4 w-4" />
                                {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}
                                {loan.isOverdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}
                            </span>
                        ) : <span className="text-muted-foreground">N/A</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/loan-requests/${loan.id}`} passHref>
                        <Button variant="ghost" size="sm">View & Process <ExternalLink className="ml-2 h-3 w-3" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
