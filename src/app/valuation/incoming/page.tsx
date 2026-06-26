'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, UserCheck, Users, Info, Undo2, Eye, Phone, ExternalLink, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { getIncomingValuationCases, getValuationDeptStaff, routeValuationCase, getValuationCasesByAssigner, getDirectorFinalizationQueue, approveValuationReport } from '@/services/valuation-service';
import { returnToOriginatingCRM } from '@/services/loan-service-prisma';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { ValuationQueueItem, ValuationStaff } from '@/types/valuation';
import type { LoanRequest } from '@/types/loan';
import { valuationStageLabel } from '@/lib/valuation-stage-labels';

function CrmCell({ loan }: { loan: LoanRequest }) {
  const name = loan.createdBy?.fullName || '—';
  const phone = loan.createdBy?.phoneNumber;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium">{name}</span>
      {phone && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />{phone}
        </span>
      )}
    </div>
  );
}

export default function ValuationIncomingQueue() {
  const [cases, setCases] = useState<ValuationQueueItem[]>([]);
  const [assignedCases, setAssignedCases] = useState<ValuationQueueItem[]>([]);
  const [finalizationCases, setFinalizationCases] = useState<ValuationQueueItem[]>([]);
  const [finalizeCase, setFinalizeCase] = useState<ValuationQueueItem | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [staff, setStaff] = useState<ValuationStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<ValuationQueueItem | null>(null);
  const [viewCase, setViewCase] = useState<ValuationQueueItem | null>(null);
  const [routingOption, setRoutingOption] = useState<'MANAGER' | 'OFFICER'>('OFFICER');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [isRouting, setIsRouting] = useState(false);
  const [returnCaseId, setReturnCaseId] = useState<string | null>(null);
  const [returnRemark, setReturnRemark] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [casesResult, staffResult, assignedResult, finalizationResult] = await Promise.all([
        getIncomingValuationCases(),
        getValuationDeptStaff(),
        getValuationCasesByAssigner(),
        getDirectorFinalizationQueue()
      ]);

      if ('error' in casesResult) toast({ title: "Error", description: casesResult.error, variant: "destructive" });
      else setCases(casesResult.cases || []);

      if ('error' in staffResult) toast({ title: "Error", description: staffResult.error, variant: "destructive" });
      else setStaff(staffResult.staff || []);

      if ('error' in assignedResult) toast({ title: "Error", description: assignedResult.error, variant: "destructive" });
      else setAssignedCases(assignedResult.cases || []);

      if ('error' in finalizationResult) toast({ title: "Error", description: finalizationResult.error, variant: "destructive" });
      else setFinalizationCases(finalizationResult.cases || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRoute = async () => {
    if (!selectedCase || !selectedAssignee) return;
    setIsRouting(true);
    try {
      const result = await routeValuationCase(selectedCase.id, routingOption, selectedAssignee);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case routed successfully." });
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

  const handleFinalize = async () => {
    if (!finalizeCase) return;
    setIsFinalizing(true);
    try {
      const result = await approveValuationReport(finalizeCase.id);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Valuation finalized successfully." });
        setFinalizeCase(null);
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleReturnToCRM = async () => {
    if (!returnCaseId) return;
    setIsReturning(true);
    try {
      const result = await returnToOriginatingCRM(returnCaseId, returnRemark);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case returned to Originating CRM successfully." });
        setReturnCaseId(null);
        setReturnRemark('');
        fetchData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsReturning(false);
    }
  };

  const makerManagers = staff.filter(s => s.customRole?.name?.includes('Manager') && s.customRole?.name?.includes('Maker'));
  const makerOfficers = staff.filter(s => s.customRole?.name === 'Property Valuation Officer');
  const filteredStaff = routingOption === 'OFFICER' ? makerOfficers : makerManagers;

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Valuation Department Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage incoming cases and track active assignments within the Valuation Department.</p>
      </div>

      <Tabs defaultValue="incoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="incoming">
            Incoming Queue
            {cases.length > 0 && <Badge className="ml-2 bg-amber-500">{cases.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="assigned">Active Assignments</TabsTrigger>
          <TabsTrigger value="finalization">
            Pending Finalization
            {finalizationCases.length > 0 && <Badge className="ml-2 bg-green-600">{finalizationCases.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Incoming Queue ── */}
        <TabsContent value="incoming">
          <Card>
            <CardHeader>
              <CardTitle>Incoming Cases</CardTitle>
              <CardDescription>Select a case to route to a Division Manager or directly to a Valuation Officer.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>CRM / Phone</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No incoming cases found.</TableCell>
                    </TableRow>
                  ) : (
                    cases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{c.loanRequest.customerName ?? '—'}</TableCell>
                        <TableCell><CrmCell loan={c.loanRequest} /></TableCell>
                        <TableCell>{c.loanRequest.customerBranch ?? '—'}</TableCell>
                        <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline">{valuationStageLabel(c.status)}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" onClick={() => {
                              setSelectedCase(c);
                              setRoutingOption('MANAGER');
                              setSelectedAssignee('');
                            }}>
                              Assign <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setViewCase(c)} title="Quick view">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Link href={`/loan-requests/${c.loanRequest.id}`} passHref>
                              <Button size="sm" variant="ghost" title="View full loan">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
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

        {/* ── Active Assignments ── */}
        <TabsContent value="assigned">
          <Card>
            <CardHeader>
              <CardTitle>Active Assignments</CardTitle>
              <CardDescription>Follow up on cases that have already been routed within the department.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>CRM / Phone</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Current Assigned User</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead>View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No active assignments found.</TableCell>
                    </TableRow>
                  ) : (
                    assignedCases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{c.loanRequest.customerName ?? '—'}</TableCell>
                        <TableCell><CrmCell loan={c.loanRequest} /></TableCell>
                        <TableCell>{c.loanRequest.customerBranch ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{valuationStageLabel(c.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-3 w-3 text-muted-foreground" />
                            {c.assignedTo?.name || 'Unassigned'}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(c.updatedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => setViewCase(c)} title="Quick view">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Link href={`/loan-requests/${c.loanRequest.id}`} passHref>
                              <Button size="sm" variant="ghost" title="View full loan details">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
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

        {/* ── Pending Finalization (Director sign-off for high-value cases) ── */}
        <TabsContent value="finalization">
          <Card>
            <CardHeader>
              <CardTitle>Pending Director Finalization</CardTitle>
              <CardDescription>
                High-value valuations (loan amount above 80,000,000 ETB) approved by the Checker Manager and awaiting your final sign-off.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>CRM / Phone</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Loan Amount</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalizationCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No cases awaiting finalization.</TableCell>
                    </TableRow>
                  ) : (
                    finalizationCases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{c.loanRequest.customerName ?? '—'}</TableCell>
                        <TableCell><CrmCell loan={c.loanRequest} /></TableCell>
                        <TableCell>{c.loanRequest.customerBranch ?? '—'}</TableCell>
                        <TableCell>{Number(c.loanRequest.loanAmount).toLocaleString()} ETB</TableCell>
                        <TableCell>{new Date(c.updatedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setFinalizeCase(c)}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Finalize
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setViewCase(c)} title="Quick view">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Link href={`/loan-requests/${c.loanRequest.id}`} passHref>
                              <Button size="sm" variant="ghost" title="View full loan">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
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
      </Tabs>

      {/* ── Read-only View Dialog ── */}
      {viewCase && (
        <Dialog open={!!viewCase} onOpenChange={() => setViewCase(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Case Details — {viewCase.loanRequest.loanNumber}</DialogTitle>
              <DialogDescription>Read-only overview of this valuation case.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted rounded-md">
                <div><span className="font-medium text-muted-foreground">Customer</span><p className="font-semibold mt-0.5">{viewCase.loanRequest.customerName}</p></div>
                <div><span className="font-medium text-muted-foreground">Branch</span><p className="font-semibold mt-0.5">{viewCase.loanRequest.customerBranch ?? '—'}</p></div>
                <div><span className="font-medium text-muted-foreground">CRM</span><p className="font-semibold mt-0.5">{viewCase.loanRequest.createdBy?.fullName ?? '—'}</p></div>
                <div><span className="font-medium text-muted-foreground">CRM Phone</span><p className="font-semibold mt-0.5">{viewCase.loanRequest.createdBy?.phoneNumber ?? '—'}</p></div>
                <div><span className="font-medium text-muted-foreground">Loan Amount</span><p className="font-semibold mt-0.5">{Number(viewCase.loanRequest.loanAmount).toLocaleString()} ETB</p></div>
                <div><span className="font-medium text-muted-foreground">Submitted</span><p className="font-semibold mt-0.5">{new Date(viewCase.createdAt).toLocaleDateString()}</p></div>
                <div><span className="font-medium text-muted-foreground">Current Stage</span><p className="mt-0.5"><Badge variant="outline">{valuationStageLabel(viewCase.status)}</Badge></p></div>
                <div><span className="font-medium text-muted-foreground">Assigned To</span><p className="font-semibold mt-0.5">{viewCase.assignedTo?.name ?? 'Unassigned'}</p></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewCase(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Route / Assign Dialog ── */}
      {selectedCase && (
        <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Route Valuation Case</DialogTitle>
              <DialogDescription>Assigning: {selectedCase.loanRequest.loanNumber}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-md space-y-2 text-xs">
                <h4 className="font-bold uppercase text-muted-foreground">Case Summary</h4>
                <div className="grid grid-cols-2 gap-2">
                  <p><strong>Customer:</strong> {selectedCase.loanRequest.customerName ?? '—'}</p>
                  <p><strong>Amount:</strong> {Number(selectedCase.loanRequest.loanAmount).toLocaleString()} ETB</p>
                  <p><strong>CRM:</strong> {selectedCase.loanRequest.createdBy?.fullName ?? '—'}</p>
                  <p><strong>Branch:</strong> {selectedCase.loanRequest.customerBranch ?? '—'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Routing</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={routingOption === 'MANAGER' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => { setRoutingOption('MANAGER'); setSelectedAssignee(''); }}
                  >
                    <Users className="h-4 w-4 mr-2" /> Maker Manager
                  </Button>
                  <Button
                    type="button"
                    variant={routingOption === 'OFFICER' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => { setRoutingOption('OFFICER'); setSelectedAssignee(''); }}
                  >
                    <UserCheck className="h-4 w-4 mr-2" /> Officer (direct)
                  </Button>
                </div>
                {routingOption === 'OFFICER' && (
                  <p className="flex items-start gap-1 text-xs text-muted-foreground">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    Use this only when no Maker Manager is available. The case skips the manager
                    step and starts at Valuation 01-A under the chosen officer.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {routingOption === 'OFFICER' ? 'Forward to Maker Officer' : 'Forward to Maker Manager'}
                </label>
                <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder={routingOption === 'OFFICER' ? 'Select Maker Officer' : 'Select Maker Manager'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStaff.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.valuationAssignments.length} active cases)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filteredStaff.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No {routingOption === 'OFFICER' ? 'Maker Officer' : 'Maker Manager'} is available in the Valuation Department.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedCase(null)}>Cancel</Button>
              <Button onClick={handleRoute} disabled={isRouting || !selectedAssignee}>
                {isRouting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                Route & Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Finalize Valuation Dialog (Director) ── */}
      {finalizeCase && (
        <Dialog open={!!finalizeCase} onOpenChange={(open) => { if (!open) setFinalizeCase(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finalize Valuation</DialogTitle>
              <DialogDescription>
                Case {finalizeCase.loanRequest.loanNumber} — {finalizeCase.loanRequest.customerName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted rounded-md text-sm">
                <div><span className="text-muted-foreground">Customer</span><p className="font-semibold mt-0.5">{finalizeCase.loanRequest.customerName}</p></div>
                <div><span className="text-muted-foreground">Loan Amount</span><p className="font-semibold mt-0.5">{Number(finalizeCase.loanRequest.loanAmount).toLocaleString()} ETB</p></div>
                <div><span className="text-muted-foreground">CRM</span><p className="font-semibold mt-0.5">{finalizeCase.loanRequest.createdBy?.fullName ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Branch</span><p className="font-semibold mt-0.5">{finalizeCase.loanRequest.customerBranch ?? '—'}</p></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Finalizing completes the valuation and returns the case to the originating CRM / next workflow stage. This cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFinalizeCase(null)} disabled={isFinalizing}>Cancel</Button>
              <Button onClick={handleFinalize} disabled={isFinalizing} className="bg-green-600 hover:bg-green-700">
                {isFinalizing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Finalize Valuation
              </Button>
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
              <DialogDescription>
                Provide a remark explaining why this case is being returned to the CRM.
              </DialogDescription>
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
