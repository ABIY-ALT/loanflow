

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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { LoanRequest, User as UserType } from '@/types/loan';
import { UNASSIGNED_DIALOG_OPTION_VALUE } from './EditLoanDetailsDialog';

interface ReturnLoanForReworkDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loan: LoanRequest | null;
  users: UserType[]; // Should be filtered by current department
  currentDepartment?: string;
  onSubmit: (reworkNote: string, assigneeIds: string[]) => Promise<void>;
  isSaving: boolean;
}

export function ReturnLoanForReworkDialog({
  isOpen,
  onOpenChange,
  loan,
  users,
  currentDepartment,
  onSubmit,
  isSaving,
}: ReturnLoanForReworkDialogProps) {
  const [reworkNote, setReworkNote] = useState('');
  const [reworkAssigneeIds, setReworkAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && loan) {
      setReworkNote('');
      // Default to current assignees or empty array
      setReworkAssigneeIds(loan.assignedToUsers.map(u => u.id));
    }
  }, [isOpen, loan]);
  
  const handleCheckboxChange = (userId: string, checked: boolean) => {
    setReworkAssigneeIds(prev => {
        if (checked) {
            return [...prev, userId];
        } else {
            return prev.filter(id => id !== userId);
        }
    });
  };

  const handleConfirm = async () => {
    if (!loan) return;
    await onSubmit(reworkNote, reworkAssigneeIds);
  };

  if (!loan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if(!open) { setReworkNote(''); setReworkAssigneeIds([]); }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return Loan for Rework: {loan.customerName}</DialogTitle>
          <DialogDescription>
            Explain why this case is being returned to staff for further work. Department: {currentDepartment || 'N/A'}. This will reset any "stage complete" sign-offs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="rework-note-dialog">Reason for Returning (Required)</Label>
            <Textarea
              id="rework-note-dialog"
              value={reworkNote}
              onChange={(e) => setReworkNote(e.target.value)}
              placeholder="e.g., Missing signature, income verification unclear..."
              rows={4}
              className="mt-1"
              disabled={isSaving}
            />
          </div>
          <div>
            <Label>Re-assign Rework To (within {currentDepartment || 'current'} Dept)</Label>
             <div className="space-y-2 p-3 border rounded-md max-h-48 overflow-y-auto mt-1">
                {users.map(user => (
                    <div key={user.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`rework-assignee-${user.id}`}
                            checked={reworkAssigneeIds.includes(user.id)}
                            onCheckedChange={(checked) => handleCheckboxChange(user.id, !!checked)}
                            disabled={isSaving}
                        />
                        <Label htmlFor={`rework-assignee-${user.id}`} className="text-sm font-normal">
                            {user.fullName} {user.customRoleName ? `(${user.customRoleName})` : ''}
                        </Label>
                    </div>
                ))}
                 {users.length === 0 && <p className="text-sm text-muted-foreground text-center">No staff found for this department.</p>}
            </div>
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
