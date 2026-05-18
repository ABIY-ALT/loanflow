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
  LayoutDashboard,
  ExternalLink,
  UserCircle,
  Landmark,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

const getDocumentStatusIcon = (
  status: LoanDocumentStatus | 'Missing'
) => {
  switch (status) {
    case LoanDocumentStatus.PENDING:
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case LoanDocumentStatus.SUBMITTED:
      return <FileSymlink className="h-4 w-4 text-blue-500" />;
    case LoanDocumentStatus.VERIFIED:
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case LoanDocumentStatus.REJECTED:
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'Missing':
      return <FileText className="h-4 w-4 text-gray-400" />;
    default:
      return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

const getDocumentBadgeVariant = (
  status: LoanDocumentStatus | 'Missing'
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case LoanDocumentStatus.VERIFIED:
      return 'default'; // Greenish, but relies on theme
    case LoanDocumentStatus.SUBMITTED:
      return 'secondary';
    case LoanDocumentStatus.PENDING:
      return 'outline';
    case LoanDocumentStatus.REJECTED:
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
    <div className="space-y-6">
      {/* System Generated Documents for Type 2 */}
      {loan.submissionType === 'TYPE2' && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <LayoutDashboard className="mr-2 h-5 w-5 text-primary" />
            System Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(currentStageDef?.order ?? 0) >= 4 && (
              <Card className="border-amber-100 bg-amber-50/30">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-600" />
                    Loan Approval Form (LAF)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex justify-between items-center">
                  <Badge variant={loan.lafData ? "default" : "outline"} className={loan.lafData ? "bg-amber-100 text-amber-700 border-amber-200" : ""}>
                    {loan.lafData ? "Prepared" : "Not Started"}
                  </Badge>
                  <Link href={`/loan-requests/district/laf/${loan.id}`} passHref>
                    <Button variant="ghost" size="sm" className="h-8 text-amber-700 hover:text-amber-800 hover:bg-amber-100">
                      {(currentStageDef?.order ?? 0) > 4 ? "View / Export" : "View / Edit"} <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {(currentStageDef?.order ?? 0) >= 4 && (
              <Card className="border-blue-100 bg-blue-50/30">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-blue-600" />
                    Customer Summary (CAFC)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex justify-between items-center">
                  <Badge variant={loan.customerSummaryData ? "default" : "outline"} className={loan.customerSummaryData ? "bg-blue-100 text-blue-700 border-blue-200" : ""}>
                    {loan.customerSummaryData ? "Prepared" : "Not Started"}
                  </Badge>
                  <Link href={`/loan-requests/district/customer-summary/${loan.id}`} passHref>
                    <Button variant="ghost" size="sm" className="h-8 text-blue-700 hover:text-blue-800 hover:bg-blue-100">
                      {(currentStageDef?.order ?? 0) > 4 ? "View / Export" : "View / Edit"} <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card className="border-emerald-100 bg-emerald-50/30">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-emerald-600" />
                  Property Valuation Requisition (PVR)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex justify-between items-center">
                <Badge variant={loan.pvrData ? "default" : "outline"} className={loan.pvrData ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                  {loan.pvrData ? "Prepared" : "Not Started"}
                </Badge>
                <Link href={`/loan-requests/district/pvr/${loan.id}`} passHref>
                  <Button variant="ghost" size="sm" className="h-8 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100">
                    {(currentStageDef?.order ?? 0) > 2 ? "View / Export" : "View / Edit"} <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {(currentStageDef?.order ?? 0) >= 3 && (
              <Card className="border-green-100 bg-green-50/30">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-green-600" />
                    Valuation Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex justify-between items-center">
                  <Badge variant={loan.isValuationCompleted ? "default" : "outline"} className={loan.isValuationCompleted ? "bg-green-100 text-green-700 border-green-200" : ""}>
                    {loan.isValuationCompleted ? "Completed" : (loan.valuationReportData ? "Draft Saved" : "Not Started")}
                  </Badge>
                  <Link href={`/valuation/report/${loan.id}`} passHref>
                    <Button variant="ghost" size="sm" className="h-8 text-green-700 hover:text-green-800 hover:bg-green-100">
                      View / Prepare <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="mr-2 h-5 w-5 text-primary" />
          Stage Documents
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
                        status === LoanDocumentStatus.VERIFIED
                          ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700'
                          : status === LoanDocumentStatus.REJECTED
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
                      href={`/api/downloads/${uploadedDoc.filePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                        <span className="sr-only">Download {uploadedDoc.name}</span>
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
    </div>
  );
}
