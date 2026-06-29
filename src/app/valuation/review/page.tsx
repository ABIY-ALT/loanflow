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
  Loader2, CheckCircle2, Eye, RotateCcw, UserCheck, Undo2, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { valuationStageLabel } from '@/lib/valuation-stage-labels';
import {
  approveValuationReport,
  getValuationReviewQueue,
  getMyAssignedValuationCases,
  getValuationDeptStaff,
  routeValuationCase,
  reworkToMakerOfficer,
  reworkBackOneStage,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ValuationQueueItem, ValuationStaff } from '@/types/valuation';

function actionBadge(status: string) {
  const label = valuationStageLabel(status);
  if (status === 'ASSIGNED_TO_MANAGER' || status === 'ASSIGNED_TO_CHECKER_MANAGER')
    return <Badge variant="outline" className="text-blue-700 border-blue-200">{label} — Needs Assignment</Badge>;
  if (status === 'PENDING_FINALIZATION')
    return <Badge variant="outline" className="text-green-700 border-green-200">{label}</Badge>;
  if (status === 'PENDING_CHECKER_REVIEW')
    return <Badge variant="outline" className="text-purple-700 border-purple-200">{label}</Badge>;
  return <Badge variant="secondary">{label}</Badge>;
}

export default function ValuationReviewQueue() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const isAdmin = user?.permissions.includes(PERMISSIONS.MANAGE_USERS) ?? false;
  const hasReviewPerm = user?.permissions.includes(PERMISSIONS.VIEW_VALUATION_REVIEW) ?? false;
  const isMakerMgr = !!user?.customRoleName?.includes('Manager') && !!user?.customRoleName?.includes('Maker');
  const isCheckerMgr = !!user?.customRoleName?.includes('Manager') && !!user?.customRoleName?.includes('Checker');
  const canAccess = isAdmin || hasReviewPerm || isMakerMgr || isCheckerMgr;

  const [cases, setCases] = useState<ValuationQueueItem[]>([]);
  const [assignedByCases, setAssignedByCases] = useState<ValuationQueueItem[]>([]);
  const [staff, setStaff] = useState<ValuationStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Assign Officer dialog
  const [assignCase, setAssignCase] = useState<ValuationQueueItem | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Review dialog (PENDING_CHECKER_REVIEW / PENDING_FINALIZATION)
  const [reviewCase, setReviewCase] = useState<ValuationQueueItem | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isReworkingToOfficer, setIsReworkingToOfficer] = useState(false);
  const [isReworkingBackOne, setIsReworkingBackOne] = useState(false);
  const [reworkReason, setReworkReason] = useState('');

  // Return to CRM
  const [returnCaseId, setReturnCaseId] = useState<string | null>(null);
  const [returnRemark, setReturnRemark] = useState('');
  const [isReturning, setIsReturning] = useState(false);

  const officers = useMemo(
    () => staff.filter(s => s.customRole?.name === 'Property Valuation Officer'),
    [staff],
  );

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [queueResult, assignedResult, staffResult] = await Promise.all([
        getValuationReviewQueue(),
        getMyAssignedValuationCases(),
        getValuationDeptStaff(),
      ]);
      if ('error' in queueResult) toast({ title: 'Error', description: queueResult.error, variant: 'destructive' });
      else setCases(queueResult.cases || []);

      if ('error' in assignedResult) toast({ title: 'Error', description: assignedResult.error, variant: 'destructive' });
      else setAssignedByCases(assignedResult.cases || []);

      if ('error' in staffResult) toast({ title: 'Error', description: staffResult.error, variant: 'destructive' });
      else setStaff(staffResult.staff || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && canAccess) fetchData();
    else if (!authLoading) setIsLoading(false);
  }, [authLoading, canAccess]);

  const handleAssignOfficer = async () => {
    if (!assignCase || !selectedAssignee) return;
    setIsAssigning(true);
    try {
      const result = await routeValuationCase(assignCase.id, 'OFFICER', selectedAssignee);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Officer assigned successfully.' });
        setAssignCase(null);
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleApprove = async () => {
    if (!reviewCase) return;
    setIsApproving(true);
    try {
      const result = await approveValuationReport(reviewCase.id);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Approved successfully.' });
        setReviewCase(null);
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReworkToMakerOfficer = async () => {
    if (!reviewCase) return;
    if (!reworkReason.trim()) {
      toast({ title: 'Reason required', description: 'Enter why this case is being reworked.', variant: 'destructive' });
      return;
    }
    setIsReworkingToOfficer(true);
    try {
      const result = await reworkToMakerOfficer(reviewCase.id, reworkReason);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Case reworked to Maker Officer.' });
        setReviewCase(null);
        setReworkReason('');
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsReworkingToOfficer(false);
    }
  };

  const handleReworkBackOneStage = async () => {
    if (!reviewCase) return;
    if (!reworkReason.trim()) {
      toast({ title: 'Reason required', description: 'Enter why this case is being reworked.', variant: 'destructive' });
      return;
    }
    setIsReworkingBackOne(true);
    try {
      const result = await reworkBackOneStage(reviewCase.id, reworkReason);
      if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Case reworked back one stage.' });
        setReviewCase(null);
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

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only Valuation Managers can access this page.</p>
      </div>
    );
  }

  const isAssignStage = (status: string) =>
    status === 'ASSIGNED_TO_MANAGER' || status === 'ASSIGNED_TO_CHECKER_MANAGER';

  const isReviewStage = (status: string) =>
    status === 'PENDING_CHECKER_REVIEW' || status === 'PENDING_FINALIZATION';

  const needsAction = cases.filter(c => isAssignStage(c.status) || isReviewStage(c.status));

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Valuation Review</h1>
        <p className="text-muted-foreground mt-2">
          {isMakerMgr && 'Assign officers and finalize valuations.'}
          {isCheckerMgr && 'Assign checker officers and review verification reports.'}
          {isAdmin && !isMakerMgr && !isCheckerMgr && 'Manage valuation review queue.'}
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList>
          <TabsTrigger value="active">
            Active Work
            {needsAction.length > 0 && <Badge className="ml-2 bg-amber-500">{needsAction.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="assigned-by-me">
            Assigned By Me
            {assignedByCases.length > 0 && <Badge className="ml-2 bg-blue-500 text-white">{assignedByCases.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Active Work ── */}
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Cases Requiring Action</CardTitle>
              <CardDescription>
                {isMakerMgr && 'Assign Maker Officers to new cases; finalize valuations ready for completion.'}
                {isCheckerMgr && 'Assign Checker Officers to incoming verification cases; approve or rework final reports.'}
                {isAdmin && !isMakerMgr && !isCheckerMgr && 'All manager-stage valuation cases.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>CRM</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Current Assignee</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No cases require your action.</TableCell>
                    </TableRow>
                  ) : (
                    cases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{c.loanRequest.customerName ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.loanRequest.createdBy?.fullName ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.loanRequest.customerBranch ?? '—'}</TableCell>
                        <TableCell className="text-sm">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{actionBadge(c.status)}</TableCell>
                        <TableCell className="text-sm">{c.assignedTo?.name ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            {isAssignStage(c.status) && (
                              <Button size="sm" onClick={() => { setAssignCase(c); setSelectedAssignee(''); }}>
                                <UserCheck className="h-4 w-4 mr-1" />
                                Assign Officer
                              </Button>
                            )}
                            {isReviewStage(c.status) && (
                              <Button size="sm" onClick={() => setReviewCase(c)} className="bg-purple-600 hover:bg-purple-700">
                                <Eye className="h-4 w-4 mr-1" />
                                {c.status === 'PENDING_FINALIZATION' ? 'Finalize' : 'Review'}
                              </Button>
                            )}
                            <Link href={`/loan-requests/${c.loanRequest.id}`} passHref>
                              <Button size="sm" variant="outline">
                                View Loan <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-200 hover:bg-amber-50"
                              onClick={() => setReturnCaseId(c.loanRequestId)}
                              title="Return to Originating CRM"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
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

        {/* ── Assigned By Me ── */}
        <TabsContent value="assigned-by-me">
          <Card>
            <CardHeader>
              <CardTitle>Assigned By Me</CardTitle>
              <CardDescription>Cases you have previously assigned. Read-only tracking view.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>CRM</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Current Assignee</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead>View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedByCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No cases assigned by you yet.</TableCell>
                    </TableRow>
                  ) : (
                    assignedByCases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{c.loanRequest.customerName ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.loanRequest.createdBy?.fullName ?? '—'}</TableCell>
                        <TableCell className="text-sm">{c.loanRequest.customerBranch ?? '—'}</TableCell>
                        <TableCell><Badge variant="secondary">{valuationStageLabel(c.status)}</Badge></TableCell>
                        <TableCell className="text-sm">{c.assignedTo?.name ?? '—'}</TableCell>
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

      {/* ── Assign Officer Dialog ── */}
      {assignCase && (
        <Dialog open={!!assignCase} onOpenChange={() => setAssignCase(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {assignCase.status === 'ASSIGNED_TO_CHECKER_MANAGER'
                  ? 'Assign Checker Officer'
                  : 'Assign Maker Officer'}
              </DialogTitle>
              <DialogDescription>
                Assigning case {assignCase.loanRequest.loanNumber} — {assignCase.loanRequest.customerName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-md text-xs grid grid-cols-2 gap-2">
                <p><strong>CRM:</strong> {assignCase.loanRequest.createdBy?.fullName ?? '—'}</p>
                <p><strong>Branch:</strong> {assignCase.loanRequest.customerBranch ?? '—'}</p>
                <p><strong>Amount:</strong> {Number(assignCase.loanRequest.loanAmount).toLocaleString()} ETB</p>
                <p><strong>Stage:</strong> {valuationStageLabel(assignCase.status)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Officer</label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Valuation Officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {officers.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.valuationAssignments.length} active cases)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {officers.length === 0 && (
                  <p className="text-xs text-amber-600">No Valuation Officers are available in the department.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignCase(null)}>Cancel</Button>
              <Button onClick={handleAssignOfficer} disabled={isAssigning || !selectedAssignee}>
                {isAssigning ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                Confirm Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Review Dialog (PENDING_CHECKER_REVIEW / PENDING_FINALIZATION) ── */}
      {reviewCase && (
        <Dialog open={!!reviewCase} onOpenChange={(open) => { if (!open) { setReviewCase(null); setReworkReason(''); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {reviewCase.status === 'PENDING_FINALIZATION'
                  ? 'Finalize Valuation'
                  : 'Review Verification Report'}
              </DialogTitle>
              <DialogDescription>
                Case {reviewCase.loanRequest.loanNumber} — {reviewCase.loanRequest.customerName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted rounded-md text-sm">
                <div><span className="text-muted-foreground">Customer</span><p className="font-semibold">{reviewCase.loanRequest.customerName}</p></div>
                <div><span className="text-muted-foreground">Loan Amount</span><p className="font-semibold">{Number(reviewCase.loanRequest.loanAmount).toLocaleString()} ETB</p></div>
                <div><span className="text-muted-foreground">CRM</span><p className="font-semibold">{reviewCase.loanRequest.createdBy?.fullName ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Branch</span><p className="font-semibold">{reviewCase.loanRequest.customerBranch ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Stage</span><Badge variant="outline">{valuationStageLabel(reviewCase.status)}</Badge></div>
                <div><span className="text-muted-foreground">Maker Officer</span><p className="font-semibold">{reviewCase.makerOfficer?.name ?? '—'}</p></div>
              </div>

              {reviewCase.loanRequest.valuationReportData && (
                <div className="space-y-2">
                  <h4 className="font-bold text-sm">Officer Findings</h4>
                  <div className="text-sm space-y-1 border p-3 rounded-md bg-white">
                    <p><strong>Estimated Value:</strong> {reviewCase.loanRequest.valuationReportData.estimatedValue} ETB</p>
                    <p><strong>Method:</strong> {reviewCase.loanRequest.valuationReportData.valuationMethod}</p>
                    <p><strong>Property:</strong> {reviewCase.loanRequest.valuationReportData.propertyDescription}</p>
                    <p><strong>Observations:</strong> {reviewCase.loanRequest.valuationReportData.locationObservations}</p>
                    <p><strong>Recommendation:</strong> {reviewCase.loanRequest.valuationReportData.finalRecommendation}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground italic">Full history is available in the case Audit Trail.</p>

              {reviewCase.status === 'PENDING_CHECKER_REVIEW' && (isCheckerMgr || isAdmin) && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Rework reason <span className="text-muted-foreground">(required to rework)</span></label>
                  <Textarea
                    placeholder="State why this case is being reworked..."
                    value={reworkReason}
                    onChange={(e) => setReworkReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => { setReviewCase(null); setReworkReason(''); }}>Cancel</Button>

              {/* Checker Manager: Rework options */}
              {reviewCase.status === 'PENDING_CHECKER_REVIEW' && (isCheckerMgr || isAdmin) && (
                <>
                  <Button
                    onClick={handleReworkBackOneStage}
                    disabled={isReworkingBackOne || isApproving || isReworkingToOfficer || !reworkReason.trim()}
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    {isReworkingBackOne
                      ? <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      : <Undo2 className="h-4 w-4 mr-2" />}
                    Back One Stage
                  </Button>

                  {reviewCase.makerOfficerId && (
                <Button
                  onClick={handleReworkToMakerOfficer}
                  disabled={isReworkingToOfficer || isApproving || isReworkingBackOne || !reworkReason.trim()}
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  {isReworkingToOfficer
                    ? <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    : <RotateCcw className="h-4 w-4 mr-2" />}
                  Return to Valuation Officer (Maker 01-A)
                </Button>
              )}
                </>
              )}

              {/* Checker Manager: Approve verification */}
              {reviewCase.status === 'PENDING_CHECKER_REVIEW' && (isCheckerMgr || isAdmin) && (
                <Button onClick={handleApprove} disabled={isApproving || isReworkingToOfficer || isReworkingBackOne} className="bg-green-600 hover:bg-green-700">
                  {isApproving
                    ? <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Approve Verification
                </Button>
              )}

              {/* Maker Manager: Finalize valuation */}
              {reviewCase.status === 'PENDING_FINALIZATION' && (isMakerMgr || isAdmin) && (
                <Button onClick={handleApprove} disabled={isApproving} className="bg-green-600 hover:bg-green-700">
                  {isApproving
                    ? <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Finalize Valuation
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Return to CRM Dialog ── */}
      {returnCaseId && (
        <Dialog open={!!returnCaseId} onOpenChange={(open) => {
          if (!open) { setReturnCaseId(null); setReturnRemark(''); }
        }}>
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
