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
  Loader2, ExternalLink, Undo2, RotateCcw, Eye, CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import {
  getMyValuationCases, getMyCompletedValuationCases, reworkToMakerOfficer, reworkBackOneStage,
} from '@/services/valuation-service';
import { returnToOriginatingCRM, completeValuationWork } from '@/services/loan-service-prisma';
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

// ─────────────────────────────────────────────────────────────────────────────
// Role & Permission Guide for this page
// ─────────────────────────────────────────────────────────────────────────────
// ACCESS:
//   Permission required → VIEW_MY_VALUATION_CASES
//   Roles that typically hold this permission:
//     • Property Valuation Officer  (Maker 01-A — ASSIGNED_TO_OFFICER)
//     • Property Valuation Checker Officer (Checker 01-A — ASSIGNED_TO_CHECKER_OFFICER)
//
// ACTIONS PER STATUS:
//   ASSIGNED_TO_OFFICER (TYPE1 only):
//     • [✓ Mark Completed]  — forwards case to Checker Manager queue
//     • [View Loan]         — read the loan details
//     • [↩ Return to CRM]  — return the case to originating CRM (TYPE1 only)
//
//   ASSIGNED_TO_CHECKER_OFFICER:
//     • [✓ Mark Completed]  — forwards case to Checker Manager final review
//     • [View Loan]         — read the loan details
//     • [↩ Back One Stage]  — rework back to ASSIGNED_TO_CHECKER_MANAGER
//     • [↺ Return to Maker] — rework directly back to the original Maker Officer
//     • [↩ Return to CRM]  — return the case to originating CRM (TYPE1 only)
// ─────────────────────────────────────────────────────────────────────────────

