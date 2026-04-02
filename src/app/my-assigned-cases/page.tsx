
'use client';

import Link from 'next/link';
import { ArrowLeft, ClipboardList, ExternalLink, Loader2, AlertCircle, Building, Clock, Flame, History, Download, Inbox, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuickFollowUpDialog } from '@/components/loan/dialogs/QuickFollowUpDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getAssignedLoanRequests, getCompletedCaseHistory, type CompletedCaseRecord } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { PERMISSIONS } from '@/lib/permissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MyAssignedCasesPage() {
  const [selectedLoanForStatus, setSelectedLoanForStatus] = useState<LoanRequest | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [assignedLoans, setAssignedLoans] = useState<LoanRequest[]>([]);
  const [completedCases, setCompletedCases] = useState<CompletedCaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canViewPage = useMemo(() => currentUser?.permissions.includes(PERMISSIONS.VIEW_OWN_ASSIGNED_CASES), [currentUser]);

  useEffect(() => {
    if (authIsLoading || !canViewPage || !currentUser) {
      if (!authIsLoading) setIsLoading(false);
      return;
    }

    async function fetchPageData() {
      setIsLoading(true);
      setError(null);
      try {
        const [loansResult, historyResult] = await Promise.all([
          getAssignedLoanRequests(),
          getCompletedCaseHistory(),
        ]);

        if (loansResult.error) {
          setError(loansResult.error);
          setAssignedLoans([]);
        } else if (loansResult.loans) {
          setAssignedLoans(loansResult.loans);
        } else {
          setError("No loan data received.");
          setAssignedLoans([]);
        }

        if (historyResult.cases) {
          setCompletedCases(historyResult.cases);
        }
      } catch (err: any) {
        const errorMessage = err.message || "An unknown error occurred fetching page data.";
        setError(errorMessage);
        setAssignedLoans([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
    const intervalId = window.setInterval(fetchPageData, 15000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser, authIsLoading, canViewPage]);

  const filteredAssignedLoans = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    if (!lowerSearch) return assignedLoans;

    return assignedLoans.filter((loan) =>
      loan.loanNumber.toLowerCase().includes(lowerSearch) ||
      loan.customerName.toLowerCase().includes(lowerSearch) ||
      (loan.currentStageName || '').toLowerCase().includes(lowerSearch) ||
      (loan.assignedDepartment || '').toLowerCase().includes(lowerSearch)
    );
  }, [assignedLoans, searchTerm]);

  const filteredCompletedCases = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    if (!lowerSearch) return completedCases;

    return completedCases.filter((c) =>
      c.loanNumber.toLowerCase().includes(lowerSearch) ||
      c.customerName.toLowerCase().includes(lowerSearch) ||
      c.actionType.toLowerCase().includes(lowerSearch) ||
      (c.currentDepartment || '').toLowerCase().includes(lowerSearch) ||
      (c.currentStage || '').toLowerCase().includes(lowerSearch) ||
      (c.latestEvent || '').toLowerCase().includes(lowerSearch)
    );
  }, [completedCases, searchTerm]);

  const sortedLoans = useMemo(() => {
    return [...filteredAssignedLoans].sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime();
    });
  }, [filteredAssignedLoans]);

  const currentUserDepartmentNormalized = (currentUser?.department || '').trim().toLowerCase();

  const exportAssignedCasesToCSV = () => {
    if (sortedLoans.length === 0) return;
    const headers = [
      'Loan Number', 'Customer', 'Current Stage', 'Current Assignees', 'Assigned Department', 'Stage Deadline', 'Assignment/Completion History'
    ];
    const csvData = sortedLoans.map(loan => {
      const assignmentEvents = (loan.history || []).filter(h => h.notes && (h.notes.toLowerCase().includes('assigned') || h.notes.toLowerCase().includes('completed') || h.notes.toLowerCase().includes('reassign')));
      const historySummary = assignmentEvents.map(h => `${h.timestamp}: ${h.userName} (${h.userRole || ''}) - ${h.notes}`).join(' | ');
      return [
        loan.loanNumber,
        loan.customerName,
        loan.currentStageName || '',
        loan.assignedToUsers.map(u => u.fullName).join('; '),
        loan.assignedDepartment || '',
        loan.stageDeadline ? format(parseISO(loan.stageDeadline), 'MMM dd, yyyy') : '',
        historySummary
      ];
    });
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'my-assigned-cases.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCaseHistoryToCSV = () => {
    if (filteredCompletedCases.length === 0) return;
    const headers = [
      'Loan Number',
      'Customer Name',
      'Action Type',
      'Marked Completed By',
      'Completion Date & Time',
      'Next Destination',
      'Current Department',
      'Current Stage',
      'Current Status',
      'Latest Event',
      'Latest Event At',
      'Reason / Comment'
    ];
    const csvData = filteredCompletedCases.map(c => [
      c.loanNumber, c.customerName, c.actionType, c.completedByName,
      c.completionDate ? format(parseISO(c.completionDate), 'MMM dd, yyyy HH:mm') : '',
      c.nextDestination,
      c.currentDepartment,
      c.currentStage,
      c.currentStatus,
      c.latestEvent,
      c.latestEventAt ? format(parseISO(c.latestEventAt), 'MMM dd, yyyy HH:mm') : '',
      c.comment || '',
    ]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url2 = URL.createObjectURL(blob);
    const link2 = document.createElement('a');
    link2.href = url2;
    link2.setAttribute('download', 'case-history.csv');
    document.body.appendChild(link2);
    link2.click();
    document.body.removeChild(link2);
    URL.revokeObjectURL(url2);
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-9 w-72 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to view your assigned cases.</p>
        <Link href="/" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!currentUser && !authIsLoading) {
    return (
      <div className="space-y-6 text-center">
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertCircle className="h-5 w-5" />
          <AlertTitleShadCN>Not Logged In</AlertTitleShadCN>
          <AlertDescriptionShadCN>You need to be logged in to view your assigned cases.</AlertDescriptionShadCN>
        </Alert>
        <Link href="/login" passHref><Button>Login</Button></Link>
      </div>
    );
  }

  if (error && assignedLoans.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight flex items-center"><ClipboardList className="mr-3 h-8 w-8 text-primary" />My Assigned Cases</h1></div>
          <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
        </div>
        <Alert variant="default" className="bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300">
          <AlertCircle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
          <AlertTitleShadCN>Viewing as: {currentUser?.fullName || 'Current User'}</AlertTitleShadCN>
          <AlertDescriptionShadCN>This page displays cases assigned to you based on your current login.</AlertDescriptionShadCN>
        </Alert>
        <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertCircle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescriptionShadCN>{error}</AlertDescriptionShadCN></Alert>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <ClipboardList className="mr-3 h-8 w-8 text-primary" />
              My Assigned Cases
            </h1>
            <p className="text-muted-foreground">
              Cases currently assigned to <span className="font-semibold text-primary">{currentUser?.fullName || 'you'}</span>.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cases..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
            <AlertCircle className="h-5 w-5" />
            <AlertTitleShadCN>Partial Data Error</AlertTitleShadCN>
            <AlertDescriptionShadCN>{error}</AlertDescriptionShadCN>
          </Alert>
        )}

        <Tabs defaultValue="assigned" className="w-full">
          <TabsList>
            <TabsTrigger value="assigned">Assigned Cases ({sortedLoans.length})</TabsTrigger>
            <TabsTrigger value="history">Case History ({filteredCompletedCases.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="assigned">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Assigned Cases ({sortedLoans.length})</CardTitle>
                  <CardDescription>Loan cases where you are currently assigned as a staff member. Click to view details.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportAssignedCasesToCSV} disabled={sortedLoans.length === 0}>
                  <Download className="mr-2 h-4 w-4" />Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {sortedLoans.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <Inbox className="mx-auto mb-4 h-12 w-12" />
                    <p className="text-lg font-semibold">No Assigned Cases</p>
                    <p className="mt-1">You currently have no loan cases assigned to you.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Loan Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Current Stage</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedLoans.map((loan) => (
                        <TableRow
                          key={loan.id}
                          className={cn(
                            "hover:bg-muted/50",
                            loan.isUrgent && "border-l-4 border-l-red-500",
                            loan.isOverdue && "bg-red-50 dark:bg-red-900/10"
                          )}
                        >
                          <TableCell>
                            <div className="flex gap-1">
                              {loan.isUrgent && <Badge variant="destructive" className="text-xs"><Flame className="h-3 w-3 mr-1" />Urgent</Badge>}
                              {loan.isOverdue && <Badge variant="outline" className="text-xs text-orange-600 border-orange-400"><Clock className="h-3 w-3 mr-1" />Overdue</Badge>}
                              {!loan.isUrgent && !loan.isOverdue && <Badge variant="secondary" className="text-xs">Active</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{loan.loanNumber}</TableCell>
                          <TableCell>{loan.customerName}</TableCell>
                          <TableCell>{loan.currentStageName || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{loan.assignedDepartment || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {loan.stageDeadline ? format(parseISO(loan.stageDeadline), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>{format(parseISO(loan.lastUpdatedDate), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Link href={`/loan-requests/${loan.id}`} passHref>
                                <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4 mr-1" />View</Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedLoanForStatus(loan); setIsStatusDialogOpen(true); }}
                              >
                                <History className="h-4 w-4 mr-1" />Status
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Case History</CardTitle>
                  <CardDescription>History of your case interactions (assigned by you, assigned to you, complete, approve, and review actions). Track where each case is now and the latest activity in real time.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportCaseHistoryToCSV} disabled={filteredCompletedCases.length === 0}>
                  <Download className="mr-2 h-4 w-4" />Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {filteredCompletedCases.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <Inbox className="mx-auto mb-4 h-12 w-12" />
                    <p className="text-lg font-semibold">No Case History</p>
                    <p className="mt-1">No matching interaction records found yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan Number</TableHead>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Action Date & Time</TableHead>
                        <TableHead>Next Destination</TableHead>
                        <TableHead>Current Location</TableHead>
                        <TableHead>Latest Activity</TableHead>
                        <TableHead>Reason / Comment</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompletedCases.map((c) => {
                        const caseDepartmentNormalized = (c.currentDepartment || '').trim().toLowerCase();
                        const isMovedOutOfDepartment = !!currentUserDepartmentNormalized && !!caseDepartmentNormalized && caseDepartmentNormalized !== currentUserDepartmentNormalized;
                        return (
                        <TableRow key={c.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{c.loanNumber}</TableCell>
                          <TableCell>{c.customerName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{c.actionType}</Badge>
                          </TableCell>
                          <TableCell>{format(parseISO(c.completionDate), 'MMM dd, yyyy HH:mm')}</TableCell>
                          <TableCell>{c.nextDestination}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{c.currentDepartment}</p>
                              <p className="text-muted-foreground">{c.currentStage} ({c.currentStatus})</p>
                              {isMovedOutOfDepartment && (
                                <Badge variant="outline" className="mt-1 text-[11px] border-amber-400 text-amber-700 bg-amber-50">
                                  Moved out of your department
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[260px]">
                              <p className="truncate" title={c.latestEvent}>{c.latestEvent}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.latestEventAt ? format(parseISO(c.latestEventAt), 'MMM dd, yyyy HH:mm') : '-'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate" title={c.comment || ''}>
                            {c.comment || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Link href={`/loan-requests/${c.loanRequestId}`} passHref>
                              <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4 mr-1" />View</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <QuickFollowUpDialog isOpen={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen} loan={selectedLoanForStatus} />
    </>
  );
}
