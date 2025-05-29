
'use client';

import React from 'react'; // Changed to full import

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | undefined;
}

export function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0 text-primary pt-1">
        {React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground">{value || 'N/A'}</p>
      </div>
    </div>
  );
}
