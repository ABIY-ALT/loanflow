
'use client';

import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';

interface AddNoteToLoanDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (noteContent: string) => Promise<void>;
  isSaving: boolean;
}

export function AddNoteToLoanDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isSaving,
}: AddNoteToLoanDialogProps) {
  const [noteContent, setNoteContent] = useState('');

  const handleSubmit = async () => {
    await onSubmit(noteContent);
    if (!isSaving) { // Assuming onSubmit doesn't close dialog on its own if save is in progress
        setNoteContent(''); // Reset only if save wasn't stuck
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) setNoteContent('');
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Note to Loan History</DialogTitle>
          <DialogDescription>
            Enter any relevant notes or log activity for this loan. This will not change the current stage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="note-content-dialog">Note</Label>
          <Textarea
            id="note-content-dialog"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="e.g., Spoke with customer, clarified income details. Follow up next week."
            rows={4}
            disabled={isSaving}
          />
        </div>
        <DialogFooter>
           <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
            </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isSaving || !noteContent.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
