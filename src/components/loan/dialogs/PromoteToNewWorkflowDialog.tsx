
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, ArrowRight } from 'lucide-react';
import type { LoanRequest, WorkflowDefinition } from '@/types/loan';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PromoteToNewWorkflowDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentLoan: LoanRequest | null;
  workflowDefinitions: WorkflowDefinition[];
  onSubmit: (newWorkflowVersionId: string) => Promise<void>;
  isSaving: boolean;
}

export function PromoteToNewWorkflowDialog({
  isOpen,
  onOpenChange,
  currentLoan,
  workflowDefinitions,
  onSubmit,
  isSaving,
}: PromoteToNewWorkflowDialogProps) {
  const [selectedWorkflowVersionId, setSelectedWorkflowVersionId] = useState<string>('');

  const availableWorkflows = useMemo(() => {
    if (!currentLoan) return [];
    // Get all active versions from all definitions, excluding the current one
    return workflowDefinitions.flatMap(def =>
      def.versions
        .filter(v => v.isActive && v.id !== currentLoan.workflowVersionId)
        .map(v => ({
          definitionName: def.name,
          versionId: v.id,
          versionNumber: v.versionNumber,
          loanType: def.loanTypeName,
          department: def.departmentName,
        }))
    );
  }, [workflowDefinitions, currentLoan]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedWorkflowVersionId('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!selectedWorkflowVersionId) return;
    await onSubmit(selectedWorkflowVersionId);
  };

  if (!currentLoan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to New Workflow</DialogTitle>
          <DialogDescription>
            The current workflow for '{currentLoan.loanType}' is complete. Select a new workflow to transition this loan request to.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Label htmlFor="new-workflow-select">Select Next Workflow</Label>
          <Select
            value={selectedWorkflowVersionId}
            onValueChange={setSelectedWorkflowVersionId}
            disabled={isSaving}
          >
            <SelectTrigger id="new-workflow-select">
              <SelectValue placeholder="Choose a workflow..." />
            </SelectTrigger>
            <SelectContent>
              {availableWorkflows.length === 0 && (
                <SelectItem value="no-workflows" disabled>
                  No other active workflows available.
                </SelectItem>
              )}
              {availableWorkflows.map(wf => (
                <SelectItem key={wf.versionId} value={wf.versionId}>
                  {wf.definitionName} (v{wf.versionNumber}) - {wf.loanType} / {wf.department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableWorkflows.length === 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                No other active workflow versions are available to transition to. Please activate another workflow in the settings.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || !selectedWorkflowVersionId}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ArrowRight className="mr-2 h-4 w-4" />
            Promote to Selected Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
