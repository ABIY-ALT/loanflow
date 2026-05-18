'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, FileText, CheckCircle } from 'lucide-react';
import { getLoanRequests, updateLoanRequest } from '@/services/loan-service-prisma';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';

export default function AnalystReview() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const canViewPage = useMemo(
    () => currentUser?.permissions.includes(PERMISSIONS.VIEW_DISTRICT_ANALYST_REVIEW),
    [currentUser]
  );
  const [loans, setLoans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getLoanRequests();
      if ('error' in result) toast({ title: "Error", description: result.error, variant: "destructive" });
      else {
        // Filter for loans assigned to the analyst and in UNDER_ANALYSIS status or District Order 6
        setLoans(result.loans?.filter(l => 
          l.currentStageStatus === "UNDER_ANALYSIS" || 
          (l.submissionType === 'TYPE2' && l.currentStageOrder === 6)
        ) || []);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && canViewPage) {
      fetchData();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, canViewPage]);

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (!canViewPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          You need the Analyst Review permission to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analyst Review Queue</h1>
        <p className="text-muted-foreground mt-2">Perform full loan analysis on cases returned from valuation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned for Analysis</CardTitle>
          <CardDescription>Review all documents and prepare findings for the District Committee.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount (ETB)</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No cases for analysis.</TableCell>
                </TableRow>
              ) : (
                loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.loanNumber}</TableCell>
                    <TableCell>{l.customerName}</TableCell>
                    <TableCell>{l.loanAmount.toLocaleString()}</TableCell>
                    <TableCell>{l.sectorName}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => router.push(`/loan-requests/${l.id}`)}>
                        Analyze Case <FileText className="ml-2 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


    </div>
  );
}
