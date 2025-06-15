
'use client';

import { useState, type FormEvent } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { uploadDocumentAction } from '@/app/loan-requests/[id]/actions'; // Assuming loanId is available or passed

interface UploadLoanDocumentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loanId: string; // Need loanId for the upload action path
  conceptualDocumentName: string | null; // e.g., "Passport", "ID Card"
  // This onSubmit is called by the PARENT page after this dialog successfully uploads the file via server action
  onSubmitAfterUpload: (conceptualDocName: string, uploadedFilePath: string, originalFileName: string) => Promise<void>;
  isParentSaving: boolean; // To disable if the parent page is saving the overall loan
}

export function UploadLoanDocumentDialog({
  isOpen,
  onOpenChange,
  loanId,
  conceptualDocumentName,
  onSubmitAfterUpload,
  isParentSaving,
}: UploadLoanDocumentDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !conceptualDocumentName) {
      toast({ title: "No File", description: "Please select a file to upload.", variant: "destructive" });
      return;
    }
    if (!loanId) {
        toast({ title: "Error", description: "Loan ID is missing for upload.", variant: "destructive" });
        return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const result = await uploadDocumentAction(loanId, conceptualDocumentName, formData);

      if (result.success && result.filePath && result.originalFileName) {
        toast({ title: "File Uploaded to Server", description: `${result.originalFileName} saved. Now updating loan record.` });
        // Now call the parent's onSubmit to update the database record
        await onSubmitAfterUpload(conceptualDocumentName, result.filePath, result.originalFileName);
        onOpenChange(false); // Close dialog on successful DB update (handled by parent)
        setSelectedFile(null); // Reset file input
      } else {
        toast({ title: "Upload Failed", description: result.error || "Could not upload file to server.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Upload Error", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!isUploading && !isParentSaving) onOpenChange(open); }}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Upload Document: {conceptualDocumentName || "General Upload"}</DialogTitle>
            <DialogDescription>
              {conceptualDocumentName ? `Select the file for "${conceptualDocumentName}".` : "Select a file to upload."}
              The file will be saved to the server.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="doc-upload-dialog-file-input">Select file</Label>
            <Input
              id="doc-upload-dialog-file-input"
              type="file"
              className="mt-1"
              onChange={handleFileChange}
              disabled={isUploading || isParentSaving}
              required
            />
            {selectedFile && <p className="text-xs text-muted-foreground mt-1">Selected: {selectedFile.name}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isUploading || isParentSaving}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isUploading || isParentSaving || !selectedFile || !conceptualDocumentName}>
              {(isUploading || isParentSaving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload & Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
