
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription as FormDesc,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Info, Phone, DollarSign, Type, Landmark } from 'lucide-react';
import type { LoanRequest, User as UserType } from '@/types/loan';
import { useEffect } from 'react';

export const UNASSIGNED_DIALOG_OPTION_VALUE = "---UNASSIGNED-DIALOG---";

const editLoanFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  loanAmount: z.coerce.number().positive({ message: 'Loan amount must be a positive number.' }),
  loanType: z.string().min(2, { message: 'Loan type is required.' }),
  loanPurpose: z.string().min(10, { message: 'Loan purpose must be at least 10 characters.' }),
  assignedTo: z.string().optional(),
});

type EditLoanFormValues = z.infer<typeof editLoanFormSchema>;

interface EditLoanDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loan: LoanRequest | null;
  users: UserType[];
  onSubmit: (data: EditLoanFormValues) => Promise<void>;
  isSaving: boolean;
}

export function EditLoanDetailsDialog({
  isOpen,
  onOpenChange,
  loan,
  users,
  onSubmit,
  isSaving,
}: EditLoanDetailsDialogProps) {
  const form = useForm<EditLoanFormValues>({
    resolver: zodResolver(editLoanFormSchema),
  });

  useEffect(() => {
    if (loan && isOpen) {
      form.reset({
        customerName: loan.customerName,
        customerEmail: loan.customerEmail,
        customerPhone: loan.customerPhone,
        loanAmount: loan.loanAmount,
        loanType: loan.loanType,
        loanPurpose: loan.loanPurpose,
        assignedTo: loan.assignedTo || UNASSIGNED_DIALOG_OPTION_VALUE,
      });
    }
  }, [loan, isOpen, form]);

  if (!loan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Loan Details</DialogTitle>
          <DialogDescription>
            Modify the loan application information below. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="e.g., John Doe" {...field} className="pl-10" disabled={isSaving} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" placeholder="e.g., john.doe@example.com" {...field} className="pl-10" disabled={isSaving} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Phone</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="tel" placeholder="e.g., (555) 123-4567" {...field} className="pl-10" disabled={isSaving} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="loanAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Amount ($)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" placeholder="e.g., 10000" {...field} className="pl-10" disabled={isSaving} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="loanType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Type</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="e.g., Personal, Mortgage, Auto" {...field} className="pl-10" disabled={isSaving} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to User</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || UNASSIGNED_DIALOG_OPTION_VALUE} disabled={isSaving}>
                      <FormControl>
                         <div className="relative">
                          <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <SelectTrigger className="pl-10">
                              <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                         </div>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED_DIALOG_OPTION_VALUE}>Unassigned</SelectItem>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="loanPurpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loan Purpose</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        placeholder="Briefly describe the purpose of the loan..."
                        className="resize-none pl-10"
                        {...field}
                        rows={3}
                        disabled={isSaving}
                      />
                    </div>
                  </FormControl>
                  <FormDesc>
                    Provide a clear and concise reason for the loan application.
                  </FormDesc>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSaving}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
