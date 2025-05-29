
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { LoanRequest, User as UserType } from '@/types/loan';
import { LoanStage, loanStages } from '@/types/loan';

interface PromoteLoanStageDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loan: LoanRequest | null;
  users: UserType[]; // Not used directly for assignment anymore, but kept for potential future logic
  onSubmit: (nextStage: LoanStage) => Promise<void>;
  isSaving: boolean;
  validateCurrentStageRequirements: () => boolean;
}

export function PromoteLoanStageDialog({
  isOpen,
  onOpenChange,
  loan,
  // users, // No longer used for assignee selection in this dialog
  onSubmit,
  isSaving,
  validateCurrentStageRequirements,
}: PromoteLoanStageDialogProps) {
  const [selectedNextStage, setSelectedNextStage] = useState<LoanStage | ''>('');

  const availableNextStages = (currentStage: LoanStage | undefined): LoanStage[] => {
    if (!currentStage) return [];
    const currentIndex = loanStages.indexOf(currentStage);
    if (currentIndex === -1) return [];

    const nextValidStages = loanStages.filter((stage, index) => index > currentIndex);
    
    // Ensure REJECTED and APPROVED can be jumped to if not already passed
    if (currentStage !== LoanStage.APPROVED && !nextValidStages.includes(LoanStage.APPROVED) && loanStages.indexOf(LoanStage.APPROVED) > currentIndex) {
        nextValidStages.push(LoanStage.APPROVED);
    }
    if (currentStage !== LoanStage.REJECTED && !nextValidStages.includes(LoanStage.REJECTED) && loanStages.indexOf(LoanStage.REJECTED) > currentIndex) {
         nextValidStages.push(LoanStage.REJECTED);
    }
    // Sort them according to their original order in loanStages
    return [...new Set(nextValidStages)].sort((a,b) => loanStages.indexOf(a) - loanStages.indexOf(b));
  };

  useEffect(() => {
    // Reset local state when dialog opens or loan changes
    if (isOpen && loan) {
        setSelectedNextStage('');
    }
  }, [isOpen, loan]);


  const handleConfirm = async () => {
    if (!loan || !selectedNextStage) return;
    if (!validateCurrentStageRequirements()) return;
    await onSubmit(selectedNextStage);
  };

  if (!loan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setSelectedNextStage('');
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manager: Promote Loan for {loan.customerName}</DialogTitle>
          <DialogDescription>
            Current Stage: {loan.currentStage}. Select the next stage. The loan will be unassigned.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="promote-next-stage-dialog">Next Stage</Label>
            <Select
              value={selectedNextStage}
              onValueChange={(value) => setSelectedNextStage(value as LoanStage)}
            >
              <SelectTrigger id="promote-next-stage-dialog" className="mt-1">
                <SelectValue placeholder="Select next stage" />
              </SelectTrigger>
              <SelectContent>
                {availableNextStages(loan.currentStage).map(stage => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={isSaving || !selectedNextStage}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Promotion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
