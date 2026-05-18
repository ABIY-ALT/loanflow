
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
import { CheckedState } from '@radix-ui/react-checkbox';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { LoanRequest, User as UserType, Department } from '@/types/loan';
import { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex items-center gap-3 mb-4">
               <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                  {loan.customerBranch?.slice(0, 2).toUpperCase() || '??'}
               </div>
               <div>
                  <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider">Customer Branch</p>
                  <p className="text-sm font-bold text-amber-900">{loan.customerBranch || 'Universal'}</p>
               </div>
            </div>

            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => {
                const targetBranch = (loan.customerBranch || '').trim().toLowerCase();
                
                // Sort users: 1. Branch Match, 2. CRM role, 3. Others
                const sortedUsers = [...users].sort((a, b) => {
                  const aMatch = a.assignedBranches?.some(br => br.trim().toLowerCase() === targetBranch);
                  const bMatch = b.assignedBranches?.some(br => br.trim().toLowerCase() === targetBranch);
                  if (aMatch && !bMatch) return -1;
                  if (!aMatch && bMatch) return 1;

                  const aIsCRM = a.customRoleName?.toLowerCase().includes('crm');
                  const bIsCRM = b.customRoleName?.toLowerCase().includes('crm');
                  if (aIsCRM && !bIsCRM) return -1;
                  if (!aIsCRM && bIsCRM) return 1;

                  return a.fullName.localeCompare(b.fullName);
                });

                const branchMatchingUsers = sortedUsers.filter(u => 
                  u.assignedBranches?.some(br => br.trim().toLowerCase() === targetBranch)
                );
                
                const otherUsers = sortedUsers.filter(u => 
                  !u.assignedBranches?.some(br => br.trim().toLowerCase() === targetBranch)
                );
                
                return (
                <FormItem>
                   <div className="flex items-center justify-between">
                     <FormLabel>Assign to Staff</FormLabel>
                     {branchMatchingUsers.length > 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 text-[10px]">
                           {branchMatchingUsers.length} Branch Match{branchMatchingUsers.length > 1 ? 'es' : ''}
                        </Badge>
                     )}
                   </div>
                    <FormDesc>Select staff members to follow up on this case. CRMs are prioritized.</FormDesc>
                    <div className="space-y-4 pt-2">
                      {branchMatchingUsers.length > 0 && (
                         <div className="space-y-2">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest pl-1 text-green-700">Recommended (Branch Match)</h4>
                            <div className="space-y-1 p-2 border border-green-200 bg-green-50/30 rounded-md">
                               {branchMatchingUsers.map(user => (
                                   <UserAssignmentRow 
                                     key={user.id} 
                                     user={user} 
                                     isSelected={!!field.value?.includes(user.id)} 
                                     onToggle={(selected) => {
                                       const current = field.value || [];
                                       field.onChange(selected ? [...current, user.id] : current.filter(id => id !== user.id));
                                     }}
                                     isSaving={isSaving}
                                     isRecommended
                                     isCRMOnly={user.customRoleName?.toLowerCase().includes('crm')}
                                   />
                               ))}
                            </div>
                         </div>
                      )}

                      <div className="space-y-2">
                         <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest pl-1">
                            {branchMatchingUsers.length > 0 ? 'Other Available Staff' : 'Available Staff (CRMs First)'}
                         </h4>
                         <div className="space-y-1 p-2 border rounded-md max-h-64 overflow-y-auto">
                            {otherUsers.map(user => (
                               <UserAssignmentRow 
                                 key={user.id} 
                                 user={user} 
                                 isSelected={!!field.value?.includes(user.id)} 
                                 onToggle={(selected) => {
                                   const current = field.value || [];
                                   field.onChange(selected ? [...current, user.id] : current.filter(id => id !== user.id));
                                 }}
                                 isSaving={isSaving}
                                 // Force highlight for CRMs even if no branch match, but use a subtle indicator
                                 isCRMOnly={user.customRoleName?.toLowerCase().includes('crm')}
                               />
                            ))}
                            {users.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No staff found for this district.</p>}
                         </div>
                      </div>
                    </div>
                  <FormMessage />
                </FormItem>
              )}}
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

function UserAssignmentRow({ 
  user, 
  isSelected, 
  onToggle, 
  isSaving,
  isRecommended,
  isCRMOnly
}: { 
  user: UserType, 
  isSelected: boolean, 
  onToggle: (selected: boolean) => void,
  isSaving: boolean,
  isRecommended?: boolean,
  isCRMOnly?: boolean
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-sm transition-colors",
      isSelected ? "bg-primary/5" : "hover:bg-muted/50",
      isRecommended && isSelected && "bg-green-50"
    )}>
       <div className="flex items-center space-x-3 text-left">
          <Checkbox 
            id={`user-${user.id}`}
            checked={isSelected}
            onCheckedChange={(checked) => onToggle(!!checked)}
            disabled={isSaving}
          />
          <div className="grid gap-0.5">
             <div className="flex items-center gap-2">
                <label 
                  htmlFor={`user-${user.id}`}
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                   {user.fullName}
                </label>
                {isCRMOnly && !isRecommended && (
                  <Badge variant="outline" className="text-[7px] h-3 px-1 font-bold bg-amber-50 text-amber-700 border-amber-200">CRM</Badge>
                )}
             </div>
             <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                {user.customRoleName || 'Staff'} 
                {user.assignedBranches && user.assignedBranches.length > 0 && (
                   <> • {user.assignedBranches.join(', ')}</>
                )}
             </p>
          </div>
       </div>
       {isRecommended && (
         <Badge variant="outline" className="text-[8px] h-4 uppercase bg-green-100 text-green-700 border-green-200">Match</Badge>
       )}
    </div>
  );
}

    