export default function MyValuationCases() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // ── Access guard ────────────────────────────────────────────────────────────
  const canViewPage = useMemo(
    () => currentUser?.permissions.includes(PERMISSIONS.VIEW_MY_VALUATION_CASES),
    [currentUser],
  );

  // ── Data ────────────────────────────────────────────────────────────────────
  const [cases, setCases] = useState<ValuationQueueItem[]>([]);
  const [myCases, setMyCases] = useState<ValuationQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Dialog state ────────────────────────────────────────────────────────────
  // Mark Completed
  const [completeCase, setCompleteCase] = useState<ValuationQueueItem | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Return to CRM
  const [returnCaseId, setReturnCaseId] = useState<string | null>(null);
  const [returnRemark, setReturnRemark] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  // Rework to Maker Officer
  const [reworkQueueId, setReworkQueueId] = useState<string | null>(null);
  const [isReworking, setIsReworking] = useState(false);

  // Rework Back One Stage
  const [reworkBackOneQueueId, setReworkBackOneQueueId] = useState<string | null>(null);
  const [isReworkingBackOne, setIsReworkingBackOne] = useState(false);

  // Shared rework reason
  const [reworkReason, setReworkReason] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
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

  // ── Handlers ────────────────────────────────────────────────────────────────

  /** Mark Completed — TYPE1 only. Advances queue to ASSIGNED_TO_CHECKER_MANAGER
   *  (from ASSIGNED_TO_OFFICER) or PENDING_CHECKER_REVIEW (from ASSIGNED_TO_CHECKER_OFFICER). */
  const handleMarkCompleted = async () => {
    if (!completeCase) return;
    setIsCompleting(true);
    try {
      const result = await completeValuationWork(completeCase.loanRequestId);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Completed', description: 'Case forwarded to Checker Manager queue.' });
        setCompleteCase(null);
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsCompleting(false);
    }
  };

  /** Return case to the originating CRM (TYPE1 Head Office cases only). */
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

  /** Rework directly to the original Maker Officer — skips Checker Manager re-assignment.
   *  Available to: Checker Officer (ASSIGNED_TO_CHECKER_OFFICER) */
  const handleReworkToMakerOfficer = async () => {
    if (!reworkQueueId) return;
    setIsReworking(true);
    try {
      const result = await reworkToMakerOfficer(reworkQueueId, reworkReason);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Case reworked to Valuation Officer (Maker 01-A).' });
        setReworkQueueId(null);
        setReworkReason('');
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsReworking(false);
    }
  };

  /** Rework back one stage in the valuation queue.
   *  Available to: Checker Officer (ASSIGNED_TO_CHECKER_OFFICER) */
  const handleReworkBackOneStage = async () => {
    if (!reworkBackOneQueueId) return;
    setIsReworkingBackOne(true);
    try {
      const result = await reworkBackOneStage(reworkBackOneQueueId, reworkReason);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Case reworked back one stage.' });
        setReworkBackOneQueueId(null);
        setReworkReason('');
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsReworkingBackOne(false);
    }
  };

  // ── Render guards ───────────────────────────────────────────────────────────
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

  // TYPE1 officer-stage cases that can be marked completed
  const completableCases = cases.filter(
    (c) => c.loanRequest.submissionType === 'TYPE1' &&
           (c.status === 'ASSIGNED_TO_OFFICER' || c.status === 'ASSIGNED_TO_CHECKER_OFFICER'),
  );

  // ── UI ──────────────────────────────────────────────────────────────────────
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
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Active Assignments</CardTitle>
                <CardDescription>Cases currently assigned to you. Select a case and mark it completed to advance to the next stage.</CardDescription>
              </div>
              {/* Mark Completed — shown only when there is at least one completable TYPE1 case */}
              {completableCases.length > 0 && (
                <div className="flex flex-col gap-2 shrink-0">
                  {completableCases.map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                      onClick={() => setCompleteCase(c)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Completed — {c.loanRequest.loanNumber}
                    </Button>
                  ))}
                </div>
              )}
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
                            {/* Primary action: view the loan */}
                            <Link href={`/loan-requests/${c.loanRequest.id}`} passHref>
                              <Button size="sm" variant="outline">
                                View Loan <Eye className="ml-1.5 h-3.5 w-3.5" />
                              </Button>
                            </Link>

                            {/* Checker Officer (ASSIGNED_TO_CHECKER_OFFICER) rework icons */}
                            {c.status === 'ASSIGNED_TO_CHECKER_OFFICER' && (
                              <>
                                {/* Back one stage → ASSIGNED_TO_CHECKER_MANAGER */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                  onClick={() => setReworkBackOneQueueId(c.id)}
                                  title="Back One Stage"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>

                                {/* Return directly to Maker Officer (only if one was recorded) */}
                                {c.makerOfficerId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                    onClick={() => setReworkQueueId(c.id)}
                                    title="Return to Valuation Officer (Maker 01-A)"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}

                            {/* Return to CRM — TYPE1 Head Office cases only */}
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

      {/* ── Mark Completed Dialog ── */}
      {completeCase && (
        <Dialog open={!!completeCase} onOpenChange={(open) => { if (!open) setCompleteCase(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Mark Valuation Work as Completed
              </DialogTitle>
              <DialogDescription>
                Case <strong>{completeCase.loanRequest.loanNumber}</strong> — {completeCase.loanRequest.customerName}
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-3 text-sm">
              <div className="p-3 bg-muted rounded-md grid grid-cols-2 gap-2">
                <p><strong>Stage:</strong> {valuationStageLabel(completeCase.status)}</p>
                <p><strong>Amount:</strong> {Number(completeCase.loanRequest.loanAmount).toLocaleString()} ETB</p>
                <p><strong>CRM:</strong> {completeCase.loanRequest.createdBy?.fullName ?? '—'}</p>
                <p><strong>Branch:</strong> {completeCase.loanRequest.customerBranch ?? '—'}</p>
              </div>
              <p className="text-muted-foreground">
                {completeCase.status === 'ASSIGNED_TO_OFFICER'
                  ? 'Marking this case as completed will forward it to the Checker Manager queue for assignment of a Checker Officer (Valuation Checker 01-A).'
                  : 'Marking this case as completed will forward it to the Checker Manager for final review.'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCompleteCase(null)} disabled={isCompleting}>Cancel</Button>
              <Button onClick={handleMarkCompleted} disabled={isCompleting} className="bg-green-600 hover:bg-green-700">
                {isCompleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirm — Mark Completed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Rework to Valuation Officer (Maker 01-A) Dialog ── */}
      {reworkQueueId && (
        <Dialog open={!!reworkQueueId} onOpenChange={(open) => { if (!open) { setReworkQueueId(null); setReworkReason(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rework to Valuation Officer (Maker 01-A)</DialogTitle>
              <DialogDescription>
                This will send the case directly back to the assigned Valuation Officer for corrections.
                After the officer resubmits, the normal Checker chain resumes.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Reason for rework (required)..."
                value={reworkReason}
                onChange={(e) => setReworkReason(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReworkQueueId(null); setReworkReason(''); }} disabled={isReworking}>Cancel</Button>
              <Button onClick={handleReworkToMakerOfficer} disabled={isReworking || !reworkReason.trim()} className="bg-orange-600 hover:bg-orange-700">
                {isReworking ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Rework to Valuation Officer (Maker 01-A)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Rework Back One Stage Dialog ── */}
      {reworkBackOneQueueId && (
        <Dialog open={!!reworkBackOneQueueId} onOpenChange={(open) => { if (!open) { setReworkBackOneQueueId(null); setReworkReason(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rework Back One Stage</DialogTitle>
              <DialogDescription>
                This will send the case back one stage in the valuation workflow.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Reason for rework (required)..."
                value={reworkReason}
                onChange={(e) => setReworkReason(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReworkBackOneQueueId(null); setReworkReason(''); }} disabled={isReworkingBackOne}>Cancel</Button>
              <Button onClick={handleReworkBackOneStage} disabled={isReworkingBackOne || !reworkReason.trim()} className="bg-orange-600 hover:bg-orange-700">
                {isReworkingBackOne ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
                Rework Back One Stage
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
