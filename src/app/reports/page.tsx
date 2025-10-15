
'use client';

import Link from 'next/link';
import { BookCheck, ExternalLink, Loader2, AlertCircle, Building, Clock, Flame, User, BarChartBig, Download, ArrowLeft, ArrowDown, ArrowUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests, getWorkflowDefinitions, getDepartments } from '@/services/loan-service-prisma';
import type { LoanRequest, WorkflowDefinition, User as AppUser, Department as AppDepartment } from '@/types/loan';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type SortKey = 'customerName' | 'lastUpdatedDate';
type SortDirection = 'asc' | 'desc';

export default function ReportsPage() {
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [workflowDefs, setWorkflowDefs] = useState<WorkflowDefinition[]>([]);
  const [departments, setDepartments] = useState<{ id: string, name: AppDepartment }[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [assignedUserFilter, setAssignedUserFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('lastUpdatedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const canViewReport = useMemo(() => currentUser?.permissions.includes(PERMISSIONS.VIEW_REPORTS), [currentUser]);

  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loansResult, wfResult, deptsResult] = await Promise.all([
        getLoanRequests(),
        getWorkflowDefinitions(),
        getDepartments()
      ]);

      if (loansResult.error) throw new Error(`Loans: ${loansResult.error}`);
      setLoans(loansResult.loans || []);
      setUsers(loansResult.users || []);

      if (wfResult.error) throw new Error(`Workflows: ${wfResult.error}`);
      setWorkflowDefs(wfResult.workflows || []);

      if (deptsResult.error) throw new Error(`Departments: ${deptsResult.error}`);
      setDepartments(deptsResult.departments || []);

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

  const getAssignedUserNames = useCallback((assignedUsers: AppUser[]): string => {
    if (!assignedUsers || assignedUsers.length === 0) return "Unassigned";
    return assignedUsers.map(u => u.fullName).join(', ');
  }, []);
  
  const filteredAndSortedLoans = useMemo(() => {
    let filtered = [...loans];

    if (departmentFilter !== 'all') {
      filtered = filtered.filter(loan => loan.assignedDepartment === departmentFilter);
    }

    if (assignedUserFilter !== 'all') {
      filtered = filtered.filter(loan => loan.assignedToUsers.some(u => u.id === assignedUserFilter));
    }

    filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (sortKey === 'lastUpdatedDate') {
        const aDate = new Date(aVal).getTime();
        const bDate = new Date(bVal).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      // Default string comparison
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [loans, departmentFilter, assignedUserFilter, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const downloadAsCSV = () => {
    if (filteredAndSortedLoans.length === 0) {
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

    const data = filteredAndSortedLoans.map(loan => {
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
        getAssignedUserNames(loan.assignedToUsers),
        timeInStage,
        statusText,
        format(parseISO(loan.submittedDate), 'yyyy-MM-dd HH:mm'),
        format(parseISO(loan.lastUpdatedDate), 'yyyy-MM-dd HH:mm'),
      ].map(value => {
        const strValue = String(value ?? '');
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
  
  const clearFilters = () => {
    setDepartmentFilter('all');
    setAssignedUserFilter('all');
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

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
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label htmlFor="dept-filter" className="text-sm font-medium">Department</label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger id="dept-filter" className="mt-1">
                <SelectValue placeholder="Filter by Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 w-full">
            <label htmlFor="user-filter" className="text-sm font-medium">Assigned Person</label>
            <Select value={assignedUserFilter} onValueChange={setAssignedUserFilter}>
              <SelectTrigger id="user-filter" className="mt-1">
                <SelectValue placeholder="Filter by Assigned User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map(user => <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(departmentFilter !== 'all' || assignedUserFilter !== 'all') && (
            <Button variant="ghost" onClick={clearFilters} className="w-full sm:w-auto">
              <X className="mr-2 h-4 w-4"/> Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Loan Tasks ({filteredAndSortedLoans.length} of {loans.length})</CardTitle>
          <CardDescription>This report shows active and inactive loan tasks across all departments.</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAndSortedLoans.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <BookCheck className="mx-auto h-12 w-12 mb-4" />
              <p className="text-lg font-semibold">No Loan Requests Found</p>
              <p>There are no loan requests matching your current filter criteria.</p>
            </div>
          ) : (
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                     <Button variant="ghost" onClick={() => handleSort('customerName')} className="px-0">
                      Customer
                      {renderSortIcon('customerName')}
                    </Button>
                  </TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Assigned Staff</TableHead>
                  <TableHead>Time in Stage</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedLoans.map((loan) => {
                  const timeInStage = loan.stageEntryDate 
                    ? formatDistanceToNowStrict(parseISO(loan.stageEntryDate), { addSuffix: false })
                    : 'N/A';
                  
                  let statusComponent;
                  if (loan.isTerminalStage) {
                    statusComponent = <Badge variant="destructive">Terminated</Badge>;
                  } else if (loan.isReadyForManagerReview) {
                    statusComponent = <Badge variant="secondary">Review Pending</Badge>;
                  } else if (loan.isUrgent) {
                    statusComponent = <Tooltip><TooltipTrigger><Flame className="h-5 w-5 text-red-500" /></TooltipTrigger><TooltipContent><p>Urgent</p></TooltipContent></Tooltip>;
                  } else if (loan.isOverdue) {
                    statusComponent = <Tooltip><TooltipTrigger><AlertCircle className="h-5 w-5 text-destructive" /></TooltipTrigger><TooltipContent><p>Overdue</p></TooltipContent></Tooltip>;
                  } else {
                    statusComponent = <Badge variant="outline">Active</Badge>;
                  }

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
                                <span className="flex items-center gap-1.5"><User className="inline h-4 w-4 mr-1 text-muted-foreground"/> {getAssignedUserNames(loan.assignedToUsers)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                {loan.assignedToUsers.length > 0 ? (
                                    loan.assignedToUsers.map(u => <p key={u.id}>{u.email}</p>)
                                ) : (
                                    <p>Unassigned</p>
                                )}
                            </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell><Clock className="inline h-4 w-4 mr-1 text-muted-foreground"/>{timeInStage}</TableCell>
                       <TableCell className="text-center">
                         <div className="flex items-center justify-center gap-2">
                           {statusComponent}
                         </div>
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
