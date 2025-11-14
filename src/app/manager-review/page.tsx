

'use client';

import Link from 'next/link';
import { ArrowLeft, UserCheck, ExternalLink, Loader2, AlertCircle, Building, Flame, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests } from '@/services/loan-service-prisma';
import type { LoanRequest, User } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PERMISSIONS } from '@/lib/permissions';


export default function ManagerReviewQueuePage() {
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [reviewLoans, setReviewLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewPage = currentUser?.permissions.includes(PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE);

  useEffect(() => {
    if (authIsLoading || !canViewPage) {
      if(!authIsLoading && !canViewPage) setIsLoading(false);
      return;
    }
    
    async function fetchPageData() {
      
      setIsLoading(true);
      setError(null);

      if (!currentUser?.department) {
        setError("Your user profile does not have an assigned department. Cannot display department-specific review queue.");
        setIsLoading(false);
        setReviewLoans([]);
        return;
      }

      try {
        const loansResult = await getLoanRequests();

        if (loansResult.error) {
          setError(loansResult.error);
        } else if (loansResult.loans) {
          const filteredLoans = loansResult.loans.filter(loan => 
            (loan.isReadyForManagerReview || (loan.stageCompletedBy && loan.stageCompletedBy.length > 0)) &&
            loan.assignedToUsers.length > 0 &&
            loan.assignedDepartment === currentUser.department
          );
          setReviewLoans(filteredLoans);
        } else {
          setError(`No loan data received.`);
          setReviewLoans([]);
        }
      } catch (err: any) {
        const errorMessage = err.message || "An unknown error occurred fetching page data.";
        setError(errorMessage);
        setReviewLoans([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
  }, [currentUser, authIsLoading, canViewPage]);

  const getAssignedUserNames = (users: User[]): string => {
    if (users.length === 0) return "N/A";
    return users.map(u => u.fullName).join(', ');
  };
  
  const sortedLoans = useMemo(() => {
    return [...reviewLoans].sort((a, b) => {
      // Prioritize "Ready for Review"
      if (a.isReadyForManagerReview && !b.isReadyForManagerReview) return -1;
      if (!a.isReadyForManagerReview && b.isReadyForManagerReview) return 1;
      // Then prioritize Urgent
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      // Then prioritize Overdue
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Finally, by last updated date
      return new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime();
    });
  }, [reviewLoans]);

  if (isLoading || authIsLoading) { 
     return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading cases for manager review...</p>
      </div>
    );
  }

  if (!canViewPage) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view the manager review queue.</p>
            <Link href="/" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
            </Link>
        </div>
    );
  }


  if (error && reviewLoans.length === 0) { 
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight flex items-center"><UserCheck className="mr-3 h-8 w-8 text-primary" />Manager Review Queue</h1></div>
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
            <UserCheck className="mr-3 h-8 w-8 text-primary" />
            Manager Review Queue
          </h1>
          <p className="text-muted-foreground">
            These loans for the <span className="font-semibold text-primary">{currentUser?.department || 'N/A'}</span> department have been submitted for review. Urgent cases are prioritized.
          </p>
        </div>
        <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
      </div>
      
      {error && (
         <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
            <AlertCircle className="h-5 w-5" />
            <AlertTitleShadCN>Partial Data Error</AlertTitleShadCN>
            <AlertDescriptionShadCN>There was an issue loading some data: {error}</AlertDescriptionShadCN>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cases for Your Review ({reviewLoans.length})</CardTitle>
          <CardDescription>
            Select a case to review its details. Cases marked 'Ready for Review' can be promoted or returned for rework.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedLoans.length === 0 && !isLoading ? (
             <div className="py-10 text-center text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 lucide lucide-check-circle-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              <p className="text-lg font-semibold">No Cases Awaiting Review</p>
              <p>There are currently no loan requests submitted for manager review in your department.</p>
            </div>
          ) : (
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Urgent</TableHead>
                  <TableHead>Completion Status</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Assigned Staff</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLoans.map((loan: LoanRequest) => {
                  const completedCount = loan.stageCompletedBy?.length || 0;
                  const assignedCount = loan.assignedToUsers.length;
                  const completionText = `${completedCount} of ${assignedCount} completed`;

                  return (
                  <TableRow key={loan.id} className={cn("hover:bg-muted/50", loan.isReadyForManagerReview ? "bg-green-50 dark:bg-green-900/20" : "", loan.isUrgent && "border-2 border-red-400 dark:border-red-600")}>
                    <TableCell className="text-center">
                      {loan.isUrgent && <Flame className="h-5 w-5 text-red-500" />}
                    </TableCell>
                    <TableCell>
                      {loan.isReadyForManagerReview ? (
                        <Badge className="bg-green-600 hover:bg-green-700 text-white">Ready for Review</Badge>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <Badge variant="outline">{`Pending Staff (${completionText})`}</Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Waiting for all assigned staff to complete their parts.</p>
                            <ul className="list-disc pl-4 text-xs">
                              {loan.assignedToUsers.map(u => (
                                <li key={u.id} className={loan.stageCompletedBy.some(c => c.id === u.id) ? 'text-green-600' : 'text-amber-600'}>
                                  {u.fullName} ({loan.stageCompletedBy.some(c => c.id === u.id) ? 'Completed' : 'Pending'})
                                </li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{loan.customerName}</TableCell>
                    <TableCell>{loan.loanNumber}</TableCell>
                    <TableCell><Badge variant="secondary">{loan.currentStageName || 'Unknown Stage'}</Badge></TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1.5">
                            <UsersIcon className="h-4 w-4 text-muted-foreground"/>
                            {getAssignedUserNames(loan.assignedToUsers)}
                        </div>
                    </TableCell> 
                    <TableCell>{loan.lastUpdatedDate ? format(parseISO(loan.lastUpdatedDate), 'MMM dd, yyyy') : <span className="text-muted-foreground">N/A</span>}</TableCell>
                    <TableCell className="text-center">
                      <Link href={`/loan-requests/${loan.id}`} passHref>
                        <Button variant="ghost" size="sm">
                          {loan.isReadyForManagerReview ? 'Review & Process' : 'View Details'}
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
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
