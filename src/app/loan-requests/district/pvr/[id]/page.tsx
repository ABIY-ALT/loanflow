'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Printer, FileDown } from 'lucide-react';
import { getLoanRequestById, updateLoanRequest, submitType2ToValuation } from '@/services/loan-service-prisma';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { ValuationRequisitionForm } from '@/components/loan/forms/ValuationRequisitionForm';
import { exportElementToPDF } from '@/lib/pdf-export';

export default function PVRPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [loan, setLoan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function fetchLoan() {
      setIsLoading(true);
      try {
        const result = await getLoanRequestById(id as string);
        if (result.error) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
          setLoan(result.loan);
        }
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    fetchLoan();
  }, [id]);


  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      const { _isFinalizeAction, ...updateData } = data;
      
      const updateResult = await updateLoanRequest(id as string, updateData);
      if (updateResult.error) {
        toast({ title: "Error", description: updateResult.error, variant: "destructive" });
        return;
      }

      if (_isFinalizeAction) {
        const submitResult = await submitType2ToValuation(id as string);
        if ('error' in submitResult) {
          toast({ title: "Error", description: submitResult.error, variant: "destructive" });
        } else {
          router.push(`/loan-requests/${id}`); // Go back to detail
        }
      } else {
        setLoan(updateResult.updatedLoan);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Skip is available via the main loan header; not shown on the PVR page.

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportElementToPDF('pdf-content', `PVR-${loan?.loanNumber || 'Export'}.pdf`);
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!loan) return <div className="p-8 text-center">Loan not found.</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-sm border sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-xl font-bold italic text-primary">Property Valuation Requisition</h1>
            <p className="text-xs text-muted-foreground">{loan.customerName} | {loan.loanNumber}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
          <Button onClick={handleExportPDF} disabled={isExporting} className="bg-slate-900 text-white hover:bg-slate-800">
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Export PDF
          </Button>
        </div>
      </div>

      <div id="pdf-content" className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Determine if read only based on stage order or if it's already finalized */}
        {(() => {
          const currentStage = loan.workflowVersion?.stages?.find((s: any) => s.id === loan.currentStageId);
          const isReadOnly = (currentStage?.order > 2) || loan.lafStatus === 'EXPORTED';
          
          return (
            <ValuationRequisitionForm 
              loan={loan} 
              onSave={handleSave} 
              isSaving={isSaving} 
              isReadOnly={isReadOnly}
            />
          );
        })()}
      </div>

    </div>
  );
}
