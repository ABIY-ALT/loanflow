'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { 
  Clock, 
  User, 
  Building, 
  Flame, 
  AlertCircle, 
  History,
  Info
} from 'lucide-react';
import type { LoanRequest } from '@/types/loan';

interface QuickFollowUpDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanRequest | null;
}

export function QuickFollowUpDialog({ isOpen, onOpenChange, loan }: QuickFollowUpDialogProps) {
  if (!loan) return null;

  const sortedHistory = [...loan.history].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                Workflow Status Tracker
              </DialogTitle>
              <DialogDescription>
                Real-time tracking for <span className="font-semibold text-foreground">{loan.loanNumber}</span> ({loan.customerName})
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {loan.isUrgent && (
                <Badge variant="destructive" className="animate-pulse bg-red-600">
                  <Flame className="mr-1 h-3 w-3" /> URGENT
                </Badge>
              )}
              {loan.isOverdue && (
                <Badge variant="destructive">
                  <AlertCircle className="mr-1 h-3 w-3" /> OVERDUE
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-grow overflow-hidden py-4 space-y-6">
          {/* Current Status Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-primary/10">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Current Stage</p>
                <p className="font-bold text-primary">{loan.currentStageName || 'Review'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Owning Department</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  {loan.assignedDepartment}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Assigned Staff</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {loan.assignedToUsers.length > 0 ? (
                    loan.assignedToUsers.map(u => (
                      <Badge key={u.id} variant="secondary" className="text-[10px] font-bold">
                        <User className="mr-1 h-3 w-3" /> {u.fullName}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs italic text-muted-foreground">Unassigned</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Stage Entry Date</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {loan.stageEntryDate ? format(parseISO(loan.stageEntryDate), 'MMM dd, yyyy HH:mm') : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Workflow Timeline */}
          <div className="space-y-4">
            <h4 className="text-sm font-black flex items-center gap-2 px-1">
              <History className="h-4 w-4 text-primary" />
              RECENT ACTIVITY NOTES
            </h4>
            <ScrollArea className="h-[250px] border rounded-md p-4 bg-background">
              <div className="space-y-6">
                {sortedHistory.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">No history available for this request.</p>
                ) : (
                  sortedHistory.map((entry) => (
                    <div key={entry.id} className="relative pl-6 border-l-2 border-muted last:border-0 pb-6">
                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-primary uppercase tracking-tighter bg-primary/5 px-1.5 rounded border border-primary/10">
                            {entry.stageName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {format(parseISO(entry.timestamp), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                        <p className="text-xs text-foreground font-medium leading-relaxed">
                          {entry.notes}
                        </p>
                        <p className="text-[10px] text-muted-foreground italic">
                          Action by: {entry.userName} ({entry.userRole || 'Staff'})
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <DialogClose asChild>
            <Button variant="outline" className="w-full sm:w-auto">Close View</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
