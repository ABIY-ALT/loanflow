

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  FileSymlink,
  CheckCircle,
  XCircle,
  FileText,
  UploadCloud,
  Loader2,
  BadgeCheck,
  Download,
  Square,
  CheckSquare,
} from 'lucide-react';
import type {
  LoanRequest,
  LoanDocument,
  WorkflowStageDefinition,
  DocumentRequirement,
} from '@/types/loan';
import { LoanDocumentStatus, DocumentRequirementType } from '@/types/loan';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const getDocumentStatusIcon = (
  status: LoanDocument['status'] | 'Missing'
) => {
  switch (status) {
    case 'Pending':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'Submitted':
      return <FileSymlink className="h-4 w-4 text-blue-500" />;
    case 'Verified':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'Rejected':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'Missing':
      return <FileText className="h-4 w-4 text-gray-400" />;
    default:
      return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

const getDocumentBadgeVariant = (
  status: LoanDocument['status'] | 'Missing'
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'Verified':
      return 'default'; // Greenish, but relies on theme
    case 'Submitted':
      return 'secondary';
    case 'Pending':
      return 'outline';
    case 'Rejected':
      return 'destructive';
    case 'Missing':
      return 'outline';
    default:
      return 'outline';
  }
};

interface LoanDocumentsManagerProps {
  loan: LoanRequest;
  currentStageDef: WorkflowStageDefinition | null;
  onOpenUploadDialog?: (requirement: DocumentRequirement) => void;
  onVerifyDocument?: (docId: string) => Promise<void>;
  onCheckboxChange?: (
    requirement: DocumentRequirement,
    checked: boolean
  ) => Promise<void>;
  isSavingGlobal: boolean;
}

export function LoanDocumentsManager({
  loan,
  currentStageDef,
  onOpenUploadDialog,
  onVerifyDocument,
  onCheckboxChange,
  isSavingGlobal,
}: LoanDocumentsManagerProps) {
  const [isVerifyingDoc, setIsVerifyingDoc] = useState<string | null>(null);

  const handleVerify = async (docId: string) => {
    if (!onVerifyDocument) return;
    setIsVerifyingDoc(docId);
    await onVerifyDocument(docId);
    setIsVerifyingDoc(null);
  };

  const isActionable = !loan.isTerminalStage;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <FileText className="mr-2 h-5 w-5 text-primary" />
        Documents
      </h3>
      <p className="text-sm text-muted-foreground mb-1">
        Required for current stage:{' '}
        <span className="font-semibold">
          {currentStageDef?.name || 'Unknown Stage'}
        </span>
      </p>
      {currentStageDef?.documentRequirements.length ?? 0 > 0 ? (
        <ul className="space-y-3 mb-4">
          {currentStageDef?.documentRequirements.map((req) => {
            const uploadedDoc = loan.documents.find(
              (d) => d.requirementId === req.id
            );
            const status = uploadedDoc ? uploadedDoc.status : 'Missing';
            const isCurrentlyVerifyingThis =
              isSavingGlobal && isVerifyingDoc === uploadedDoc?.id;
            const isChecked = uploadedDoc?.status === LoanDocumentStatus.VERIFIED;

            if (req.type === DocumentRequirementType.CHECKBOX) {
              return (
                <li
                  key={req.id}
                  className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`req-check-${req.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) =>
                        onCheckboxChange?.(req, !!checked)
                      }
                      disabled={isSavingGlobal || !isActionable}
                    />
                    <Label
                      htmlFor={`req-check-${req.id}`}
                      className="font-medium cursor-pointer"
                    >
                      {req.name}
                    </Label>
                    {!req.isMandatory && (
                      <Badge variant="outline" className="text-xs">
                        Optional
                      </Badge>
                    )}
                  </div>
                </li>
              );
            }

            return (
              <li
                key={req.id}
                className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center">
                  {getDocumentStatusIcon(status)}
                  <span className="ml-2 font-medium">{req.name}</span>
                  {!req.isMandatory && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Optional
                    </Badge>
                  )}
                  {status === 'Missing' && req.isMandatory && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-xs border-dashed"
                    >
                      Missing
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {status !== 'Missing' && (
                    <Badge
                      variant={getDocumentBadgeVariant(status)}
                      className={
                        status === 'Verified'
                          ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700'
                          : status === 'Rejected'
                          ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700'
                          : ''
                      }
                    >
                      {status}
                    </Badge>
                  )}
                  
                  {onOpenUploadDialog && isActionable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenUploadDialog(req)}
                      disabled={isSavingGlobal}
                    >
                      <UploadCloud className="mr-1 h-4 w-4" /> Upload
                    </Button>
                  )}

                  {onVerifyDocument &&
                    uploadedDoc &&
                    uploadedDoc.status === LoanDocumentStatus.SUBMITTED &&
                    isActionable && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerify(uploadedDoc.id)}
                        disabled={isSavingGlobal || isCurrentlyVerifyingThis}
                      >
                        {isCurrentlyVerifyingThis ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <BadgeCheck className="mr-1 h-4 w-4" />
                        )}{' '}
                        Verify
                      </Button>
                    )}

                  {uploadedDoc?.filePath && (
                    <a
                      href={uploadedDoc.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground p-3 border rounded-md bg-background">
          No specific documents formally required for this stage in settings.
        </p>
      )}
    </div>
  );
}
