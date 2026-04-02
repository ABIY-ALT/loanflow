

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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, User as UserIconLucide, Info, Phone, DollarSign, Type, Landmark, Mail, Briefcase } from 'lucide-react';
import type { LoanRequest, User as UserType, Department } from '@/types/loan';
import { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { isValidLocalEthiopianPhone, normalizeEthiopianPhone } from '@/lib/utils';

export const UNASSIGNED_DIALOG_OPTION_VALUE = "---UNASSIGNED-DIALOG---";

const editLoanFormSchema = z.object({
  customerName: z.string().min(2, { message: 'Customer name must be at least 2 characters.' }),
  customerEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  customerPhone: z.string()
    .transform(normalizeEthiopianPhone)
    .refine(isValidLocalEthiopianPhone, { message: 'Phone number must be in local format like 0912345678 or 0712345678.' }),
  loanAmount: z.coerce.number().positive({ message: 'Loan amount must be a positive number.' }),
  sectorName: z.string().min(2, { message: 'Sector is required.' }),
  requestTypeName: z.string().min(2, { message: 'Request Type is required.' }),
  loanPurpose: z.string().min(10, { message: 'Loan purpose must be at least 10 characters.' }),
  assignedTo: z.array(z.string()).optional(), // Array of User IDs
});

type EditLoanFormValues = z.infer<typeof editLoanFormSchema>;

interface EditLoanDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  loan: LoanRequest | null;
  users: UserType[];
  currentDepartment?: Department;
  onSubmit: (data: EditLoanFormValues) => Promise<void>;
  isSaving: boolean;
}

export function EditLoanDetailsDialog({
  isOpen,
  onOpenChange,
  loan,
  users,
  currentDepartment,
  onSubmit,
  isSaving,
}: EditLoanDetailsDialogProps) {
  const { user: currentUser } = useAuth();
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);
  
  const canEditDetails = userPermissions.has(PERMISSIONS.EDIT_LOAN_DETAILS);
  const canAssignStaff = userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF);

  const form = useForm<EditLoanFormValues>({
    resolver: zodResolver(editLoanFormSchema),
  });

  useEffect(() => {
    if (loan && isOpen) {
      form.reset({
        customerName: loan.customerName,
        customerEmail: loan.customerEmail,
        customerPhone: loan.customerPhone || '',
        loanAmount: loan.loanAmount,
        sectorName: loan.sectorName,
        requestTypeName: loan.requestTypeName,
        loanPurpose: loan.loanPurpose,
        assignedTo: loan.assignedToUsers.map(u => u.id) || [],
      });
    }
  }, [loan, isOpen, form]);

  if (!loan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Loan Details / Assign Staff</DialogTitle>
          <DialogDescription>
            Modify loan application info. Current Department: <span className="font-semibold">{currentDepartment || 'N/A'}</span>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField control={form.control} name="customerName" render={({ field }) => ( <FormItem> <FormLabel>Customer Name</FormLabel> <FormControl><div className="relative"><UserIconLucide className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="e.g., John Doe" {...field} className="pl-10" disabled={isSaving || !canEditDetails} /></div></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="customerEmail" render={({ field }) => ( <FormItem> <FormLabel>Customer Email</FormLabel> <FormControl><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="email" placeholder="e.g., john.doe@example.com" {...field} className="pl-10" disabled={isSaving || !canEditDetails} /></div></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="customerPhone" render={({ field }) => ( <FormItem> <FormLabel>Customer Phone</FormLabel> <FormControl><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" placeholder="e.g., 0912345678" {...field} onChange={(event) => field.onChange(normalizeEthiopianPhone(event.target.value))} className="pl-10" disabled={isSaving || !canEditDetails} /></div></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="loanAmount" render={({ field }) => ( <FormItem> <FormLabel>Loan Amount ($)</FormLabel> <FormControl><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="number" placeholder="e.g., 10000" {...field} className="pl-10" disabled={isSaving || !canEditDetails} /></div></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="sectorName" render={({ field }) => ( <FormItem> <FormLabel>Sector</FormLabel> <FormControl><div className="relative"><Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="e.g., Agriculture" {...field} className="pl-10" disabled={isSaving || !canEditDetails} /></div></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="requestTypeName" render={({ field }) => ( <FormItem> <FormLabel>Request Type</FormLabel> <FormControl><div className="relative"><Type className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="e.g., New Loan" {...field} className="pl-10" disabled={isSaving || !canEditDetails} /></div></FormControl> <FormMessage /> </FormItem> )} />
            </div>

             {canAssignStaff && (
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                       <FormLabel>Assign to Staff (in {currentDepartment || 'current'} Dept)</FormLabel>
                        <FormDesc>Changing assignments will reset any "stage complete" sign-offs for this stage.</FormDesc>
                        <div className="space-y-2 p-3 border rounded-md max-h-48 overflow-y-auto">
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
              )}

            <FormField control={form.control} name="loanPurpose" render={({ field }) => ( <FormItem> <FormLabel>Loan Purpose</FormLabel> <FormControl><div className="relative"><Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Textarea placeholder="Briefly describe the purpose of the loan..." className="resize-none pl-10" {...field} rows={3} disabled={isSaving || !canEditDetails} /></div></FormControl> <FormDesc>Provide a clear and concise reason for the loan application.</FormDesc> <FormMessage /> </FormItem> )} />
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSaving}> {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
