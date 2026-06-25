'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, ExternalLink, Undo2, RotateCcw, Eye,
} from 'lucide-react';
import Link from 'next/link';
import {
  getMyValuationCases, getMyCompletedValuationCases, reworkToMakerOfficer,
} from '@/services/valuation-service';
import { returnToOriginatingCRM } from '@/services/loan-service-prisma';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { ValuationQueueItem } from '@/types/valuation';
import { valuationStageLabel } from '@/lib/valuation-stage-labels';

export default function MyValuationCases() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const canViewPage = useMemo(
    () => currentUser?.permissions.includes(PERMISSIONS.VIEW_MY_VALUATION_CASES),
    [currentUser],
  );

  const [cases, setCases] = useState<ValuationQueueItem[]>([]);
  const [myCases, setMyCases] = useState<ValuationQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [returnCaseId, setReturnCaseId] = useState<string | null>(null);
  const [returnRemark, setReturnRemark] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [reworkQueueId, setReworkQueueId] = useState<string | null>(null);
  const [isReworking, setIsReworking] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [activeResult, completedResult] = await Promise.all([
        getMyValuationCases(),
        getMyCompletedValuationCases(),
      ]);
      if ('error' in activeResult) toast({ title: 'Error', description: activeResult.error, variant: 'destructive' });
      else setCases(activeResult.cases || []);

      if ('error' in completedResult) toast({ title: 'Error', description: completedResult.error, variant: 'destructive' });
      else setMyCases(completedResult.cases || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && canViewPage) fetchData();
    else if (!authLoading) setIsLoading(false);
  }, [authLoading, canViewPage]);

  const handleReturnToCRM = async () => {
    if (!returnCaseId) return;
    setIsReturning(true);
    try {
      const result = await returnToOriginatingCRM(returnCaseId, returnRemark);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Case returned to Originating CRM.' });
        setReturnCaseId(null);
        setReturnRemark('');
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsReturning(false);
    }
  };

  const handleReworkToMakerOfficer = async () => {
    if (!reworkQueueId) return;
    setIsReworking(true);
    try {
      const result = await reworkToMakerOfficer(reworkQueueId);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Case reworked to Maker Officer.' });
        setReworkQueueId(null);
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsReworking(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (!canViewPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You need the My Valuation permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Valuation</h1>
        <p className="text-muted-foreground mt-2">Cases assigned to you for property valuation or verification.</p>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active">
            Active Cases
            {cases.length > 0 && <Badge className="ml-2 bg-amber-500">{cases.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="my-cases">
            My Cases
            {myCases.length > 0 && <Badge className="ml-2 bg-blue-500 text-white">{myCases.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Active Cases ── */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Assignments</CardTitle>
              <CardDescription>Cases currently assigned to you. Complete your work to advance the case.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>CRM</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Amount (ETB)</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No active cases assigned to you.</TableCell>
                    </TableRow>
                  ) : (
                    cases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{c.loanRequest.customerName ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.loanRequest.createdBy?.fullName ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.loanRequest.customerBranch ?? '—'}</TableCell>
                        <TableCell>{Number(c.loanRequest.loanAmount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{valuationStageLabel(c.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            {c.loanRequest.submissionType === 'TYPE2' && (
                              <Link href={`/valuation/report/${c.loanRequestId}`} passHref>
                                <Button size="sm">
                                  Open Report <ExternalLink className="ml-2 h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            <Link href={`/loan-requests/${c.loanRequest.id}`} passHref>
                              <Button size="sm" variant="outline">
                                View Loan <Eye className="ml-1.5 h-3.5 w-3.5" />
                              </Button>
                            </Link>

                            {/* Checker Officer can rework directly to Maker Officer */}
                            {c.status === 'ASSIGNED_TO_CHECKER_OFFICER' && c.makerOfficerId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                onClick={() => setReworkQueueId(c.id)}
                                title="Rework to Maker Officer"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}

                            {c.loanRequest.submissionType === 'TYPE1' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                onClick={() => setReturnCaseId(c.loanRequestId)}
                                title="Return to Center CRM"
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
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
        </TabsContent>

        {/* ── My Cases (history) ── */}
        <TabsContent value="my-cases">
          <Card>
            <CardHeader>
              <CardTitle>My Cases</CardTitle>
              <CardDescription>Cases where you have previously completed valuation work. Read-only view.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>CRM</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Amount (ETB)</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead>View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No completed valuation history yet.</TableCell>
                    </TableRow>
                  ) : (
                    myCases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{c.loanRequest.customerName ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.loanRequest.createdBy?.fullName ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.loanRequest.customerBranch ?? '—'}</TableCell>
                        <TableCell>{Number(c.loanRequest.loanAmount).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="secondary">{valuationStageLabel(c.status)}</Badge></TableCell>
                        <TableCell className="text-sm">{new Date(c.updatedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Link href={`/loan-requests/${c.loanRequest.id}`} passHref>
                            <Button size="sm" variant="outline">
                              View Loan <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Rework to Maker Officer Dialog ── */}
      {reworkQueueId && (
        <Dialog open={!!reworkQueueId} onOpenChange={(open) => { if (!open) setReworkQueueId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rework to Maker Officer</DialogTitle>
              <DialogDescription>
                This will send the case directly back to the assigned Valuation Maker Officer for corrections.
                After the officer resubmits, the normal Checker chain resumes.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">The rework action will be recorded in the workflow history.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReworkQueueId(null)} disabled={isReworking}>Cancel</Button>
              <Button onClick={handleReworkToMakerOfficer} disabled={isReworking} className="bg-orange-600 hover:bg-orange-700">
                {isReworking ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Rework to Maker Officer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Return to CRM Dialog ── */}
      {returnCaseId && (
        <Dialog open={!!returnCaseId} onOpenChange={(open) => { if (!open) { setReturnCaseId(null); setReturnRemark(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Return Case to Originating CRM</DialogTitle>
              <DialogDescription>Provide a remark explaining why this case is being returned.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Enter your remark here..."
                value={returnRemark}
                onChange={(e) => setReturnRemark(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReturnCaseId(null); setReturnRemark(''); }} disabled={isReturning}>Cancel</Button>
              <Button onClick={handleReturnToCRM} disabled={isReturning || !returnRemark.trim()}>
                {isReturning ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
                Return to CRM
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
