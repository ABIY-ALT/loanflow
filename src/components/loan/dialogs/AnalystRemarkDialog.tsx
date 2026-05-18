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
import { Loader2, Info, FileText, BadgeDollarSign } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface AnalystRemarkDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (noteContent: string, promote: boolean) => Promise<void>;
  isSaving: boolean;
  loanAmount: number;
  currentStage: string;
  loanNumber: string;
  managerComments?: string;
}

export function AnalystRemarkDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isSaving,
  loanAmount,
  currentStage,
  loanNumber,
  managerComments,
}: AnalystRemarkDialogProps) {
  const [noteContent, setNoteContent] = useState('');

  const handleSubmit = async (promote: boolean = false) => {
    await onSubmit(noteContent, promote);
    onOpenChange(false);
    setNoteContent('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) setNoteContent('');
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700">
            <FileText className="h-5 w-5" />
            Analyst Review & Remark
          </DialogTitle>
          <DialogDescription>
            Provide your final findings and remarks. You can also promote this case to the Final Manager Review stage.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 gap-4 my-1 text-sm">
          <div className="space-y-1">
            <Label className="text-muted-foreground flex items-center gap-1.5"><Info className="h-3.5 w-3.5"/> Case ID</Label>
            <p className="font-bold">{loanNumber}</p>
          </div>
          <div className="space-y-1 text-right">
            <Label className="text-muted-foreground flex items-center gap-1.5 justify-end"><BadgeDollarSign className="h-3.5 w-3.5"/> Loan Amount</Label>
            <p className="font-bold text-indigo-600 text-lg">ETB {loanAmount.toLocaleString()}</p>
          </div>
          <div className="col-span-2">
            <Separator className="my-1" />
            <div className="flex justify-between items-center">
                <Label className="text-muted-foreground">Current Stage</Label>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">{currentStage}</Badge>
            </div>
          </div>
          
          {managerComments && (
            <div className="col-span-2 bg-amber-50 p-3 rounded border border-amber-200 mt-1">
              <Label className="text-amber-800 font-bold flex items-center gap-1.5 mb-1">
                <Info className="h-3.5 w-3.5"/> Manager's Previous Comments
              </Label>
              <p className="text-amber-900 italic text-xs">{managerComments}</p>
            </div>
          )}
        </div>

        <div className="grid gap-3 py-2">
          <Label htmlFor="analyst-remark" className="font-bold text-indigo-900">Your Remarks / Comments</Label>
          <Textarea
            id="analyst-remark"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Enter detailed analysis findings, risk factors, or general remarks here..."
            className="min-h-[150px] focus-visible:ring-indigo-500"
            disabled={isSaving}
          />
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full justify-between">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>Discard</Button>
            </DialogClose>
            
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => handleSubmit(false)} 
                disabled={isSaving || !noteContent.trim()}
                className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Remark Only
              </Button>
              
              <Button 
                type="button" 
                onClick={() => handleSubmit(true)} 
                disabled={isSaving || !noteContent.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save & Send to Manager
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
