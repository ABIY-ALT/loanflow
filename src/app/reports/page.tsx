
'use client';

import Link from 'next/link';
import { BookCheck, ExternalLink, Loader2, AlertCircle, Building, Clock, Flame, User, BarChartBig, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests, getWorkflowDefinitions } from '@/services/loan-service-prisma';
import type { LoanRequest, WorkflowDefinition, User as AppUser } from '@/types/loan';
import { format, parseISO, formatDistanceToNowStrict } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';


export default function ReportsPage() {
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [workflowDefs, setWorkflowDefs] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const canViewReport = useMemo(() => currentUser?.permissions.includes(PERMISSIONS.VIEW_REPORTS), [currentUser]);

  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loansResult, wfResult] = await Promise.all([
        getLoanRequests(),
        getWorkflowDefinitions()
      ]);

      if (loansResult.error) throw new Error(loansResult.error);
      if (wfResult.error) throw new Error(wfResult.error);

      setLoans(loansResult.loans || []);
      setUsers(loansResult.users || []);
      setWorkflowDefs(wfResult.workflows || []);

    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canViewReport) {
      fetchPageData();
    }
  }, [canViewReport, fetchPageData]);

  const getStageName = useCallback((workflowVersionId?: string, stageId?: string): string => {
    if (!workflowVersionId || !stageId || !workflowDefs.length) return "Unknown Stage";
    const version = workflowDefs.flatMap(def => def.versions).find(v => v.id === workflowVersionId);
    return version?.stages.find(s => s.id === stageId)?.name || "Unknown Stage";
  }, [workflowDefs]);

  const getAssignedUserName = useCallback((userId?: string): string => {
    if (!userId) return "Unassigned";
    return users.find(u => u.id === userId)?.fullName || "Unknown User";
  }, [users]);
  
  const sortedLoans = useMemo(() => {
    return [...loans].sort((a, b) => new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime());
  }, [loans]);

  const downloadAsCSV = () => {
    if (loans.length === 0) {
      toast({ title: "No Data to Export", description: "There is no report data to download.", variant: "destructive" });
      return;
    }

    const headers = [
      "Loan Number",
      "Customer Name",
      "Customer Email",
      "Loan Amount",
      "Loan Type",
      "Current Stage",
      "Department",
      "Assigned Staff",
      "Time in Stage",
      "Status",
      "Submitted Date",
      "Last Updated"
    ];

    const data = sortedLoans.map(loan => {
      const timeInStage = loan.stageEntryDate ? formatDistanceToNowStrict(parseISO(loan.stageEntryDate), { addSuffix: false }) : 'N/A';
      
      let statusText = 'Active';
      if (loan.isTerminalStage) statusText = 'Terminated';
      else if (loan.isReadyForManagerReview) statusText = 'Review Pending';
      else if (loan.isUrgent) statusText = 'Urgent';
      else if (loan.isOverdue) statusText = 'Overdue';

      return [
        loan.loanNumber,
        loan.customerName,
        loan.customerEmail,
        loan.loanAmount,
        loan.loanType,
        getStageName(loan.workflowVersionId, loan.currentStageId),
        loan.assignedDepartment || 'N/A',
        getAssignedUserName(loan.assignedTo),
        timeInStage,
        statusText,
        format(parseISO(loan.submittedDate), 'yyyy-MM-dd HH:mm'),
        format(parseISO(loan.lastUpdatedDate), 'yyyy-MM-dd HH:mm'),
      ].map(value => {
        const strValue = String(value ?? '');
        // Escape quotes by doubling them and wrap in quotes if it contains comma, quote, or newline
        if (strValue.includes('"') || strValue.includes(',') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',');
    });

    const csvContent = [headers.join(','), ...data].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `loan_tasks_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download Started", description: "Your report CSV file is being downloaded." });
  };
  

  if (authIsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading report data...</p>
      </div>
    );
  }

  if (!canViewReport) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view reports. Please contact an administrator.</p>
            <Link href="/" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
            </Link>
        </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight flex items-center"><BarChartBig className="mr-3 h-8 w-8 text-primary" /> Reports</h1>
            <div className="flex gap-2">
                <Button variant="outline" onClick={downloadAsCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Report
                </Button>
                <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
            </div>
        </div>
        <Alert variant="destructive"><AlertCircle className="h-5 w-5" /><AlertTitle>Error Loading Report</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center"><BarChartBig className="mr-3 h-8 w-8 text-primary" /> Task Assignment Report</h1>
          <p className="text-muted-foreground">Overview of all loan requests, their current stage, assignee, and task duration.</p>
        </div>
        <div className="flex gap-2">
             <Button variant="outline" onClick={downloadAsCSV}>
                <Download className="mr-2 h-4 w-4" />
                Download as CSV
            </Button>
            <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Loan Tasks ({loans.length})</CardTitle>
          <CardDescription>This report shows active and inactive loan tasks across all departments.</CardDescription>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <BookCheck className="mx-auto h-12 w-12 mb-4" />
              <p className="text-lg font-semibold">No Loan Requests Found</p>
              <p>There are no loan requests in the system to report on.</p>
            </div>
          ) : (
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Assigned Staff</TableHead>
                  <TableHead>Time in Stage</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLoans.map((loan) => {
                  const timeInStage = loan.stageEntryDate 
                    ? formatDistanceToNowStrict(parseISO(loan.stageEntryDate), { addSuffix: false })
                    : 'N/A';

                  return (
                    <TableRow key={loan.id} className={cn(loan.isTerminalStage && "opacity-50 bg-muted/30")}>
                      <TableCell className="font-medium">{loan.customerName}</TableCell>
                      <TableCell>{loan.loanNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getStageName(loan.workflowVersionId, loan.currentStageId)}</Badge>
                      </TableCell>
                      <TableCell><Building className="inline h-4 w-4 mr-1 text-muted-foreground"/>{loan.assignedDepartment || 'N/A'}</TableCell>
                      <TableCell>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center gap-1.5"><User className="inline h-4 w-4 mr-1 text-muted-foreground"/> {getAssignedUserName(loan.assignedTo)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{users.find(u => u.id === loan.assignedTo)?.email || 'Unassigned'}</p>
                            </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell><Clock className="inline h-4 w-4 mr-1 text-muted-foreground"/>{timeInStage}</TableCell>
                       <TableCell className="text-center">
                         <div className="flex items-center justify-center gap-2">
                            {loan.isUrgent && <Tooltip><TooltipTrigger><Flame className="h-5 w-5 text-red-500" /></TooltipTrigger><TooltipContent><p>Urgent</p></TooltipContent></Tooltip>}
                            {loan.isOverdue && <Tooltip><TooltipTrigger><AlertCircle className="h-5 w-5 text-destructive" /></TooltipTrigger><TooltipContent><p>Overdue</p></TooltipContent></Tooltip>}
                            {loan.isTerminalStage && <Badge variant="destructive">Terminated</Badge>}
                            {loan.isReadyForManagerReview && !loan.isTerminalStage && <Badge variant="secondary">Review Pending</Badge>}
                         </div>
                       </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/loan-requests/${loan.id}`} passHref>
                          <Button variant="ghost" size="sm">View Details<ExternalLink className="ml-2 h-3 w-3" /></Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
