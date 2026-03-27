
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
import { Loader2, MessageSquareReply } from 'lucide-react';
import type { LoanHistoryEntry } from '@/types/loan';

interface RespondToInfoRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  entry: LoanHistoryEntry | null;
  onSubmit: (entryId: string, response: string, markFulfilled: boolean) => Promise<void>;
  isSaving: boolean;
}

export function RespondToInfoRequestDialog({
  isOpen,
  onOpenChange,
  entry,
  onSubmit,
  isSaving,
}: RespondToInfoRequestDialogProps) {
  const [response, setResponse] = useState('');
  const [markFulfilled, setMarkFulfilled] = useState(true);

  useEffect(() => {
    if (isOpen && entry) {
      setResponse(entry.fulfillmentNotes || '');
      setMarkFulfilled(entry.isFulfilled ?? true);
    }
  }, [isOpen, entry]);

  const handleSubmit = async () => {
    if (!entry) return;
    await onSubmit(entry.id, response, markFulfilled);
  };

  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareReply className="h-5 w-5 text-primary" />
            Respond to Information Request
          </DialogTitle>
          <DialogDescription>
            Provide requested details for: <span className="font-semibold text-foreground">"{entry.requiredFulfilment}"</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="info-response-text">Your Response (Optional if just confirming)</Label>
            <Textarea
              id="info-response-text"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Enter details, file names, or confirmation text..."
              rows={4}
              disabled={isSaving}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mark-fulfilled-check"
              checked={markFulfilled}
              onCheckedChange={(checked) => setMarkFulfilled(!!checked)}
              disabled={isSaving}
            />
            <Label
              htmlFor="mark-fulfilled-check"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Mark request as fully fulfilled / received
            </Label>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
