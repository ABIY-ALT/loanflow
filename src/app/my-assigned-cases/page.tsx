
'use client';

import Link from 'next/link';
import { ArrowLeft, ClipboardList, ExternalLink, Loader2, AlertCircle, Building, Clock, Flame, History, Download } from 'lucide-react';
  // Export assigned cases overview as CSV (with assignment/completion history)
  const exportAssignedCasesToCSV = () => {
    if (assignedLoans.length === 0) return;
    const headers = [
      'Loan Number', 'Customer', 'Current Stage', 'Current Assignees', 'Assigned Department', 'Stage Deadline', 'Assignment/Completion History'
    ];
    const csvData = assignedLoans.map(loan => {
      // Find assignment/completion events in history
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
import { Button } from '@/components/ui/button';
import { QuickFollowUpDialog } from '@/components/loan/dialogs/QuickFollowUpDialog';
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
  const [selectedLoanForStatus, setSelectedLoanForStatus] = useState<LoanRequest | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
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
          // Show loans where user is/was assigned, assigned someone else, or touched in history
          const filteredLoans = loansResult.loans.filter(loan => {
            const everAssigned = loan.assignedToUsers.some(u => u.id === currentUser.id);
            const assignedByMe = loan.assignedById === currentUser.id;
            const touchedInHistory = (loan.history || []).some(h => h.userId === currentUser.id);
            return everAssigned || assignedByMe || touchedInHistory;
          });
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
    <>
      <div className="space-y-6">
        {/* ...existing code... */}
        <Card>
          {/* ...existing code... */}
        </Card>
      </div>
      {/* Status Tracker Dialog */}
      <QuickFollowUpDialog isOpen={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen} loan={selectedLoanForStatus} />
    </>
  );
}
