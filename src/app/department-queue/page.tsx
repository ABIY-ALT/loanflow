
'use client';

import Link from 'next/link';
import { ArrowLeft, FolderKanban, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests } from '@/services/loan-service'; 
import type { LoanRequest } from '@/types/loan';
import { LoanStage } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect } from 'react';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';

export default function DepartmentQueuePage() {
  const [unassignedLoans, setUnassignedLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUnassignedLoans() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getLoanRequests(); 
        if (result.error) {
          console.error("Error from getLoanRequests service in DepartmentQueuePage:", result.error, result);
          setError(result.error);
          setUnassignedLoans([]);
        } else if (result.loans) {
          const filteredLoans = result.loans.filter(loan => 
            !loan.assignedTo && 
            ![LoanStage.REJECTED, LoanStage.FUNDS_DISBURSED].includes(loan.currentStage)
          );
          setUnassignedLoans(filteredLoans);
        } else {
           setError("No loan data received for unassigned cases queue.");
           setUnassignedLoans([]);
        }
      } catch (err: any) {
        console.error("Error fetching unassigned loans in component:", err);
        const errorMessage = err.message || "An unknown error occurred fetching unassigned cases.";
        setError(errorMessage);
        setUnassignedLoans([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUnassignedLoans();
  }, []);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading unassigned cases...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <FolderKanban className="mr-3 h-8 w-8 text-primary" />
              Unassigned Loan Cases
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
            <AlertCircle className="h-5 w-5" />
            <AlertTitleShadCN>Error Fetching Unassigned Cases</AlertTitleShadCN>
            <AlertDescriptionShadCN className="whitespace-pre-wrap">
            {error} Please try refreshing the page or check console for details.
            </AlertDescriptionShadCN>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <FolderKanban className="mr-3 h-8 w-8 text-primary" />
            Unassigned Loan Cases
          </h1>
          <p className="text-muted-foreground">
            These loans are awaiting assignment to a team member for the current stage.
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
          <CardTitle>Cases Awaiting Assignment ({unassignedLoans.length})</CardTitle>
          <CardDescription>
            Review and assign these loans via their detail pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {unassignedLoans.length === 0 && !isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 lucide lucide-check-circle-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              <p className="text-lg font-semibold">No Unassigned Cases</p>
              <p>All active loans currently have an assigned team member.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Current Stage</TableHead>
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
                      <Badge variant="outline">{loan.currentStage}</Badge>
                    </TableCell>
                    <TableCell>
                      {loan.lastUpdatedDate ? (
                        format(parseISO(loan.lastUpdatedDate), 'MMM dd, yyyy')
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/loan-requests/${loan.id}`} passHref>
                        <Button variant="ghost" size="sm">
                          View & Assign
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
