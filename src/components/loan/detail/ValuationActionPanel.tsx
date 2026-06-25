'use client';

import React, { useMemo, useState } from 'react';
import type { LoanRequest, User as UserType } from '@/types/loan';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, RotateCcw, ClipboardCheck, Gavel } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PERMISSIONS } from '@/lib/permissions';
import { valuationStageLabel } from '@/lib/valuation-stage-labels';
import {
  approveValuationReport,
  reworkToMakerOfficer,
} from '@/services/valuation-service';
import { completeValuationWork } from '@/services/loan-service-prisma';

interface ValuationActionPanelProps {
  loan: LoanRequest;
  currentUser: UserType;
  onActionComplete: () => void;
}

const VALUATION_DEPT_NAME = 'Property Valuation Department';

const isMakerManager = (roleName?: string) =>
  !!roleName?.includes('Manager') && !!roleName?.includes('Maker');
const isCheckerManager = (roleName?: string) =>
  !!roleName?.includes('Manager') && !!roleName?.includes('Checker');

/**
 * Valuation action panel rendered inside the loan detail page for cases in the
 * unified WF-02 valuation flow. Surfaces the stage-/role-appropriate actions so
 * officers and managers act from the full loan view instead of a queue table:
 *   - Complete valuation step      (assigned Maker/Checker Officer)
 *   - Approve → Final Valuation Review (Checker Manager, PENDING_CHECKER_REVIEW)
 *   - Finalize Valuation           (Maker Manager, PENDING_FINALIZATION)
 *   - Rework to Maker Officer       (Checker Manager, Checker Officer, or Final Review)
 *   - Rework to Previous CRM/User   (return to originating CRM)
 * "Rework to Previous Stage" stays on the existing header "Return for Rework" button.
 */
