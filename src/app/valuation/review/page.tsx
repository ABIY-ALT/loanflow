'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Eye, ArrowRight } from 'lucide-react';
import { approveValuationReport, checkValuationReport, getValuationReviewQueue } from '@/services/valuation-service';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LoanRequest } from '@/types/loan';
import type { ValuationQueueItem } from '@/types/valuation';

export default function ValuationReviewQueue() {
  const { user } = useAuth();
  const [cases, setCases] = useState<ValuationQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<ValuationQueueItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const getCustomerName = (loanRequest: LoanRequest) => loanRequest.customerName ?? 'N/A';

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getValuationReviewQueue();
      if ('error' in result) toast({ title: "Error", description: result.error, variant: "destructive" });
      else setCases(result.cases || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async () => {
    if (!selectedCase) return;
    setIsProcessing(true);
    try {
      const result = await approveValuationReport(selectedCase.id);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Valuation approved." });
        setSelectedCase(null);
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheck = async () => {
    if (!selectedCase) return;
    setIsProcessing(true);
    try {
      const result = await checkValuationReport(selectedCase.id);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Valuation marked as checked." });
        setSelectedCase(null);
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Valuation Review Queue</h1>
        <p className="text-muted-foreground mt-2">Pending reviews for property valuation reports.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reports Awaiting Review</CardTitle>
          <CardDescription>Review and approve valuation reports before returning to district.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No reports awaiting review.</TableCell>
                </TableRow>
              ) : (
                cases.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                    <TableCell>{getCustomerName(c.loanRequest)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline">{c.status.replace(/_/g, ' ')}</Badge>
                        {c.isCheckedByChecker && (
                          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-[10px] py-0 h-4">Checked</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{c.assignedTo?.name}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => setSelectedCase(c)}>
                        Review Report <Eye className="ml-2 h-4 w-4" />
                      </Button>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Valuation Report</DialogTitle>
              <DialogDescription>
                Review the findings submitted for {selectedCase.loanRequest.loanNumber}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
               <div className="p-4 bg-muted rounded-md space-y-2">
                  <p><strong>Applicant:</strong> {getCustomerName(selectedCase.loanRequest)}</p>
                  <p><strong>Loan Amount:</strong> {selectedCase.loanRequest.loanAmount.toLocaleString()} ETB</p>
                  <p><strong>Valuation Status:</strong> {selectedCase.status.replace(/_/g, ' ')}</p>
                  {selectedCase.isCheckedByChecker && (
                    <p className="text-green-600 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Checked by Checker
                    </p>
                  )}
               </div>
               <div className="space-y-2">
                  <h4 className="font-bold">Officer Findings</h4>
                  {selectedCase.loanRequest.valuationReportData ? (
                    <div className="text-sm space-y-2 border p-3 rounded-md bg-white">
                      <p><strong>Estimated Value:</strong> {selectedCase.loanRequest.valuationReportData.estimatedValue} ETB</p>
                      <p><strong>Method:</strong> {selectedCase.loanRequest.valuationReportData.valuationMethod}</p>
                      <p><strong>Property:</strong> {selectedCase.loanRequest.valuationReportData.propertyDescription}</p>
                      <p><strong>Observations:</strong> {selectedCase.loanRequest.valuationReportData.locationObservations}</p>
                      <p><strong>Recommendation:</strong> {selectedCase.loanRequest.valuationReportData.finalRecommendation}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No detailed findings found in the report data.</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 italic">Detailed history is available in the Audit Trail.</p>
               </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedCase(null)}>Cancel</Button>
              
              {/* Checker Action */}
              {user?.customRoleName?.includes('Checker') && selectedCase.status === "PENDING_MANAGER_REVIEW" && !selectedCase.isCheckedByChecker && (
                <Button onClick={handleCheck} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
                  {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Mark as Checked
                </Button>
              )}

              {/* Manager/Director Approval */}
              {(
                (selectedCase.status === "PENDING_MANAGER_REVIEW" && (user?.customRoleName?.includes('Manager') || user?.customRoleName?.includes('Director') || user?.permissions.includes('PROMOTE_LOAN_STAGE'))) ||
                (selectedCase.status === "PENDING_DIRECTOR_REVIEW" && (user?.customRoleName?.includes('Director') || user?.permissions.includes('PROMOTE_LOAN_STAGE'))) ||
                (user?.permissions.includes('MANAGE_USERS')) // Admin
              ) && (
                <Button onClick={handleApprove} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
                  {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {selectedCase.status === "PENDING_MANAGER_REVIEW" ? "Approve & Send to Director" : "Final Approval"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
