

'use client';

import Link from 'next/link';
import { ArrowLeft, ClipboardList, ExternalLink, Loader2, AlertCircle, Building, Clock, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context'; // Import useAuth
import { cn } from '@/lib/utils';
import { PERMISSIONS } from '@/lib/permissions';

export default function MyAssignedCasesPage() {
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [assignedLoans, setAssignedLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const loansResult = await getLoanRequests();

        if (loansResult.error) {
          setError(loansResult.error);
          setAssignedLoans([]);
        } else if (loansResult.loans) {
          // The filtering logic is now handled on the server, but an extra client-side check is fine as a fallback.
          const filteredLoans = loansResult.loans.filter(loan =>
            loan.assignedToUsers.some(u => u.id === currentUser.id) && !loan.isReadyForManagerReview
          );
          setAssignedLoans(filteredLoans);
        } else {
           setError("No loan data received.");
           setAssignedLoans([]);
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
  }, [currentUser, authIsLoading, canViewPage]);

  const sortedLoans = useMemo(() => {
    return [...assignedLoans].sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime();
    });
  }, [assignedLoans]);


  if (authIsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading your assigned cases...</p>
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
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
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
            <AlertTitleShadCN>Viewing as: {currentUser?.fullName || currentUser?.name || 'Current User'}</AlertTitleShadCN>
            <AlertDescriptionShadCN>
              This page displays cases assigned to you based on your current login.
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
            <ClipboardList className="mr-3 h-8 w-8 text-primary" />
            My Assigned Cases
          </h1>
          <p className="text-muted-foreground">
            These are loan requests assigned to you ({currentUser?.fullName || currentUser?.name}) for processing.
          </p>
        </div>
        <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
      </div>
      
      <Alert variant="default" className="bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300">
          <AlertCircle className="h-4 w-4 !text-blue-600 dark:!text-blue-400" />
          <AlertTitleShadCN>Viewing as: {currentUser?.fullName || currentUser?.name || 'Current User'}</AlertTitleShadCN>
          <AlertDescriptionShadCN>
            This page displays cases assigned to you. Urgent cases are prioritized at the top.
          </AlertDescriptionShadCN>
      </Alert>

      {error && assignedLoans.length > 0 && (
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
          {sortedLoans.length === 0 && !isLoading && !authIsLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 lucide lucide-folder-check"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="m9 13 2 2 4-4"/></svg>
              <p className="text-lg font-semibold">No Cases Currently Assigned to You</p>
              <p>Or, all your assigned cases are currently awaiting manager review.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urgent</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Stage Deadline</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLoans.map((loan: LoanRequest) => (
                  <TableRow key={loan.id} className={cn("hover:bg-muted/50", loan.isUrgent && "bg-red-50 dark:bg-red-900/20")}>
                     <TableCell className="text-center">
                      {loan.isUrgent && <Flame className="h-5 w-5 text-red-500" />}
                    </TableCell>
                    <TableCell className="font-medium">{loan.customerName}</TableCell>
                    <TableCell>{loan.loanNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{loan.currentStageName}</Badge>
                    </TableCell>
                    <TableCell><Building className="inline h-4 w-4 mr-1 text-muted-foreground"/>{loan.assignedDepartment}</TableCell>
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