export function ValuationActionPanel({ loan, currentUser, onActionComplete }: ValuationActionPanelProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [reworkDialogOpen, setReworkDialogOpen] = useState(false);
  const [reworkReason, setReworkReason] = useState('');

  const queue = loan.valuationQueue;
  const status = queue?.status;

  const isAdmin = currentUser.permissions.includes(PERMISSIONS.MANAGE_USERS);
  const isInValuationDept =
    (typeof currentUser.department === 'string'
      ? currentUser.department
      : (currentUser.department as { name?: string } | undefined)?.name) === VALUATION_DEPT_NAME;
  const makerMgr = isMakerManager(currentUser.customRoleName);
  const checkerMgr = isCheckerManager(currentUser.customRoleName);
  const isAssignedOfficer = !!queue?.assignedToId && queue.assignedToId === currentUser.id;

  // Which actions are available for this user at the current queue status.
  const actions = useMemo(() => {
    if (!queue || !status) return { complete: false, approve: false, finalize: false, reworkOfficer: false };

    const complete =
      (status === 'ASSIGNED_TO_OFFICER' || status === 'ASSIGNED_TO_CHECKER_OFFICER') &&
      (isAssignedOfficer || isAdmin);

    const approve = status === 'PENDING_CHECKER_REVIEW' && (checkerMgr || isAdmin);
    const finalize = status === 'PENDING_FINALIZATION' && (makerMgr || isAdmin);

    // Rework directly to the Maker Officer (Valuation Maker 01-A). Available to the
    // Checker Manager the moment they receive the case, to the assigned Checker
    // Officer, and again at the Checker Manager Final Review.
    const reworkOfficer =
      !!queue.makerOfficerId &&
      ((status === 'ASSIGNED_TO_CHECKER_MANAGER' && (checkerMgr || isAdmin)) ||
        (status === 'ASSIGNED_TO_CHECKER_OFFICER' && (isAssignedOfficer || isAdmin)) ||
        (status === 'PENDING_CHECKER_REVIEW' && (checkerMgr || isAdmin)));

    return { complete, approve, finalize, reworkOfficer };
  }, [queue, status, isAssignedOfficer, isAdmin, checkerMgr, makerMgr]);

  // Hide the panel entirely when there is nothing for this user to do.
  const hasAnyAction =
    actions.complete || actions.approve || actions.finalize || actions.reworkOfficer;

  if (!queue || !status || loan.isValuationCompleted || status === 'COMPLETED') return null;
  if (!isInValuationDept && !isAdmin) return null;
  if (!hasAnyAction) return null;

  const run = async (key: string, fn: () => Promise<{ error?: string } | { success?: boolean }>, successMsg: string) => {
    setPending(key);
    try {
      const result = await fn();
      if (result && 'error' in result && result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: successMsg });
        onActionComplete();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setPending(null);
    }
  };

  const handleComplete = () => {
    if (!confirm('Complete your valuation step and forward the case to the next stage?')) return;
    run('complete', () => completeValuationWork(loan.id), 'Valuation step completed and forwarded.');
  };

  const handleApprove = () =>
    run('approve', () => approveValuationReport(queue.id), 'Verification approved. Sent to Final Valuation Review.');

  const handleFinalize = () => {
    if (!confirm('Finalize this valuation? The case will be returned to the originating workflow.')) return;
    run('finalize', () => approveValuationReport(queue.id), 'Valuation finalized.');
  };

  const handleReworkOfficer = () => {
    run('reworkOfficer', () => reworkToMakerOfficer(queue.id, reworkReason), 'Case reworked to the Valuation Officer (Maker 01-A).');
    setReworkDialogOpen(false);
    setReworkReason('');
  };

  return (
    <Card className="border-purple-200 bg-purple-50/40">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <ClipboardCheck className="h-5 w-5" />
              Valuation Actions
            </CardTitle>
            <CardDescription>Actions available to you at the current valuation stage.</CardDescription>
          </div>
          <Badge variant="outline" className="text-purple-700 border-purple-300">
            {valuationStageLabel(status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 flex-wrap">
          {actions.complete && (
            <Button
              onClick={handleComplete}
              disabled={!!pending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {pending === 'complete'
                ? <Loader2 className="animate-spin h-4 w-4 mr-2" />
                : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {status === 'ASSIGNED_TO_CHECKER_OFFICER' ? 'Complete Verification Step' : 'Complete Valuation Step'}
            </Button>
          )}

          {actions.approve && (
            <Button
              onClick={handleApprove}
              disabled={!!pending}
              className="bg-green-600 hover:bg-green-700"
            >
              {pending === 'approve'
                ? <Loader2 className="animate-spin h-4 w-4 mr-2" />
                : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Approve → Final Valuation Review
            </Button>
          )}

          {actions.finalize && (
            <Button
              onClick={handleFinalize}
              disabled={!!pending}
              className="bg-green-600 hover:bg-green-700"
            >
              {pending === 'finalize'
                ? <Loader2 className="animate-spin h-4 w-4 mr-2" />
                : <Gavel className="h-4 w-4 mr-2" />}
              Finalize Valuation
            </Button>
          )}

          {actions.reworkOfficer && (
            <Button
              onClick={() => setReworkDialogOpen(true)}
              disabled={!!pending}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {pending === 'reworkOfficer'
                ? <Loader2 className="animate-spin h-4 w-4 mr-2" />
                : <RotateCcw className="h-4 w-4 mr-2" />}
              Rework to Valuation Officer (Maker 01-A)
            </Button>
          )}
        </div>
      </CardContent>

      {/* ── Rework to Maker Officer Dialog (reason required) ── */}
      <Dialog open={reworkDialogOpen} onOpenChange={(open) => {
        if (!open) { setReworkDialogOpen(false); setReworkReason(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rework to Valuation Officer (Maker 01-A)</DialogTitle>
            <DialogDescription>
              The case is sent directly back to the Valuation Officer (Maker 01-A)
              {queue.makerOfficerName ? ` — ${queue.makerOfficerName}` : ''} for corrections.
              State why it is being reworked.
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
            <Button
              variant="outline"
              onClick={() => { setReworkDialogOpen(false); setReworkReason(''); }}
              disabled={pending === 'reworkOfficer'}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReworkOfficer}
              disabled={pending === 'reworkOfficer' || !reworkReason.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {pending === 'reworkOfficer' ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Rework to Valuation Officer (Maker 01-A)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
