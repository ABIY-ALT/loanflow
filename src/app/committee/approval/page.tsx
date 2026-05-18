'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { getCommitteeQueue, submitCommitteeDecision } from '@/services/committee-service';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
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

const COMMITTEE_LIMIT = 20000000;

export default function CommitteeApproval() {
  const [cases, setCases] = useState<any[]>([]);
  const [committeeSettings, setCommitteeSettings] = useState({ size: 4, threshold: 3 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const canViewPage = currentUser?.permissions.includes(PERMISSIONS.APPROVE_COMMITTEE_CASES);

  const userVote = selectedCase?.committeeDecisions?.find((d: any) => d.member?.id === currentUser?.id);
  const userAlreadyVoted = !!userVote;

  useEffect(() => {
    if (selectedCase) {
      setComment(userVote?.comment || '');
    } else {
      setComment('');
    }
  }, [selectedCase?.id, userVote?.comment]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getCommitteeQueue();
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        setCases(result.cases || []);
        if (result.settings) setCommitteeSettings(result.settings);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canViewPage) {
      fetchData();
    }
  }, [canViewPage]);

  const handleDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selectedCase) return;
    const userAlreadyVoted = selectedCase.committeeDecisions?.some((d: any) => d.member?.id === currentUser?.id);
    if (userAlreadyVoted) return;

    setIsSubmitting(true);
    try {
      const result = await submitCommitteeDecision(selectedCase.id, decision, comment);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: `Decision (${decision}) recorded.` });
        setSelectedCase(null);
        setComment('');
        fetchData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (!canViewPage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-8">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to access the committee approval queue.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">District Committee Approval</h1>
        <p className="text-muted-foreground mt-2">Review and vote on loan applications (Type 2).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Committee Review Queue</CardTitle>
          <CardDescription>Approval authority is capped at 20 million ETB.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount (ETB)</TableHead>
                <TableHead>Decisions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No cases awaiting committee review.</TableCell>
                </TableRow>
              ) : (
                cases.map((c) => {
                  const isOverLimit = Number(c.loanAmount) > COMMITTEE_LIMIT;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.loanNumber}</TableCell>
                      <TableCell>{c.customerName}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{Number(c.loanAmount).toLocaleString()}</span>
                          {isOverLimit && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Over Limit</Badge>}
                        </div>
                      </TableCell>
                       <TableCell>
                        <div className="flex -space-x-2">
                           {c.committeeDecisions.map((d: any) => (
                             <Badge key={d.id} variant={d.decision === 'APPROVE' ? 'secondary' : 'destructive'} className="rounded-full w-6 h-6 p-0 flex items-center justify-center border-2 border-background" title={`${d.member.name}: ${d.decision}`}>
                                {d.decision === 'APPROVE' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                             </Badge>
                           ))}
                           {c.committeeDecisions.length < committeeSettings.size && (
                             <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground">
                               +{committeeSettings.size - c.committeeDecisions.length}
                             </div>
                           )}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{c.currentStageStatus}</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => setSelectedCase(c)}>
                          Review & Vote <Eye className="ml-2 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedCase && (
        <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Committee Review</DialogTitle>
              <DialogDescription>
                Loan: {selectedCase.loanNumber} | Applicant: {selectedCase.customerName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
               {Number(selectedCase.loanAmount) > COMMITTEE_LIMIT && (
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Over Authority Limit</AlertTitle>
                    <p className="text-sm">This loan amount exceeds the 20 million ETB limit for this committee. You cannot approve this case.</p>
                 </Alert>
               )}

               <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-md">
                  <div>
                    <p className="text-muted-foreground">Requested Amount</p>
                    <p className="font-bold text-lg">{Number(selectedCase.loanAmount).toLocaleString()} ETB</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Purpose</p>
                    <p className="font-medium">{selectedCase.loanPurpose}</p>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {userAlreadyVoted ? 'Your Submitted Comment' : 'Committee Member Comments'}
                  </label>
                  <Textarea
                    placeholder={userAlreadyVoted ? 'Your submitted comment appears here.' : 'Add your notes or justification for the decision...'}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    disabled={userAlreadyVoted}
                  />
                  {userAlreadyVoted && (
                    <p className="text-sm text-muted-foreground">
                      This is the comment you previously submitted with your vote.
                    </p>
                  )}
               </div>

               {userAlreadyVoted && (
                 <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                   You have already submitted your vote for this case. Committee decisions cannot be changed once recorded.
                 </div>
               )}

               <div className="space-y-2">
                  <h4 className="text-sm font-medium">Previous Decisions</h4>
                  <div className="space-y-2">
                    {selectedCase.committeeDecisions.map((d: any) => (
                      <div key={d.id} className="flex justify-between items-center text-xs border-b pb-1">
                        <span>{d.member.name}</span>
                        <Badge variant={d.decision === 'APPROVE' ? 'secondary' : 'destructive'}>{d.decision}</Badge>
                      </div>
                    ))}
                    {selectedCase.committeeDecisions.length === 0 && <p className="text-xs text-muted-foreground">No votes recorded yet.</p>}
                  </div>
               </div>
            </div>
            <DialogFooter className="flex justify-between sm:justify-between">
              <Button variant="outline" onClick={() => setSelectedCase(null)}>Close</Button>
              <div className="flex space-x-2">
                <Button
                  variant="destructive"
                  onClick={() => handleDecision('REJECT')}
                  disabled={isSubmitting || selectedCase.committeeDecisions?.some((d: any) => d.member?.id === currentUser?.id)}
                >
                  Reject Case
                </Button>
                <Button
                  onClick={() => handleDecision('APPROVE')}
                  disabled={isSubmitting || Number(selectedCase.loanAmount) > COMMITTEE_LIMIT || selectedCase.committeeDecisions?.some((d: any) => d.member?.id === currentUser?.id)}
                >
                  Approve Case
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Alert({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'destructive' }) {
    return (
        <div className={`p-4 rounded-md border ${variant === 'destructive' ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-muted border-muted-foreground/20'}`}>
            <div className="flex items-start space-x-3">
                {children}
            </div>
        </div>
    );
}

function AlertTitle({ children }: { children: React.ReactNode }) {
    return <h5 className="font-bold mb-1">{children}</h5>;
}
