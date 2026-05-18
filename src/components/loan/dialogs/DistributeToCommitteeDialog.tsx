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
import { Loader2, Send } from 'lucide-react';
import type { LoanRequest } from '@/types/loan';

interface DistributeToCommitteeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loan: LoanRequest | null;
  onSubmit: (distributionNotes: string) => Promise<void>;
  isSaving: boolean;
}

export function DistributeToCommitteeDialog({
  isOpen,
  onOpenChange,
  loan,
  onSubmit,
  isSaving,
}: DistributeToCommitteeDialogProps) {
  const [distributionNotes, setDistributionNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDistributionNotes('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!loan) return;
    await onSubmit(distributionNotes);
  };

  if (!loan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if(!open) { setDistributionNotes(''); }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Distribute Case to Committee: {loan.customerName}</DialogTitle>
          <DialogDescription>
            You are distributing this case directly to the **Committee Approval (District Approval)** stage. Provide final comments or distribution notes below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="distribution-notes-dialog">Analyst Distribution Remarks (Required)</Label>
            <Textarea
              id="distribution-notes-dialog"
              value={distributionNotes}
              onChange={(e) => setDistributionNotes(e.target.value)}
              placeholder="e.g. Addressed manager feedback regarding collateral estimation. Ready for final committee decision..."
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
            disabled={isSaving || !distributionNotes.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Confirm & Distribute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
