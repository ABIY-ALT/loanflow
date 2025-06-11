
'use client';

import Link from 'next/link';
import { ArrowLeft, FolderKanban, ExternalLink, Loader2, AlertCircle, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests, getWorkflowDefinitions } from '@/services/loan-service-prisma'; // Ensure this is the correct and only import
import type { LoanRequest, WorkflowDefinition } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useCallback } from 'react';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';

export default function DepartmentQueuePage() {
  const [unassignedLoans, setUnassignedLoans] = useState<LoanRequest[]>([]);
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
          setUnassignedLoans([]);
        } else if (loansResult.loans) {
          const filteredLoans = loansResult.loans.filter(loan =>
            loan.assignedDepartment && !loan.assignedTo && !loan.isReadyForManagerReview
          );
          setUnassignedLoans(filteredLoans);
        } else {
           setError(prev => (prev ? `${prev}\nLoans: No loan data received for unassigned queue.` : `Loans: No loan data received for unassigned queue.`));
           setUnassignedLoans([]);
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
        setUnassignedLoans([]);
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
        <p className="ml-3 text-lg">Loading unassigned cases & workflows...</p>
      </div>
    );
  }
  if (error && (unassignedLoans.length === 0 || fetchedWorkflowDefinitions.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight flex items-center"><FolderKanban className="mr-3 h-8 w-8 text-primary" />Department Queue (Unassigned Staff)</h1></div>
           <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
        </div>
        <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertCircle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescriptionShadCN>{error}</AlertDescriptionShadCN></Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <FolderKanban className="mr-3 h-8 w-8 text-primary" />
            Department Queue (Unassigned Staff)
          </h1>
          <p className="text-muted-foreground">
            These loans are assigned to a department and await assignment to a specific staff member.
          </p>
        </div>
        <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
      </div>
      
      {error && !(unassignedLoans.length === 0 || fetchedWorkflowDefinitions.length === 0) && (
         <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
            <AlertCircle className="h-5 w-5" />
            <AlertTitleShadCN>Partial Data Error</AlertTitleShadCN>
            <AlertDescriptionShadCN>There was an issue loading some data, but other parts may be available: {error}</AlertDescriptionShadCN>
        </Alert>
      )}


      <Card>
        <CardHeader>
          <CardTitle>Cases Awaiting Staff Assignment ({unassignedLoans.length})</CardTitle>
          <CardDescription>
            Department managers should assign these loans to staff members via their detail pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unassignedLoans.length === 0 && !isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 lucide lucide-check-circle-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              <p className="text-lg font-semibold">No Cases Awaiting Staff Assignment</p>
              <p>All active loans currently have an assigned staff member or are awaiting initial department assignment.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Assigned Department</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedLoans.map((loan: LoanRequest) => (
                  <TableRow key={loan.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{loan.customerName}</TableCell>
                    <TableCell>{loan.loanNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getStageName(loan.workflowVersionId, loan.currentStageId)}</Badge>
                    </TableCell>
                    <TableCell><Building className="inline h-4 w-4 mr-1 text-muted-foreground"/>{loan.assignedDepartment || 'N/A'}</TableCell>
                    <TableCell>{loan.lastUpdatedDate ? format(parseISO(loan.lastUpdatedDate), 'MMM dd, yyyy') : <span className="text-muted-foreground">N/A</span>}</TableCell>
                    <TableCell className="text-center">
                      <Link href={`/loan-requests/${loan.id}`} passHref>
                        <Button variant="ghost" size="sm">View & Assign Staff <ExternalLink className="ml-2 h-3 w-3" /></Button>
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
