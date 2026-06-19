'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardEdit, Save, CheckCircle, ExternalLink } from 'lucide-react';
import { getMyValuationCases, getValuationDeptStaff, routeValuationCase } from '@/services/valuation-service';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ValuationQueueItem, ValuationStaff } from '@/types/valuation';

export default function MyValuationCases() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const canViewPage = useMemo(
    () => currentUser?.permissions.includes(PERMISSIONS.VIEW_MY_VALUATION_CASES),
    [currentUser]
  );
  const [cases, setCases] = useState<ValuationQueueItem[]>([]);
  const [staff, setStaff] = useState<ValuationStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<ValuationQueueItem | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [isRouting, setIsRouting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [casesResult, staffResult] = await Promise.all([
        getMyValuationCases(),
        getValuationDeptStaff()
      ]);

      if ('error' in casesResult) toast({ title: "Error", description: casesResult.error, variant: "destructive" });
      else setCases(casesResult.cases || []);

      if ('error' in staffResult) toast({ title: "Error", description: staffResult.error, variant: "destructive" });
      else setStaff(staffResult.staff || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({ title: "Error", description: message, variant: "destructive" });
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

  const handleRoute = async () => {
    if (!selectedCase || !selectedAssignee) return;
    setIsRouting(true);
    try {
      const result = await routeValuationCase(selectedCase.id, 'OFFICER', selectedAssignee);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case assigned to officer successfully." });
        setSelectedCase(null);
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsRouting(false);
    }
  };

  const officers = staff.filter(s => !s.customRole?.name.includes('Manager') && !s.customRole?.name.includes('Director'));

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (!canViewPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          You need the My Valuation permission to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Valuation Cases</h1>
        <p className="text-muted-foreground mt-2">Cases assigned to you for property valuation or management.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Cases</CardTitle>
          <CardDescription>Perform valuation or assign cases to your team of officers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount (ETB)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No assigned cases found.</TableCell>
                </TableRow>
              ) : (
                cases.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                    <TableCell>{c.loanRequest.customerName}</TableCell>
                    <TableCell>{c.loanRequest.loanAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === 'ASSIGNED_TO_MANAGER' ? 'default' : 'secondary'}>
                        {c.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {c.status === 'ASSIGNED_TO_MANAGER' ? (
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedCase(c);
                            setSelectedAssignee('');
                          }}>
                            Assign to Officer
                          </Button>
                        ) : (
                          <Link href={`/loan-requests/${c.loanRequestId}`} passHref>
                            <Button size="sm">
                              View Case <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedCase && (
        <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign to Valuation Officer</DialogTitle>
              <DialogDescription>
                Assigning case {selectedCase.loanRequest.loanNumber} to a field officer.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Officer</label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {officers.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.valuationAssignments.length} active cases)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedCase(null)}>Cancel</Button>
              <Button onClick={handleRoute} disabled={isRouting || !selectedAssignee}>
                {isRouting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Confirm Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
