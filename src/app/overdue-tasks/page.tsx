
'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ExternalLink, Clock, Loader2, AlertCircle, Building, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { Alert, AlertDescription as AlertDescShadCN, AlertTitle as AlertTitleShadCN } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type OverdueFilter = 'all' | 'department' | 'my-assigned';

export default function OverdueTasksPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [allOverdueLoans, setAllOverdueLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OverdueFilter>('all');

  const canViewPage = user?.permissions.includes(PERMISSIONS.VIEW_OVERDUE_TASKS_REPORT);

  useEffect(() => {
    if (authLoading || !canViewPage) {
        if(!authLoading && !canViewPage) setIsLoading(false);
        return;
    }

    async function fetchPageData() {
      setIsLoading(true);
      setError(null);
      try {
        const loansResult = await getLoanRequests();

        if (loansResult.error) {
          setError(loansResult.error);
          setAllOverdueLoans([]);
        } else if (loansResult.loans) {
          setAllOverdueLoans(loansResult.loans.filter((loan) => loan.isOverdue));
        } else {
          setError(`No loan data received.`);
          setAllOverdueLoans([]);
        }

      } catch (err: any) {
        const errorMessage = err.message || "An unknown error occurred fetching page data.";
        setError(errorMessage);
        setAllOverdueLoans([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
  }, [authLoading, canViewPage]);

  const filteredLoans = useMemo(() => {
    if (filter === 'my-assigned') {
      return allOverdueLoans.filter(l => l.assignedToUsers.some(u => u.id === user?.id));
    }
    if (filter === 'department') {
      return allOverdueLoans.filter(l => l.assignedDepartment === user?.department);
    }
    return allOverdueLoans;
  }, [allOverdueLoans, filter, user]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading overdue tasks...</p>
      </div>
    );
  }

  if (!canViewPage) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view overdue tasks.</p>
            <Link href="/" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
            </Link>
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
      
      {error && (
         <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
            <AlertCircle className="h-5 w-5" />
            <AlertTitleShadCN>Partial Data Error</AlertTitleShadCN>
            <AlertDescriptionShadCN>There was an issue loading some data: {error}</AlertDescriptionShadCN>
        </Alert>
      )}

      <Tabs defaultValue="all" onValueChange={(v) => setFilter(v as OverdueFilter)} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all" className="gap-2"><Users className="h-4 w-4"/> All Overdue ({allOverdueLoans.length})</TabsTrigger>
          <TabsTrigger value="department" className="gap-2"><Building className="h-4 w-4"/> My Dept ({allOverdueLoans.filter(l => l.assignedDepartment === user?.department).length})</TabsTrigger>
          <TabsTrigger value="my-assigned" className="gap-2"><User className="h-4 w-4"/> My Assigned ({allOverdueLoans.filter(l => l.assignedToUsers.some(u => u.id === user?.id)).length})</TabsTrigger>
        </TabsList>

        <Card>
          <CardHeader>
            <CardTitle>Overdue Items ({filteredLoans.length})</CardTitle>
            <CardDescription>
              Review the details and take appropriate action for each overdue loan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLoans.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                <AlertCircle className="mx-auto h-12 w-12 opacity-20 mb-4" />
                <p className="text-lg font-semibold">No Overdue Tasks Found</p>
                <p>All loan requests in this view are currently on schedule.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Stage Deadline</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan: LoanRequest) => (
                    <TableRow key={loan.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{loan.customerName}</TableCell>
                      <TableCell>{loan.loanNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{loan.currentStageName || 'Unknown Stage'}</Badge>
                      </TableCell>
                      <TableCell>{loan.assignedDepartment || 'N/A'}</TableCell>
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
      </Tabs>
    </div>
  );
}
