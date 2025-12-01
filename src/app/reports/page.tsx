

'use client';

import Link from 'next/link';
import { BookCheck, ExternalLink, Loader2, AlertCircle, Building, Clock, Flame, User, BarChartBig, Download, ArrowLeft, ArrowDown, ArrowUp, X, Mail, DollarSign, Type, CalendarDays, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests, getWorkflowDefinitions, getDepartments } from '@/services/loan-service-prisma';
import type { LoanRequest, WorkflowDefinition, User as AppUser, Department as AppDepartment } from '@/types/loan';
import { format, parseISO, intervalToDuration, isToday, isThisWeek, isThisMonth, isThisYear, isValid } from 'date-fns';
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
import { Combobox } from '@/components/ui/combobox';


type SortKey = 'customerName' | 'lastUpdatedDate' | 'loanAmount' | 'submittedDate';
type SortDirection = 'asc' | 'desc';
type DateRangeFilter = 'all' | 'today' | 'weekly' | 'monthly' | 'yearly';


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
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('lastUpdatedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const canViewReport = useMemo(() => currentUser?.permissions.includes(PERMISSIONS.VIEW_REPORTS), [currentUser]);

  const fetchPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Loan requests now includes users associated with them
      const loansResult = await getLoanRequests();

      if (loansResult.error) throw new Error(`Loans: ${loansResult.error}`);
      setLoans(loansResult.loans || []);
      
      const allUsersFromLoans = (loansResult.loans || []).flatMap(l => [...l.assignedToUsers, ...l.stageCompletedBy]);
      const uniqueUsers = Array.from(new Map(allUsersFromLoans.map(u => [u.id, u])).values());
      setUsers(uniqueUsers);

      // These are still needed for filters and getting stage names if not on loan object
      const [wfResult, deptsResult] = await Promise.all([
        getWorkflowDefinitions(),
        getDepartments()
      ]);

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
    } else if (!authIsLoading) {
        setIsLoading(false);
    }
  }, [canViewReport, fetchPageData, authIsLoading]);
  
  const departmentOptions = useMemo(() => [
    { value: 'all', label: 'All Departments' },
    ...departments.map(dept => ({ value: dept.name, label: dept.name }))
  ], [departments]);

  const userOptions = useMemo(() => [
    { value: 'all', label: 'All Users' },
    ...users.map(user => ({ value: user.id, label: user.fullName }))
  ], [users]);


  const getStageName = useCallback((workflowVersionId?: string, stageId?: string): string => {
    if (!workflowVersionId || !stageId || !workflowDefs.length) return "Unknown Stage";
    const version = workflowDefs.flatMap(def => def.versions).find(v => v.id === workflowVersionId);
    return version?.stages.find(s => s.id === stageId)?.name || "Unknown Stage";
  }, [workflowDefs]);

  const getAssignedUserNames = useCallback((assignedUsers: AppUser[]): string => {
    if (!assignedUsers || assignedUsers.length === 0) return "Unassigned";
    return assignedUsers.map(u => u.fullName).join(', ');
  }, []);

  const formatPreciseDuration = (start: Date, end: Date): string => {
    const duration = intervalToDuration({ start, end });
    const parts: string[] = [];
    if (duration.years && duration.years > 0) parts.push(`${duration.years}y`);
    if (duration.months && duration.months > 0) parts.push(`${duration.months}m`);
    if (duration.days && duration.days > 0) parts.push(`${duration.days}d`);
    if (duration.hours && duration.hours > 0 && parts.length < 2) parts.push(`${duration.hours}h`);

    if (parts.length === 0) return "Just now";
    return parts.slice(0, 3).join(' '); // Show at most 3 parts (e.g., "1y 2m 3d")
  };
  
  const filteredAndSortedLoans = useMemo(() => {
    let filtered = [...loans];

    if (departmentFilter !== 'all') {
      filtered = filtered.filter(loan => loan.assignedDepartment === departmentFilter);
    }

    if (assignedUserFilter !== 'all') {
      filtered = filtered.filter(loan => loan.assignedToUsers.some(u => u.id === assignedUserFilter));
    }
    
    if (dateRangeFilter !== 'all') {
      filtered = filtered.filter(loan => {
        const submittedDate = parseISO(loan.submittedDate);
        if (!isValid(submittedDate)) return false;

        switch(dateRangeFilter) {
          case 'today': return isToday(submittedDate);
          case 'weekly': return isThisWeek(submittedDate, { weekStartsOn: 1 });
          case 'monthly': return isThisMonth(submittedDate);
          case 'yearly': return isThisYear(submittedDate);
          default: return true;
        }
      });
    }

    filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (sortKey === 'lastUpdatedDate' || sortKey === 'submittedDate') {
        const aDate = new Date(aVal).getTime();
        const bDate = new Date(bVal).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      if (sortKey === 'loanAmount') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Default string comparison
      if (String(aVal) < String(bVal)) return sortDirection === 'asc' ? -1 : 1;
      if (String(aVal) > String(bVal)) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [loans, departmentFilter, assignedUserFilter, dateRangeFilter, sortKey, sortDirection]);

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
      "Loan Number", "Customer Name", "Customer Email", "Loan Amount", "Sector", "Request Type", "Submitted Date", "Last Updated",
      "Current Stage", "Department", "Assigned Staff", "Time in Stage", "Status"
    ];

    const data = filteredAndSortedLoans.map(loan => {
      const timeInStage = loan.stageEntryDate ? formatPreciseDuration(parseISO(loan.stageEntryDate), new Date()) : 'N/A';
      
      let statusText = 'Active';
      if (loan.isTerminalStage) {
          statusText = 'Terminated';
      } else if (loan.isReadyForManagerReview) {
          statusText = 'Review Pending';
      } else if (loan.isUrgent) {
          statusText = 'Urgent';
      } else if (loan.isOverdue) {
          statusText = 'Overdue';
      }

      return [
        loan.loanNumber,
        loan.customerName,
        loan.customerEmail,
        loan.loanAmount,
        loan.sectorName,
        loan.requestTypeName,
        format(parseISO(loan.submittedDate), 'yyyy-MM-dd HH:mm'),
        format(parseISO(loan.lastUpdatedDate), 'yyyy-MM-dd HH:mm'),
        loan.currentStageName || getStageName(loan.workflowVersionId, loan.currentStageId),
        loan.assignedDepartment || 'N/A',
        getAssignedUserNames(loan.assignedToUsers),
        timeInStage,
        statusText,
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
    setDateRangeFilter('all');
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
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="w-full">
            <label htmlFor="dept-filter" className="text-sm font-medium">Department</label>
            <Combobox
              options={departmentOptions}
              value={departmentFilter === 'all' ? '' : departmentFilter}
              onSelect={(value) => setDepartmentFilter(value || 'all')}
              placeholder="All Departments"
              searchPlaceholder="Search departments..."
              notFoundText="No department found."
              className="mt-1"
            />
          </div>
          <div className="w-full">
            <label htmlFor="user-filter" className="text-sm font-medium">Assigned Person</label>
            <Combobox
              options={userOptions}
              value={assignedUserFilter === 'all' ? '' : assignedUserFilter}
              onSelect={(value) => setAssignedUserFilter(value || 'all')}
              placeholder="All Users"
              searchPlaceholder="Search users..."
              notFoundText="No user found."
              className="mt-1"
            />
          </div>
          <div className="w-full">
            <label htmlFor="date-range-filter" className="text-sm font-medium">Date Range (Submitted)</label>
            <Select value={dateRangeFilter} onValueChange={(value) => setDateRangeFilter(value as DateRangeFilter)}>
              <SelectTrigger id="date-range-filter" className="mt-1">
                <SelectValue placeholder="Filter by Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="weekly">This Week</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
                <SelectItem value="yearly">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(departmentFilter !== 'all' || assignedUserFilter !== 'all' || dateRangeFilter !== 'all') && (
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">
                     <Button variant="ghost" onClick={() => handleSort('customerName')} className="px-1">
                      Customer
                      {renderSortIcon('customerName')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('loanAmount')} className="px-1">
                        <DollarSign className="inline h-4 w-4 mr-1"/>Amount
                        {renderSortIcon('loanAmount')}
                    </Button>
                  </TableHead>
                  <TableHead><Briefcase className="inline h-4 w-4 mr-1"/>Sector</TableHead>
                  <TableHead><Type className="inline h-4 w-4 mr-1"/>Request Type</TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('submittedDate')} className="px-1">
                      Submitted
                      {renderSortIcon('submittedDate')}
                    </Button>
                  </TableHead>
                  <TableHead><CalendarDays className="inline h-4 w-4 mr-1"/>Current Stage</TableHead>
                  <TableHead><Building className="inline h-4 w-4 mr-1"/>Department</TableHead>
                  <TableHead><User className="inline h-4 w-4 mr-1"/>Assigned Staff</TableHead>
                  <TableHead><Clock className="inline h-4 w-4 mr-1"/>Time in Stage</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedLoans.map((loan) => {
                  const timeInStage = loan.stageEntryDate ? formatPreciseDuration(parseISO(loan.stageEntryDate), new Date()) : 'N/A';
                  
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
                    <TableRow key={loan.id} className={cn("hover:bg-muted/50", loan.isTerminalStage && "opacity-50 bg-muted/30")}>
                      <TableCell className="font-medium">
                        <div className="font-semibold">{loan.customerName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{loan.customerEmail}</div>
                      </TableCell>
                      <TableCell>${loan.loanAmount.toLocaleString()}</TableCell>
                      <TableCell>{loan.sectorName}</TableCell>
                      <TableCell>{loan.requestTypeName}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>{format(parseISO(loan.submittedDate), 'MMM dd, yyyy')}</TooltipTrigger>
                          <TooltipContent>{format(parseISO(loan.submittedDate), 'PPpp')}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{loan.currentStageName || getStageName(loan.workflowVersionId, loan.currentStageId)}</Badge>
                      </TableCell>
                      <TableCell>{loan.assignedDepartment || 'N/A'}</TableCell>
                      <TableCell>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center gap-1.5">{getAssignedUserNames(loan.assignedToUsers)}</span>
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
                      <TableCell>{timeInStage}</TableCell>
                       <TableCell className="text-center">
                         <div className="flex items-center justify-center gap-2">
                           {statusComponent}
                         </div>
                       </TableCell>
                       <TableCell>
                          <Link href={`/loan-requests/${loan.id}`} passHref>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                       </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
