
'use client';

import type { LoanRequest, User as UserType } from '@/types/loan';
import { DollarSign, Type, Info, User, Phone, Landmark, Building, Mail, Users as UsersIcon } from 'lucide-react'; // Added Mail, UsersIcon
import { InfoItem } from '@/components/loan/common/InfoItem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LoanInfoDisplayProps {
  loan: LoanRequest;
  assignedUsers?: UserType[];
  assignedDepartment?: string; // Added
}

export function LoanInfoDisplay({ loan, assignedUsers = [], assignedDepartment }: LoanInfoDisplayProps) {
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      <InfoItem icon={DollarSign} label="Loan Amount" value={`$${loan.loanAmount.toLocaleString()}`} />
      <InfoItem icon={Type} label="Loan Type" value={loan.loanType} />
      <InfoItem icon={Info} label="Loan Purpose" value={loan.loanPurpose} />
      <InfoItem icon={Mail} label="Customer Email" value={loan.customerEmail} />
      <InfoItem icon={Phone} label="Customer Phone" value={loan.customerPhone} />
      <InfoItem icon={Building} label="Responsible Department" value={assignedDepartment || 'N/A'} />
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-primary pt-1">
          <UsersIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Currently Assigned To</p>
          {assignedUsers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 mt-1">
               <TooltipProvider>
                {assignedUsers.map(user => (
                  <Tooltip key={user.id}>
                    <TooltipTrigger>
                       <Avatar className="h-8 w-8 text-xs">
                          <AvatarImage src={user.imageUrl} alt={user.fullName} />
                          <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                        </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{user.fullName}</p>
                      {user.customRoleName && <p className="text-xs text-muted-foreground">{user.customRoleName}</p>}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            </div>
          ) : (
            <p className="text-base font-semibold text-foreground">N/A (Unassigned)</p>
          )}
        </div>
      </div>
    </div>
  );
}
