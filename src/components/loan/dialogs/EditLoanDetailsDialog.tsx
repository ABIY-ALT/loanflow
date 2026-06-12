
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
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export const UNASSIGNED_DIALOG_OPTION_VALUE = "---UNASSIGNED-DIALOG---";

// Updated schema to only include 'assignedTo'
const assignStaffFormSchema = z.object({
  assignedTo: z.array(z.string()).optional(), // Array of User IDs
});

type AssignStaffFormValues = z.infer<typeof assignStaffFormSchema> & {
  targetStageOrder?: number;
};

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
  // When provided, the assigner must choose which stage the case is routed to
  // (e.g. WF-05 Director picking the Wholesale or Retail division manager stage).
  divisionOptions?: { order: number; label: string }[];
  clearPreviousAssignments?: boolean;
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
  divisionOptions,
  clearPreviousAssignments,
}: EditLoanDetailsDialogProps) {
  const { user: currentUser } = useAuth();
  const userPermissions = useMemo(() => new Set(currentUser?.permissions || []), [currentUser]);
  
  // Assignment is strictly controlled by explicit assign permission.
  const canAssignStaff = userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF);

  const form = useForm<AssignStaffFormValues>({
    resolver: zodResolver(assignStaffFormSchema),
  });

  const [selectedDivision, setSelectedDivision] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (loan && isOpen) {
      form.reset({
        assignedTo: clearPreviousAssignments ? [] : (loan.assignedToUsers.map(u => u.id) || []),
      });
      setSelectedDivision(divisionOptions?.[0]?.order);
    }
  }, [loan, isOpen, form, divisionOptions, clearPreviousAssignments]);

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
          <form onSubmit={form.handleSubmit((d) => onSubmit({ ...d, targetStageOrder: divisionOptions?.length ? selectedDivision : undefined }))} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            {loan.submissionType === 'TYPE1' ? (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-md flex items-center gap-3 mb-4">
                 <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                    {loan.customerName?.slice(0, 1).toUpperCase() || 'C'}
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider">Customer Name</p>
                    <p className="text-sm font-bold text-blue-900 truncate">{loan.customerName || 'N/A'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] bg-white border-blue-200 text-blue-700 font-medium">
                        {loan.requestTypeName || 'Loan Request'}
                      </Badge>
                    </div>
                 </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex items-center gap-3 mb-4">
                 <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                    {loan.customerBranch?.slice(0, 2).toUpperCase() || '??'}
                 </div>
                 <div>
                    <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider">Customer Branch</p>
                    <p className="text-sm font-bold text-amber-900">{loan.customerBranch || 'Universal'}</p>
                 </div>
              </div>
            )}

            {divisionOptions && divisionOptions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-widest pl-1 text-indigo-700">Route to Division</h4>
                <div className="space-y-1 p-2 border rounded-md border-indigo-200 bg-indigo-50/40">
                  {divisionOptions.map(option => (
                    <label
                      key={option.order}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-sm cursor-pointer transition-colors",
                        selectedDivision === option.order ? "bg-indigo-100" : "hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="radio"
                        name="wf05-division"
                        checked={selectedDivision === option.order}
                        onChange={() => setSelectedDivision(option.order)}
                        disabled={isSaving}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span className="text-sm font-medium">{option.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pl-1">The case will move directly to the selected division stage; the other division is skipped.</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => {
                const targetBranch = (loan.customerBranch || '').trim().toLowerCase();
                
                // Grouping Logic
                const directors = users.filter(u => u.customRoleName?.toLowerCase().includes('director'));
                const chiefs = users.filter(u => u.customRoleName?.toLowerCase().includes('chief'));
                const managers = users.filter(u => u.customRoleName?.toLowerCase().includes('manager'));
                const crms = users.filter(u => 
                  u.customRoleName?.toLowerCase().includes('crm') && 
                  !u.customRoleName?.toLowerCase().includes('manager') && 
                  !u.customRoleName?.toLowerCase().includes('director') && 
                  !u.customRoleName?.toLowerCase().includes('chief')
                );
                const others = users.filter(u => 
                  !directors.includes(u) && 
                  !chiefs.includes(u) && 
                  !managers.includes(u) && 
                  !crms.includes(u)
                );

                const renderUserList = (userList: UserType[], groupLabel: string, highlightColor?: string) => {
                  if (userList.length === 0) return null;
                  
                  // Sort within group: Branch Match first
                  const sorted = [...userList].sort((a, b) => {
                    const aMatch = a.assignedBranches?.some(br => br.trim().toLowerCase() === targetBranch);
                    const bMatch = b.assignedBranches?.some(br => br.trim().toLowerCase() === targetBranch);
                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;
                    return a.fullName.localeCompare(b.fullName);
                  });

                  return (
                    <div className="space-y-2">
                      <h4 className={cn(
                        "text-[10px] font-bold uppercase tracking-widest pl-1",
                        highlightColor || "text-muted-foreground"
                      )}>{groupLabel}</h4>
                      <div className={cn(
                        "space-y-1 p-2 border rounded-md",
                        highlightColor ? "bg-muted/20 border-muted" : "border-border"
                      )}>
                        {sorted.map(user => (
                          <UserAssignmentRow 
                            key={user.id} 
                            user={user} 
                            isSelected={!!field.value?.includes(user.id)} 
                            onToggle={(selected) => {
                              const current = field.value || [];
                              field.onChange(selected ? [...current, user.id] : current.filter(id => id !== user.id));
                            }}
                            isSaving={isSaving}
                            isRecommended={user.assignedBranches?.some(br => br.trim().toLowerCase() === targetBranch)}
                            isCRMOnly={user.customRoleName?.toLowerCase().includes('crm')}
                          />
                        ))}
                      </div>
                    </div>
                  );
                };
                
                return (
                <FormItem>
                   <div className="flex items-center justify-between">
                     <FormLabel>Assign to Staff</FormLabel>
                   </div>
                    <FormDesc>Select staff members to follow up on this case. Hierarchy is grouped for easier selection.</FormDesc>
                    <div className="space-y-6 pt-2">
                      {/* Directors & Chiefs - Top Level */}
                      {(directors.length > 0 || chiefs.length > 0) && (
                        <div className="space-y-4">
                          {renderUserList(directors, "Directors", "text-purple-700")}
                          {renderUserList(chiefs, "Chief Officers", "text-blue-700")}
                        </div>
                      )}

                      {/* Managers - Middle Level */}
                      {renderUserList(managers, "Managers", "text-amber-700")}

                      {/* CRMs & Analysts - Operational Level */}
                      {renderUserList(crms, "Relationship Managers (CRMs)", "text-green-700")}
                      
                      {/* Others */}
                      {renderUserList(others, "Other Available Staff")}

                      {users.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No staff found for this department.</p>}
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

    