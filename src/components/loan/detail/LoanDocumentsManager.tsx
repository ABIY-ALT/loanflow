
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { LoanRequest, LoanDocument, WorkflowStageDefinition } from '@/types/loan';
import { FileText, CheckCircle, XCircle, AlertCircle, FileSymlink, Paperclip, UploadCloud, BadgeCheck, Loader2 } from 'lucide-react';

const getDocumentStatusIcon = (status: LoanDocument['status'] | 'Missing') => {
    switch (status) {
    case 'Pending': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'Submitted': return <FileSymlink className="h-4 w-4 text-blue-500" />;
    case 'Verified': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'Rejected': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'Missing': return <FileText className="h-4 w-4 text-gray-400" />;
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

const getDocumentBadgeVariant = (status: LoanDocument['status'] | 'Missing'): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Verified': return 'default'; // Greenish, but relies on theme
    case 'Submitted': return 'secondary';
    case 'Pending': return 'outline';
    case 'Rejected': return 'destructive';
    case 'Missing': return 'outline';
    default: return 'outline';
  }
};

interface LoanDocumentsManagerProps {
  loan: LoanRequest;
  currentStageDef: WorkflowStageDefinition | null; // Use new stage definition
  onOpenUploadDialog: (docName: string) => void;
  onVerifyDocument: (docName: string) => Promise<void>;
  isSavingGlobal: boolean;
}

export function LoanDocumentsManager({
  loan,
  currentStageDef,
  onOpenUploadDialog,
  onVerifyDocument,
  isSavingGlobal,
}: LoanDocumentsManagerProps) {
  const requiredDocumentsForCurrentStage = currentStageDef?.requiredDocumentNames || [];
  const [isVerifyingDoc, setIsVerifyingDoc] = useState<string | null>(null);


  const handleVerify = async (docName: string) => {
    setIsVerifyingDoc(docName);
    await onVerifyDocument(docName);
    setIsVerifyingDoc(null);
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 flex items-center"><Paperclip className="mr-2 h-5 w-5 text-primary" />Documents</h3>
      <p className="text-sm text-muted-foreground mb-1">Required for current stage: <span className="font-semibold">{currentStageDef?.name || 'Unknown Stage'}</span></p>
      {requiredDocumentsForCurrentStage.length > 0 ? (
        <ul className="space-y-3 mb-4">
          {requiredDocumentsForCurrentStage.map(reqDocName => {
            const uploadedDoc = loan.documents.find(d => d.name === reqDocName);
            const status = uploadedDoc ? uploadedDoc.status : 'Missing';
            const isCurrentlyVerifyingThis = isSavingGlobal && isVerifyingDoc === reqDocName;
            return (
              <li key={reqDocName} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/50 transition-colors">
                <div className="flex items-center">
                  {getDocumentStatusIcon(status)}
                  <span className="ml-2">{reqDocName}</span>
                   {status === 'Missing' && <Badge variant="outline" className="ml-2 text-xs border-dashed">Missing</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={getDocumentBadgeVariant(status)}
                    className={status === 'Verified' ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700' : status === 'Rejected' ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700' : ''}
                  >
                    {status}
                  </Badge>
                  {status === 'Missing' || status === 'Pending' || status === 'Rejected' ? (
                    <Button variant="outline" size="sm" onClick={() => onOpenUploadDialog(reqDocName)} disabled={isSavingGlobal}>
                      <UploadCloud className="mr-1 h-4 w-4" /> Upload
                    </Button>
                  ) : status === 'Submitted' ? (
                     <Button variant="outline" size="sm" onClick={() => handleVerify(reqDocName)} disabled={isSavingGlobal || isCurrentlyVerifyingThis}>
                      {isCurrentlyVerifyingThis ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <BadgeCheck className="mr-1 h-4 w-4" />} Verify
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground p-3 border rounded-md bg-background">No specific documents formally required for this stage in settings.</p>
      )}

      {loan.documents.filter(doc => !requiredDocumentsForCurrentStage.includes(doc.name)).length > 0 && (
        <>
          <Separator className="my-4"/>
          <h4 className="text-md font-semibold mb-2">Other Uploaded Documents</h4>
          <ul className="space-y-2">
            {loan.documents.filter(doc => !requiredDocumentsForCurrentStage.includes(doc.name)).map(doc => (
               <li key={doc.id} className="flex items-center justify-between p-3 border rounded-md bg-background/50 text-sm">
                 <div className="flex items-center">
                   {getDocumentStatusIcon(doc.status)} <span className="ml-2">{doc.name}</span>
                 </div>
                 <Badge variant={getDocumentBadgeVariant(doc.status)}>{doc.status}</Badge>
               </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
