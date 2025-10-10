
'use client';

import type { LoanRequest, User as UserType } from '@/types/loan';
import { DollarSign, Type, Info, User, Phone, Landmark, Building } from 'lucide-react'; // Added Building for department
import { InfoItem } from '@/components/loan/common/InfoItem';

interface LoanInfoDisplayProps {
  loan: LoanRequest;
  assignedUser?: UserType;
  assignedDepartment?: string; // Added
}

export function LoanInfoDisplay({ loan, assignedUser, assignedDepartment }: LoanInfoDisplayProps) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      <InfoItem icon={DollarSign} label="Loan Amount" value={`$${loan.loanAmount.toLocaleString()}`} />
      <InfoItem icon={Type} label="Loan Type" value={loan.loanType} />
      <InfoItem icon={Info} label="Loan Purpose" value={loan.loanPurpose} />
      <InfoItem icon={User} label="Customer Email" value={loan.customerEmail} />
      <InfoItem icon={Phone} label="Customer Phone" value={loan.customerPhone} />
      <InfoItem icon={Building} label="Responsible Department" value={assignedDepartment || 'N/A'} />
      <InfoItem
        icon={Landmark}
        label="Currently Assigned To"
        value={assignedUser ? `${assignedUser.fullName || assignedUser.name} ${assignedUser.customRoleName ? `(${assignedUser.customRoleName})` : ''}`.trim() : "N/A (Unassigned to staff)"}
      />
    </div>
  );
}
