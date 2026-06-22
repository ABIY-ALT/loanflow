'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, UserCheck, Users, Info, Undo2 } from 'lucide-react';
import { getIncomingValuationCases, getValuationDeptStaff, routeValuationCase, getValuationCasesByAssigner } from '@/services/valuation-service';
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

export default function ValuationIncomingQueue() {
  const [cases, setCases] = useState<ValuationQueueItem[]>([]);
  const [assignedCases, setAssignedCases] = useState<ValuationQueueItem[]>([]);
  const [staff, setStaff] = useState<ValuationStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<ValuationQueueItem | null>(null);
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
      const [casesResult, staffResult, assignedResult] = await Promise.all([
        getIncomingValuationCases(),
        getValuationDeptStaff(),
        getValuationCasesByAssigner()
      ]);

      if ('error' in casesResult) toast({ title: "Error", description: casesResult.error, variant: "destructive" });
      else setCases(casesResult.cases || []);

      if ('error' in staffResult) toast({ title: "Error", description: staffResult.error, variant: "destructive" });
      else setStaff(staffResult.staff || []);

      if ('error' in assignedResult) toast({ title: "Error", description: assignedResult.error, variant: "destructive" });
      else setAssignedCases(assignedResult.cases || []);
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

  // The Director normally routes to a Maker Manager (start of the Maker chain), but
  // when no Maker Manager is available the case can be assigned straight to a Maker Officer.
  const makerManagers = staff.filter(s => s.customRole?.name?.includes('Manager') && s.customRole?.name?.includes('Maker'));
  const makerOfficers = staff.filter(s => s.customRole?.name === 'Property Valuation Officer');

  const filteredStaff = routingOption === 'OFFICER' ? makerOfficers : makerManagers;
  const getCustomerName = (loanRequest: LoanRequest) => loanRequest.customerName ?? 'N/A';
  const getSectorName = (loanRequest: LoanRequest) => loanRequest.sectorName ?? 'N/A';
  const getRequestTypeName = (loanRequest: LoanRequest) => loanRequest.requestTypeName ?? 'N/A';
  const formatLoanAmount = (loanRequest: LoanRequest) => Number(loanRequest.loanAmount ?? 0).toLocaleString();

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
        </TabsList>

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
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount (ETB)</TableHead>
                    <TableHead>Submitted Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No incoming cases found.</TableCell>
                    </TableRow>
                  ) : (
                    cases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{getCustomerName(c.loanRequest)}</TableCell>
                        <TableCell>{formatLoanAmount(c.loanRequest)}</TableCell>
                        <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => {
                              setSelectedCase(c);
                              setRoutingOption('MANAGER');
                              setSelectedAssignee('');
                            }}>
                              Route Case <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
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
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Current Status</TableHead>
                    <TableHead>Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No active assignments found.</TableCell>
                    </TableRow>
                  ) : (
                    assignedCases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.loanRequest.loanNumber}</TableCell>
                        <TableCell>{getCustomerName(c.loanRequest)}</TableCell>
                        <TableCell>{getSectorName(c.loanRequest)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-3 w-3 text-muted-foreground" />
                            {c.assignedTo?.name || 'Unassigned'}
                          </div>
                        </TableCell>
                        <TableCell>{c.assignedTo?.customRole?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{c.status.replace(/_/g, ' ')}</Badge>
                        </TableCell>
                        <TableCell>{new Date(c.updatedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedCase && (
        <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Route Valuation Case</DialogTitle>
              <DialogDescription>
                Assigning: {selectedCase.loanRequest.loanNumber}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Case Summary Preview */}
              <div className="p-4 bg-muted rounded-md space-y-2 text-xs">
                <h4 className="font-bold uppercase text-muted-foreground">Case Summary</h4>
                <div className="grid grid-cols-2 gap-2">
                  <p><strong>Customer:</strong> {getCustomerName(selectedCase.loanRequest)}</p>
                  <p><strong>Amount:</strong> {formatLoanAmount(selectedCase.loanRequest)} ETB</p>
                  <p><strong>Sector:</strong> {getSectorName(selectedCase.loanRequest)}</p>
                  <p><strong>Type:</strong> {getRequestTypeName(selectedCase.loanRequest)}</p>
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
