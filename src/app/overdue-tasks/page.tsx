
'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { mockLoanRequests } from '@/lib/mock-data';
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';

export default function OverdueTasksPage() {
  const overdueLoans = mockLoanRequests.filter(loan => loan.isOverdue);

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
          {overdueLoans.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
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
