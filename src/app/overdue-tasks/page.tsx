
'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ExternalLink, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests } from '@/services/loan-service'; 
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription as AlertDescShadCN, AlertTitle as AlertTitleShadCN } from '@/components/ui/alert';


export default function OverdueTasksPage() {
  const [overdueLoans, setOverdueLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOverdueLoans() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getLoanRequests(); 
        if (result.error) {
          console.error("Error from getLoanRequests service in OverdueTasksPage:", result.error, result);
          setError(result.error);
        } else if (result.loans) {
          setOverdueLoans(result.loans.filter(loan => loan.isOverdue));
        } else {
           setError("No loan data received for overdue tasks.");
           setOverdueLoans([]);
        }
      } catch (err: any) {
        console.error("Error fetching overdue loans in component:", err);
        const errorMessage = err.message || "An unknown error occurred fetching overdue tasks.";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
    fetchOverdueLoans();
  }, []);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading overdue tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <AlertTriangle className="mr-3 h-8 w-8 text-destructive" />
              Overdue Loan Tasks
            </h1>
          </div>
           <Link href="/" passHref>
            <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Button>
            </Link>
        </div>
        <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitleShadCN>Error Fetching Overdue Tasks</AlertTitleShadCN>
            <AlertDescShadCN className="whitespace-pre-wrap">
            {error} Please try refreshing the page.
            </AlertDescShadCN>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <AlertTriangle className="mr-3 h-8 w-8 text-destructive" />
            Overdue Loan Tasks
          </h1>
          <p className="text-muted-foreground">
            These loan requests have passed their stage deadlines and require attention.
          </p>
        </div>
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overdue Items ({overdueLoans.length})</CardTitle>
          <CardDescription>
            Review the details and take appropriate action for each overdue loan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overdueLoans.length === 0 && !isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 lucide lucide-check-circle-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              <p className="text-lg font-semibold">No Overdue Tasks</p>
              <p>All loan requests are currently on schedule.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead className="text-right">Stage Deadline</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueLoans.map((loan: LoanRequest) => (
                  <TableRow key={loan.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{loan.customerName}</TableCell>
                    <TableCell>{loan.loanNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{loan.currentStage}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {loan.stageDeadline ? (
                        <span className="text-destructive font-semibold flex items-center justify-end">
                          <Clock className="mr-1 h-4 w-4" />
                          {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/loan-requests/${loan.id}`} passHref>
                        <Button variant="ghost" size="sm">
                          View Details
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
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
