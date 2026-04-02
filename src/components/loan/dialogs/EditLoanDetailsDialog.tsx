
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
import {
  Form,
  FormControl,
  FormDescription as FormDesc,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { LoanRequest, User as UserType, Department } from '@/types/loan';
import { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';

export const UNASSIGNED_DIALOG_OPTION_VALUE = "---UNASSIGNED-DIALOG---";

// Updated schema to only include 'assignedTo'
const assignStaffFormSchema = z.object({
  assignedTo: z.array(z.string()).optional(), // Array of User IDs
});

type AssignStaffFormValues = z.infer<typeof assignStaffFormSchema>;

interface EditLoanDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loan: LoanRequest | null;
  users: UserType[];
  currentDepartment?: Department;
  onSubmit: (data: AssignStaffFormValues) => Promise<void>;
  isSaving: boolean;
  title?: string;
  description?: string;
  submitLabel?: string;
}

export function EditLoanDetailsDialog({
  isOpen,
  onOpenChange,
  loan,
  users,
  currentDepartment,
  onSubmit,
  isSaving,
  title,
  description,
  submitLabel,
}: EditLoanDetailsDialogProps) {
  const { user: currentUser } = useAuth();
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);
  
  // Assignment is strictly controlled by explicit assign permission.
  const canAssignStaff = userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF);

  const form = useForm<AssignStaffFormValues>({
    resolver: zodResolver(assignStaffFormSchema),
  });

  useEffect(() => {
    if (loan && isOpen) {
      form.reset({
        assignedTo: loan.assignedToUsers.map(u => u.id) || [],
      });
    }
  }, [loan, isOpen, form]);

  if (!loan || !canAssignStaff) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title || 'Assign Staff'}</DialogTitle>
          <DialogDescription>
            {description || (
              <>
                Select staff members from the <span className="font-semibold">{currentDepartment || 'current'}</span> department to assign to this loan.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem>
                   <FormLabel>Assign to Staff</FormLabel>
                    <FormDesc>Changing assignments will reset any "stage complete" sign-offs for this stage.</FormDesc>
                    <div className="space-y-2 p-3 border rounded-md max-h-60 overflow-y-auto">
                    {users.map((user) => (
                        <FormField
                        key={user.id}
                        control={form.control}
                        name="assignedTo"
                        render={({ field }) => {
                            return (
                            <FormItem
                                key={user.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                            >
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(user.id)}
                                    onCheckedChange={(checked) => {
                                    return checked
                                        ? field.onChange([...(field.value || []), user.id])
                                        : field.onChange(
                                            field.value?.filter(
                                            (value) => value !== user.id
                                            )
                                        )
                                    }}
                                    disabled={isSaving}
                                />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                    {user.fullName} {user.customRoleName ? `(${user.customRoleName})` : ''}
                                </FormLabel>
                            </FormItem>
                            )
                        }}
                        />
                    ))}
                    {users.length === 0 && <p className="text-sm text-muted-foreground text-center">No staff found for this department.</p>}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSaving}> {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {submitLabel || 'Save Changes'} </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    