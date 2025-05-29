
'use client';

import type { LoanRequest, User as UserType } from '@/types/loan';
import { DollarSign, Type, Info, User, Phone, Landmark } from 'lucide-react';
import { InfoItem } from '@/components/loan/common/InfoItem';

interface LoanInfoDisplayProps {
  loan: LoanRequest;
  assignedUser?: UserType;
}

export function LoanInfoDisplay({ loan, assignedUser }: LoanInfoDisplayProps) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      <InfoItem icon={<DollarSign />} label="Loan Amount" value={`$${loan.loanAmount.toLocaleString()}`} />
      <InfoItem icon={<Type />} label="Loan Type" value={loan.loanType} />
      <InfoItem icon={<Info />} label="Loan Purpose" value={loan.loanPurpose} />
      <InfoItem icon={<User />} label="Customer Email" value={loan.customerEmail} />
      <InfoItem icon={<Phone />} label="Customer Phone" value={loan.customerPhone} />
      {assignedUser ? (
        <InfoItem icon={<Landmark />} label="Currently Assigned To" value={`${assignedUser.name} (${assignedUser.role})`} />
      ) : (
        <InfoItem icon={<Landmark />} label="Currently Assigned To" value="N/A (Unassigned)" />
      )}
    </div>
  );
}

