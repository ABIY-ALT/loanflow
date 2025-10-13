
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
import { Loader2, Shuffle } from 'lucide-react';
import type { LoanRequest, WorkflowDefinition } from '@/types/loan';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';

interface ManualTransitionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentLoan: LoanRequest | null;
  workflowDefinitions: WorkflowDefinition[];
  onSubmit: (newWorkflowVersionId: string, newStageId: string, reason: string) => Promise<void>;
  isSaving: boolean;
}

export function ManualTransitionDialog({
  isOpen,
  onOpenChange,
  currentLoan,
  workflowDefinitions,
  onSubmit,
  isSaving,
}: ManualTransitionDialogProps) {
  const [selectedWorkflowVersionId, setSelectedWorkflowVersionId] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [reason, setReason] = useState('');

  const allActiveVersions = useMemo(() => {
    return workflowDefinitions.flatMap(def =>
      def.versions
        .filter(v => v.isActive)
        .map(v => ({
          definitionName: def.name,
          versionId: v.id,
          versionNumber: v.versionNumber,
          loanType: def.loanTypeName,
          department: def.departmentName,
          stages: v.stages,
        }))
    );
  }, [workflowDefinitions]);

  const selectedVersionStages = useMemo(() => {
    if (!selectedWorkflowVersionId) return [];
    const version = allActiveVersions.find(v => v.versionId === selectedWorkflowVersionId);
    return version?.stages || [];
  }, [selectedWorkflowVersionId, allActiveVersions]);

  useEffect(() => {
    if (isOpen && currentLoan) {
      // Pre-select the current workflow/stage if possible
      setSelectedWorkflowVersionId(currentLoan.workflowVersionId || '');
      setSelectedStageId(currentLoan.currentStageId || '');
    } else if (!isOpen) {
      // Reset on close
      setSelectedWorkflowVersionId('');
      setSelectedStageId('');
      setReason('');
    }
  }, [isOpen, currentLoan]);

  useEffect(() => {
    // When workflow version changes, reset selected stage if it's not in the new list
    if (!selectedVersionStages.some(s => s.id === selectedStageId)) {
      setSelectedStageId('');
    }
  }, [selectedWorkflowVersionId, selectedVersionStages, selectedStageId]);


  const handleConfirm = async () => {
    if (!selectedWorkflowVersionId || !selectedStageId || !reason.trim()) return;
    await onSubmit(selectedWorkflowVersionId, selectedStageId, reason);
  };

  if (!currentLoan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Shuffle className="mr-2 h-5 w-5" />
            Manual Stage Transition
          </DialogTitle>
          <DialogDescription>
            Force transition for loan <span className="font-semibold">{currentLoan.loanNumber}</span> to any active stage. This action is for authorized users only and will be logged.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <Alert variant="destructive">
            <AlertDescription>
              Warning: This overrides the standard workflow. Ensure you have proper authorization and reason for this action.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <Label htmlFor="manual-workflow-select">Target Workflow</Label>
                <Select
                  value={selectedWorkflowVersionId}
                  onValueChange={setSelectedWorkflowVersionId}
                  disabled={isSaving}
                >
                  <SelectTrigger id="manual-workflow-select" className="mt-1">
                    <SelectValue placeholder="Choose a workflow..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allActiveVersions.length === 0 && <SelectItem value="no-workflows" disabled>No active workflows found</SelectItem>}
                    {allActiveVersions.map(wf => (
                      <SelectItem key={wf.versionId} value={wf.versionId}>
                        {wf.definitionName} (v{wf.versionNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="manual-stage-select">Target Stage</Label>
                <Select
                  value={selectedStageId}
                  onValueChange={setSelectedStageId}
                  disabled={isSaving || !selectedWorkflowVersionId}
                >
                  <SelectTrigger id="manual-stage-select" className="mt-1">
                    <SelectValue placeholder={selectedWorkflowVersionId ? "Choose a stage..." : "Select workflow first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedVersionStages.length === 0 && <SelectItem value="no-stages" disabled>No stages in this workflow</SelectItem>}
                    {selectedVersionStages.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.order + 1}. {stage.name} ({stage.responsibleDepartment})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="manual-transition-reason">Reason for Manual Transition (Required)</Label>
            <Textarea
              id="manual-transition-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Correcting previous error, skipping stage due to executive decision."
              rows={3}
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
            disabled={isSaving || !selectedStageId || !reason.trim()}
            variant="destructive"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Manual Transition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
