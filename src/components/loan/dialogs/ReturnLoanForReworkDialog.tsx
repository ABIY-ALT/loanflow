
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { LoanRequest, User as UserType } from '@/types/loan';
import { UNASSIGNED_DIALOG_OPTION_VALUE } from './EditLoanDetailsDialog'; // Assuming this constant is centralized or redefined

interface ReturnLoanForReworkDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loan: LoanRequest | null;
  users: UserType[];
  onSubmit: (reworkNote: string, assigneeId?: string) => Promise<void>;
  isSaving: boolean;
}

export function ReturnLoanForReworkDialog({
  isOpen,
  onOpenChange,
  loan,
  users,
  onSubmit,
  isSaving,
}: ReturnLoanForReworkDialogProps) {
  const [reworkNote, setReworkNote] = useState('');
  const [reworkAssigneeId, setReworkAssigneeId] = useState<string>('');

  useEffect(() => {
    if (isOpen && loan) {
      setReworkNote('');
      setReworkAssigneeId(loan.assignedTo || UNASSIGNED_DIALOG_OPTION_VALUE);
    }
  }, [isOpen, loan]);

  const handleConfirm = async () => {
    if (!loan) return;
    const finalAssigneeId = reworkAssigneeId === UNASSIGNED_DIALOG_OPTION_VALUE ? undefined : reworkAssigneeId;
    await onSubmit(reworkNote, finalAssigneeId);
  };

  if (!loan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if(!open) setReworkNote('');
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return Loan for Rework: {loan.customerName}</DialogTitle>
          <DialogDescription>
            Explain why this case is being returned to the officer for further work in the current stage: {loan.currentStage}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="rework-note-dialog">Reason for Returning (Required)</Label>
            <Textarea
              id="rework-note-dialog"
              value={reworkNote}
              onChange={(e) => setReworkNote(e.target.value)}
              placeholder="e.g., Missing signature on page 3, income verification unclear..."
              rows={4}
              className="mt-1"
              disabled={isSaving}
            />
          </div>
          <div>
            <Label htmlFor="rework-assignee-dialog">Assign Rework To</Label>
            <Select
              value={reworkAssigneeId}
              onValueChange={setReworkAssigneeId}
              disabled={isSaving}
            >
              <SelectTrigger id="rework-assignee-dialog" className="mt-1">
                <SelectValue placeholder="Select assignee for rework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_DIALOG_OPTION_VALUE}>Unassigned</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || !reworkNote.trim()}
            variant="destructive"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & Return for Rework
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
