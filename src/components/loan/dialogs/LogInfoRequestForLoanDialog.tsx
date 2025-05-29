
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

interface LogInfoRequestForLoanDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (infoToRequest: string) => Promise<void>;
  isSaving: boolean;
}

export function LogInfoRequestForLoanDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isSaving,
}: LogInfoRequestForLoanDialogProps) {
  const [infoToRequest, setInfoToRequest] = useState('');

  const handleSubmit = async () => {
    await onSubmit(infoToRequest);
     if (!isSaving) {
        setInfoToRequest('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if(!open) setInfoToRequest('');
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Information Request</DialogTitle>
          <DialogDescription>
            Specify what information needs to be requested from the customer. This will add a note to the loan&apos;s history to track this request. It will NOT change the loan&apos;s current stage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="additional-info-dialog">Information to Request</Label>
          <Textarea
            id="additional-info-dialog"
            value={infoToRequest}
            onChange={(e) => setInfoToRequest(e.target.value)}
            placeholder="e.g., Latest utility bill, Clarification on income source"
            disabled={isSaving}
            rows={3}
          />
        </div>
        <DialogFooter>
           <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
            </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isSaving || !infoToRequest.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Log Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
