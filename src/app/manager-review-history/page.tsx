'use client';

import Link from 'next/link';
import { ArrowLeft, History, Loader2, AlertCircle, Download, Inbox, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getCaseReviewHistory, type CaseReviewRecord } from '@/services/loan-service-prisma';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function ManagerReviewHistoryPage() {
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [reviews, setReviews] = useState<CaseReviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewPage = useMemo(
    () => currentUser?.permissions.includes(PERMISSIONS.VIEW_MANAGER_REVIEW_HISTORY),
    [currentUser]
  );

  useEffect(() => {
    if (authIsLoading || !canViewPage || !currentUser) {
      if (!authIsLoading) setIsLoading(false);
      return;
    }

    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getCaseReviewHistory();
        if (result.error) {
          setError(result.error);
          setReviews([]);
        } else if (result.reviews) {
          setReviews(result.reviews);
        } else {
          setError('No review data received.');
          setReviews([]);
        }
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
        setReviews([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [currentUser, authIsLoading, canViewPage]);

  const exportToCSV = () => {
    if (reviews.length === 0) return;
    const headers = ['Case ID', 'Loan Number', 'Customer Name', 'Action', 'Approved By', 'Department', 'Date', 'Final Status', 'Comment'];
    const csvData = reviews.map(r => [
      r.loanRequestId,
      r.loanNumber,
      r.customerName,
      r.action,
      r.performedByName,
      r.performedByDepartment || '',
      r.createdAt ? format(parseISO(r.createdAt), 'MMM dd, yyyy HH:mm') : '',
      r.finalStatus || '',
      r.comment || '',
    ]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'manager-review-history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (authIsLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton className="h-9 w-80 mb-2" />
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
        <p className="text-muted-foreground mb-6">You do not have permission to view the manager review history.</p>
        <Link href="/" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (error && reviews.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <History className="mr-3 h-8 w-8 text-primary" />Manager Review History
            </h1>
          </div>
          <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
        </div>
        <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
          <AlertCircle className="h-5 w-5" />
          <AlertTitleShadCN>Error Loading Data</AlertTitleShadCN>
          <AlertDescriptionShadCN>{error}</AlertDescriptionShadCN>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <History className="mr-3 h-8 w-8 text-primary" />
            Manager Review History
          </h1>
          <p className="text-muted-foreground">
            Track all approval and rejection decisions made by managers and directors.
          </p>
        </div>
        <div className="flex gap-2">
          {reviews.length > 0 && (
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          )}
          <Link href="/" passHref>
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
          </Link>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
          <AlertCircle className="h-5 w-5" />
          <AlertTitleShadCN>Partial Data Error</AlertTitleShadCN>
          <AlertDescriptionShadCN>{error}</AlertDescriptionShadCN>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Review Decisions ({reviews.length})</CardTitle>
          <CardDescription>All manager approval and rejection decisions. Click a loan number to view details.</CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Inbox className="mx-auto mb-4 h-12 w-12" />
              <p className="text-lg font-semibold">No Review History</p>
              <p className="mt-1">No approval or rejection decisions have been recorded yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Approved/Rejected By</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Final Status</TableHead>
                  <TableHead>Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id} className="hover:bg-muted/50">
                    <TableCell>
                      {review.action === 'APPROVED' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Approved
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />Rejected
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/loan-requests/${review.loanRequestId}`} className="text-primary hover:underline">
                        {review.loanNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{review.customerName}</TableCell>
                    <TableCell>{review.performedByName}</TableCell>
                    <TableCell>{review.performedByDepartment || 'N/A'}</TableCell>
                    <TableCell>{format(parseISO(review.createdAt), 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell>
                      {review.finalStatus ? (
                        <Badge variant="secondary">{review.finalStatus}</Badge>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={review.comment || ''}>
                      {review.comment || '-'}
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
