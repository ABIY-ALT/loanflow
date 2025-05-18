
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit3, PlusCircle, FileText, CheckCircle, XCircle, AlertCircle, Clock, Landmark, User, DollarSign, Type, Info, FileSymlink, Paperclip, Phone, UploadCloud, BadgeCheck } from 'lucide-react';
import type { LoanRequest, LoanDocument, LoanHistoryEntry } from '@/types/loan';
import { LoanStage } from '@/types/loan';
import { mockLoanRequests } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, parseISO } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { loanStages } from '@/types/loan'; // This is an array of enum values
import { initialStageConfigs, type StageConfig } from '@/app/settings/page'; // "Mock" import for prototype
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from '@/components/ui/textarea';
import React from 'react';
import { useToast } from '@/hooks/use-toast';

// Helper function to get stage color
const getStageColor = (stage: LoanStage) => {
  switch (stage) {
    case LoanStage.APPLICATION_SUBMITTED: return 'bg-sky-500';
    case LoanStage.DOCUMENT_COLLECTION: return 'bg-blue-500';
    case LoanStage.UNDER_REVIEW: return 'bg-indigo-500';
    case LoanStage.ADDITIONAL_INFO_REQUIRED: return 'bg-yellow-500 text-black';
    case LoanStage.APPROVED: return 'bg-green-500';
    case LoanStage.REJECTED: return 'bg-red-500';
    case LoanStage.FUNDS_DISBURSED: return 'bg-emerald-600';
    default: return 'bg-gray-500';
  }
};

const getDocumentStatusIcon = (status: LoanDocument['status'] | 'Missing') => {
  switch (status) {
    case 'Pending': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'Submitted': return <FileSymlink className="h-4 w-4 text-blue-500" />;
    case 'Verified': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'Rejected': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'Missing': return <FileText className="h-4 w-4 text-gray-400" />; // Icon for missing but required
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
};

// Simplified document status variant for badge
const getDocumentBadgeVariant = (status: LoanDocument['status'] | 'Missing'): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case 'Verified': return 'default'; // default is often primary, consider a specific green
    case 'Submitted': return 'secondary';
    case 'Pending': return 'outline';
    case 'Rejected': return 'destructive';
    case 'Missing': return 'outline'; // Or a more distinct variant
    default: return 'outline';
  }
};


