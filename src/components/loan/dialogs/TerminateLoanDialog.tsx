
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldX } from 'lucide-react';
import type { LoanRequest } from '@/types/loan';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TerminateLoanDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loan: LoanRequest | null;
  onSubmit: (terminationReason: string) => Promise<void>;
  isSaving: boolean;
}

export function TerminateLoanDialog({
  isOpen,
  onOpenChange,
  loan,
  onSubmit,
  isSaving,
}: TerminateLoanDialogProps) {
  const [terminationReason, setTerminationReason] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTerminationReason('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!loan || !terminationReason.trim()) return;
    await onSubmit(terminationReason);
  };

  if (!loan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSaving) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ShieldX className="mr-2 h-5 w-5 text-destructive" />
            Terminate Loan Process
          </DialogTitle>
          <DialogDescription>
            For loan: <span className="font-semibold">{loan.loanNumber}</span> | Customer: <span className="font-semibold">{loan.customerName}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This is a permanent action. Terminating the loan process will stop all further activities and mark the loan as inactive. This action cannot be undone.
            </AlertDescription>
          </Alert>
          <div>
            <Label htmlFor="termination-reason-dialog" className="font-semibold">Reason for Termination (Required)</Label>
            <Textarea
              id="termination-reason-dialog"
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
              placeholder="e.g., Customer withdrawal, Policy violation, Duplicate application..."
              rows={4}
              className="mt-1"
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || !terminationReason.trim()}
            variant="destructive"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Termination
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
