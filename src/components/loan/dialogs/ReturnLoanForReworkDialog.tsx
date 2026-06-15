

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
  onSubmit: (reworkNote: string, assigneeIds: string[], isCommentOnly?: boolean) => Promise<void>;
  onReturnToCRM?: (reworkNote: string) => Promise<void>;
  isSaving: boolean;
  /** When true, forces comment-only mode (no rework checkbox, no assignee picker) */
  forceCommentOnly?: boolean;
}

export function ReturnLoanForReworkDialog({
  isOpen,
  onOpenChange,
  loan,
  users,
  currentDepartment,
  onSubmit,
  onReturnToCRM,
  isSaving,
  forceCommentOnly = false,
}: ReturnLoanForReworkDialogProps) {
  const [reworkNote, setReworkNote] = useState('');
  const [reworkAssigneeIds, setReworkAssigneeIds] = useState<string[]>([]);
  const [isCommentOnly, setIsCommentOnly] = useState(forceCommentOnly);

  useEffect(() => {
    if (isOpen && loan) {
      setReworkNote('');
      setIsCommentOnly(forceCommentOnly);
      
      // Attempt to find previous analysts from lafData if current assignees is empty (common in District Workflow)
      let defaultIds = loan.assignedToUsers.map(u => u.id);
      
      if (defaultIds.length === 0 && loan.lafData) {
        try {
          const laf = typeof loan.lafData === 'string' ? JSON.parse(loan.lafData) : loan.lafData;
          if (laf.previousAnalystIds && Array.isArray(laf.previousAnalystIds)) {
            defaultIds = laf.previousAnalystIds;
          }
        } catch (e) {
          // Fallback to empty if parse fails
        }
      }
      
      setReworkAssigneeIds(defaultIds);
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
    await onSubmit(reworkNote, reworkAssigneeIds, isCommentOnly);
  };

  const handleReturnToCRM = async () => {
    if (!loan || !onReturnToCRM) return;
    await onReturnToCRM(reworkNote);
  };

  if (!loan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if(!open) { setReworkNote(''); setReworkAssigneeIds([]); setIsCommentOnly(forceCommentOnly); }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {forceCommentOnly
              ? `Return to Analyst for Comment: ${loan.customerName}`
              : isCommentOnly
              ? `Return Loan for Comment Only: ${loan.customerName}`
              : `Return Loan for Rework: ${loan.customerName}`}
          </DialogTitle>
          <DialogDescription>
            {forceCommentOnly
              ? `Add your comment and return this case to the District Analyst (Stage 6). The analyst will then distribute the case to District Approval.`
              : isCommentOnly
              ? `Return this case to the analyst for comment only. Department: ${currentDepartment || 'N/A'}. The case can later be directly distributed to District Approval.`
              : `Explain why this case is being returned to staff for rework. Department: ${currentDepartment || 'N/A'}. This will reset any stage completion sign-offs.`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="rework-note-dialog">
              {forceCommentOnly ? 'Manager Comment (Required)' : 'Reason for Returning (Required)'}
            </Label>
            <Textarea
              id="rework-note-dialog"
              value={reworkNote}
              onChange={(e) => setReworkNote(e.target.value)}
              placeholder={forceCommentOnly
                ? 'e.g., Please verify the income documentation and distribute to district approval...'
                : 'e.g., Missing signature, income verification unclear...'}
              rows={4}
              className="mt-1"
              disabled={isSaving}
            />
          </div>

          {/* Head Office (TYPE1): auto-assign to last handler — no manual selection needed */}
          {!forceCommentOnly && loan.submissionType === 'TYPE1' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-blue-600 mt-0.5 flex-shrink-0">ℹ</div>
              <p className="text-xs text-blue-700 font-medium">
                The case will be automatically returned to the last person who worked on it in this department.
              </p>
            </div>
          )}

          {/* District / other workflows: show comment-only toggle and assignee picker */}
          {!forceCommentOnly && loan.submissionType !== 'TYPE1' && (
            <>
              <div className="flex items-center space-x-2 py-1 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
                <Checkbox
                  id="rework-comment-only"
                  checked={isCommentOnly}
                  onCheckedChange={(checked) => setIsCommentOnly(!!checked)}
                  disabled={isSaving}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="rework-comment-only" className="text-sm font-semibold text-amber-800 cursor-pointer">
                    Return for Comment Only (No Rework Required)
                  </Label>
                  <p className="text-xs text-amber-600 font-medium">
                    Allows analyst to directly distribute the case to district approval once commented.
                  </p>
                </div>
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
            </>
          )}

          {/* When forced comment-only: show a subtle info banner */}
          {forceCommentOnly && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-blue-600 mt-0.5 flex-shrink-0">ℹ</div>
              <p className="text-xs text-blue-700 font-medium">
                This action returns the case to the District Analyst for comment only — no full rework is required. The analyst will then distribute the case directly to District Approval.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex justify-start">
            {onReturnToCRM && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReturnToCRM}
                disabled={isSaving || !reworkNote.trim()}
                className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Return to Originating CRM
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving || !reworkNote.trim()}
              variant="default"
              className={
                forceCommentOnly
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : isCommentOnly
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
              }
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {forceCommentOnly
                ? 'Send Comment'
                : isCommentOnly
                ? 'Return for Comment'
                : 'Confirm Rework'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
