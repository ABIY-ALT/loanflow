
'use client';

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';

interface UploadLoanDocumentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  documentName: string | null;
  onSubmit: (docName: string) => Promise<void>;
  isSaving: boolean;
}

export function UploadLoanDocumentDialog({
  isOpen,
  onOpenChange,
  documentName,
  onSubmit,
  isSaving,
}: UploadLoanDocumentDialogProps) {

  const handleSubmit = async () => {
    if (documentName) {
      await onSubmit(documentName);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document: {documentName || "General Upload"}</DialogTitle>
          <DialogDescription>
              {documentName ? `Upload the file for "${documentName}".` : "Select a file to upload."} (Mock: Actual file upload not implemented)
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <Label htmlFor="doc-upload-dialog">Select file</Label>
            <Input id="doc-upload-dialog" type="file" className="mt-1" disabled={isSaving}/>
            <p className="text-xs text-muted-foreground mt-2">Actual file handling & upload to storage not implemented. This simulates document status change.</p>
        </div>
        <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSaving} >Cancel</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={isSaving || !documentName}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Simulate Upload
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