export default function LoanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const loanId = params.id as string;

  // In a real app, fetch this data & stage configs
  const [loan, setLoan] = React.useState<LoanRequest | undefined>(() => mockLoanRequests.find(l => l.id === loanId));
  
  const [isAddInfoDialogOpen, setIsAddInfoDialogOpen] = React.useState(false);
  const [isUploadDocDialogOpen, setIsUploadDocDialogOpen] = React.useState(false);
  const [currentDocumentToUpload, setCurrentDocumentToUpload] = React.useState<string | null>(null); // To contextualize dialog
  const [additionalInfo, setAdditionalInfo] = React.useState('');


  if (!loan) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Loan Request Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The loan request with ID "{loanId}" could not be found. It might have been deleted or the ID is incorrect.
        </p>
        <Button onClick={() => router.push('/loan-process')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to Loan Pipeline
        </Button>
      </div>
    );
  }

  const currentStageIndex = loanStages.indexOf(loan.currentStage);
  const progressPercentage = ((currentStageIndex + 1) / loanStages.length) * 100;

  // Find current stage configuration from the "mock" imported settings
  const currentStageConfig: StageConfig | undefined = initialStageConfigs.find(
    (config) => config.loanStageEnum === loan.currentStage
  );
  const requiredDocumentsForCurrentStage = currentStageConfig?.requiredDocuments || [];
  
  const handleAddInfoSubmit = () => {
    if (!additionalInfo.trim()) {
        toast({ title: "Info Required", description: "Please specify what information is needed.", variant: "destructive" });
        return;
    }
    setLoan(prevLoan => {
        if (!prevLoan) return undefined;
        const newHistoryEntry: LoanHistoryEntry = {
            id: `hist-${prevLoan.history.length + 1}`,
            stage: LoanStage.ADDITIONAL_INFO_REQUIRED, // Explicitly set
            timestamp: new Date().toISOString(),
            userId: 'current-user-id', 
            userName: 'Bank User',
            requiredFulfilment: additionalInfo,
            notes: `Requested additional info: ${additionalInfo}`
        };
        return {
            ...prevLoan,
            currentStage: LoanStage.ADDITIONAL_INFO_REQUIRED,
            history: [...prevLoan.history, newHistoryEntry],
            lastUpdatedDate: new Date().toISOString(),
        };
    });
    setAdditionalInfo('');
    setIsAddInfoDialogOpen(false);
    toast({ title: "Information Requested", description: "Customer has been notified about the required information." });
  };

  const handleAdvanceWorkflow = (nextStage: LoanStage) => {
    setLoan(prevLoan => {
        if (!prevLoan) return undefined;
        // Basic check: if moving to approved, ensure no pending "additional info"
        if (nextStage === LoanStage.APPROVED && prevLoan.currentStage === LoanStage.ADDITIONAL_INFO_REQUIRED) {
            const hasOpenInfoRequest = prevLoan.history.some(h => h.stage === LoanStage.ADDITIONAL_INFO_REQUIRED && !h.notes?.includes("Fulfilled")); // Simplistic check
            if (hasOpenInfoRequest) {
                toast({title: "Action Pending", description: "Cannot approve. Outstanding information request.", variant: "destructive"});
                return prevLoan; // Don't advance
            }
        }

        const newHistoryEntry: LoanHistoryEntry = {
            id: `hist-${prevLoan.history.length + 1}`,
            stage: nextStage,
            timestamp: new Date().toISOString(),
            userId: 'current-user-id',
            userName: 'Bank User',
            notes: `Moved to stage: ${nextStage}`
        };
        return {
            ...prevLoan,
            currentStage: nextStage,
            history: [...prevLoan.history, newHistoryEntry],
            lastUpdatedDate: new Date().toISOString(),
        };
    });
    toast({ title: "Workflow Advanced", description: `Loan moved to ${nextStage}.`});
  };

  const handleUploadDocument = (docName: string) => {
    // Simulate document upload
    setCurrentDocumentToUpload(docName); // For dialog context
    // This function will be called by the "Upload" button in the dialog
    // For now, we just add it to loan.documents with 'Submitted' status
    setLoan(prevLoan => {
        if (!prevLoan) return undefined;
        const existingDocIndex = prevLoan.documents.findIndex(d => d.name === docName);
        let updatedDocuments: LoanDocument[];

        if (existingDocIndex > -1) {
            updatedDocuments = prevLoan.documents.map((doc, index) => 
                index === existingDocIndex ? { ...doc, status: 'Submitted' } : doc
            );
        } else {
            updatedDocuments = [
                ...prevLoan.documents,
                { id: `doc-${Date.now()}`, name: docName, status: 'Submitted' }
            ];
        }
        return { ...prevLoan, documents: updatedDocuments, lastUpdatedDate: new Date().toISOString() };
    });
    toast({ title: "Document Submitted", description: `${docName} marked as submitted.` });
    setIsUploadDocDialogOpen(false); // Close dialog after "upload"
  };

  const handleVerifyDocument = (docName: string) => {
    setLoan(prevLoan => {
        if (!prevLoan) return undefined;
        const updatedDocuments = prevLoan.documents.map(doc => 
            doc.name === docName ? { ...doc, status: 'Verified' } : doc
        );
        return { ...prevLoan, documents: updatedDocuments, lastUpdatedDate: new Date().toISOString() };
    });
    toast({ title: "Document Verified", description: `${docName} has been verified.` });
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Dialog open={isAddInfoDialogOpen} onOpenChange={setIsAddInfoDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Edit3 className="mr-2 h-4 w-4" /> Request Info</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Additional Information</DialogTitle>
                <DialogDescription>
                  Specify what the customer needs to provide. This will move the loan to 'Additional Info Required'.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Label htmlFor="additional-info">Information to Fulfill</Label>
                <Textarea 
                  id="additional-info" 
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="e.g., Latest utility bill, Clarification on income source" 
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddInfoDialogOpen(false)}>Cancel</Button>
                <Button type="submit" onClick={handleAddInfoSubmit}>Confirm & Request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {currentStageIndex < loanStages.length -1 && 
           loan.currentStage !== LoanStage.REJECTED && 
           loan.currentStage !== LoanStage.FUNDS_DISBURSED && (
            <Button onClick={() => handleAdvanceWorkflow(loanStages[currentStageIndex + 1])}>
                Advance to: {loanStages[currentStageIndex + 1]}
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <CardTitle className="text-2xl font-bold text-primary">{loan.customerName}</CardTitle>
              <CardDescription>Loan Number: {loan.loanNumber} | Customer Number: {loan.customerNumber}</CardDescription>
            </div>
            <Badge className={`px-3 py-1.5 text-sm font-medium text-white ${getStageColor(loan.currentStage)}`}>
              {loan.currentStage}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-6">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Loan Progress</Label>
            <Progress value={progressPercentage} className="w-full mt-1 h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Submitted: {format(parseISO(loan.submittedDate), 'MMM dd, yyyy')}</span>
              {loan.stageDeadline && (
                <span className={loan.isOverdue ? "text-destructive font-semibold" : ""}>
                  <Clock className="inline h-3 w-3 mr-1" />
                  Stage Deadline: {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}
                  {loan.isOverdue && " (Overdue)"}
                </span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <InfoItem icon={<DollarSign />} label="Loan Amount" value={`$${loan.loanAmount.toLocaleString()}`} />
            <InfoItem icon={<Type />} label="Loan Type" value={loan.loanType} />
            <InfoItem icon={<Info />} label="Loan Purpose" value={loan.loanPurpose} />
            <InfoItem icon={<User />} label="Customer Email" value={loan.customerEmail} />
            <InfoItem icon={<Phone />} label="Customer Phone" value={loan.customerPhone} />
            {loan.assignedTo && <InfoItem icon={<Landmark />} label="Assigned To" value={loan.assignedTo} />}
          </div>

          <Separator className="my-8" />

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center"><Paperclip className="mr-2 h-5 w-5 text-primary" />Documents</h3>
              <p className="text-sm text-muted-foreground mb-1">Required for current stage: <span className="font-semibold">{loan.currentStage}</span></p>
              {requiredDocumentsForCurrentStage.length > 0 ? (
                <ul className="space-y-3 mb-4">
                  {requiredDocumentsForCurrentStage.map(reqDoc => {
                    const uploadedDoc = loan.documents.find(d => d.name === reqDoc.name);
                    const status = uploadedDoc ? uploadedDoc.status : 'Missing';
                    return (
                      <li key={reqDoc.id} className="flex items-center justify-between p-3 border rounded-md bg-background hover:bg-muted/50 transition-colors">
                        <div className="flex items-center">
                          {getDocumentStatusIcon(status)}
                          <span className="ml-2">{reqDoc.name}</span>
                           {status === 'Missing' && <Badge variant="outline" className="ml-2 text-xs border-dashed">Missing</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={getDocumentBadgeVariant(status)}
                            className={status === 'Verified' ? 'bg-green-100 text-green-700 border-green-300' : status === 'Rejected' ? 'bg-red-100 text-red-700 border-red-300' : ''}
                          >
                            {status}
                          </Badge>
                          {status === 'Missing' || status === 'Pending' || status === 'Rejected' ? (
                            <Button variant="outline" size="sm" onClick={() => { setCurrentDocumentToUpload(reqDoc.name); setIsUploadDocDialogOpen(true); }}>
                              <UploadCloud className="mr-1 h-4 w-4" /> Upload
                            </Button>
                          ) : status === 'Submitted' ? (
                             <Button variant="outline" size="sm" onClick={() => handleVerifyDocument(reqDoc.name)}>
                              <BadgeCheck className="mr-1 h-4 w-4" /> Verify
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

              <Dialog open={isUploadDocDialogOpen} onOpenChange={(isOpen) => { setIsUploadDocDialogOpen(isOpen); if (!isOpen) setCurrentDocumentToUpload(null);}}>
                  <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Document: {currentDocumentToUpload || "General Upload"}</DialogTitle>
                        <DialogDescription>
                            {currentDocumentToUpload ? `Upload the file for "${currentDocumentToUpload}".` : "Select a file to upload."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                          <Label htmlFor="doc-upload">Select file</Label>
                          <Input id="doc-upload" type="file" className="mt-1"/>
                          <p className="text-xs text-muted-foreground mt-2">Actual file handling & upload to storage needs backend integration.</p>
                      </div>
                      <DialogFooter>
                          <Button variant="outline" onClick={() => setIsUploadDocDialogOpen(false)}>Cancel</Button>
                          <Button onClick={() => {
                            if(currentDocumentToUpload) {
                                handleUploadDocument(currentDocumentToUpload);
                            } else {
                                // Handle generic upload if needed or show error
                                toast({title: "Error", description: "No document type specified for upload.", variant: "destructive"});
                            }
                          }}>
                            Simulate Upload
                          </Button>
                      </DialogFooter>
                  </DialogContent>
              </Dialog>

              {loan.documents.filter(doc => !requiredDocumentsForCurrentStage.find(rd => rd.name === doc.name)).length > 0 && (
                <>
                  <Separator className="my-4"/>
                  <h4 className="text-md font-semibold mb-2">Other Uploaded Documents</h4>
                  <ul className="space-y-2">
                    {loan.documents.filter(doc => !requiredDocumentsForCurrentStage.find(rd => rd.name === doc.name)).map(doc => (
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

            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" />History & Timeline</h3>
              {loan.history.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {loan.history.slice().reverse().map(entry => (
                    <HistoryEntryItem key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No history entries for this loan yet.</p>
              )}
            </div>
          </div>
        </CardContent>
         <CardFooter className="p-6 border-t">
            <p className="text-xs text-muted-foreground">
                Last Updated: {format(parseISO(loan.lastUpdatedDate), 'PPpp')}
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}
const InfoItem = ({ icon, label, value }: InfoItemProps) => (
  <div className="flex items-start space-x-3">
    <div className="flex-shrink-0 text-primary pt-1">{React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}</div>
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

interface HistoryEntryItemProps {
  entry: LoanHistoryEntry;
}
const HistoryEntryItem = ({ entry }: HistoryEntryItemProps) => (
  <div className="relative pl-6 pb-4 border-l border-border">
    <div className={`absolute -left-[0.30rem] top-1 w-2.5 h-2.5 rounded-full ${getStageColor(entry.stage)}`}></div>
    <p className="text-sm font-medium">{entry.stage}</p>
    <p className="text-xs text-muted-foreground">
      {format(parseISO(entry.timestamp), 'MMM dd, yyyy, HH:mm')} by {entry.userName}
    </p>
    {entry.notes && <p className="text-sm mt-1 bg-background p-2 rounded-md border">{entry.notes}</p>}
    {entry.requiredFulfilment && <p className="text-sm mt-1 p-2 rounded-md border border-amber-500 bg-amber-50 text-amber-700">Required: {entry.requiredFulfilment}</p>}
  </div>
);
