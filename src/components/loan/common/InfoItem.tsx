
'use client';

import React from 'react';

interface InfoItemProps {
  icon: React.ElementType; // Changed to ElementType
  label: string;
  value: string | number | undefined;
}

export function InfoItem({ icon: Icon, label, value }: InfoItemProps) { // Destructure as Icon
  return (
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0 text-primary pt-1">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground">{value || 'N/A'}</p>
      </div>
    </div>
  );
}
