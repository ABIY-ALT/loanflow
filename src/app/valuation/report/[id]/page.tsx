'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Printer, Save, ArrowLeft, Edit, CheckCircle, FileDown } from 'lucide-react';
import { getLoanRequestById, updateValuationReport, completeValuationWork } from '@/services/loan-service-prisma';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function ValuationReportPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [loan, setLoan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  const userDepartment = currentUser?.department?.toLowerCase() || '';
  const isValuationStaff = userDepartment.includes('valuation');
  const isAdmin = currentUser?.permissions.includes(PERMISSIONS.MANAGE_USERS);
  const canEditValuation = isValuationStaff || isAdmin;

  const [isExporting, setIsExporting] = useState(false);
  const [reportData, setReportData] = useState<any>({
    estimatedValue: '',
    valuationMethod: '',
    propertyDescription: '',
    locationObservations: '',
    marketAnalysis: '',
    finalRecommendation: '',
  });

  useEffect(() => {
    async function fetchLoan() {
      setIsLoading(true);
      try {
        const result = await getLoanRequestById(id as string);
        if (result.error) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
          // If it's a district specialized workflow, redirect to PVR
          if (result.loan?.workflowVersionId?.includes('wf-district')) {
             router.replace(`/loan-requests/district/pvr/${id}`);
             return;
          }
          setLoan(result.loan);
          if (result.loan?.valuationReportData) {
            setReportData(result.loan.valuationReportData);
          }
        }
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    fetchLoan();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateValuationReport(id as string, reportData);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Valuation Report saved successfully." });
        setIsEditing(false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;
    
    setIsExporting(true);
    toast({ title: "Generating PDF", description: "Preparing Valuation Report..." });
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Valuation-${loan.loanNumber || 'Export'}.pdf`);
      
      toast({ title: "Success", description: "Valuation Report exported successfully." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm("Are you sure you want to mark this valuation work as fully completed and submit for review?")) return;
    
    setIsCompleting(true);
    try {
      // Save current draft first
      await updateValuationReport(id as string, reportData);
      
      const result = await completeValuationWork(id as string);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Valuation work completed successfully." });
        router.push(`/loan-requests/${id}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  const isAlreadyCompleted = loan?.isValuationCompleted;

  return (
    <div className="p-8 max-w-5xl mx-auto print:p-0">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-3xl font-bold">Property Valuation Report</h1>
            <p className="text-muted-foreground truncate max-w-md">Preparation for {loan?.customerName}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          {canEditValuation && !isAlreadyCompleted && !isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Report
            </Button>
          )}
          {canEditValuation && isEditing && (
            <Button variant="outline" className="bg-amber-50 text-amber-700 border-amber-200" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
          )}
          {canEditValuation && !isAlreadyCompleted && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleComplete} disabled={isCompleting}>
               {isCompleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
               Mark Fully Completed
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExportPDF} disabled={isExporting} className="print:hidden bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      {!canEditValuation && (
        <Alert className="mb-6 bg-blue-50 border-blue-200 print:hidden">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle>Read-Only View</AlertTitle>
          <AlertDescription>
            You are viewing this valuation report in read-only mode. Only the Property Valuation department can edit this document.
          </AlertDescription>
        </Alert>
      )}

      <Card id="pdf-content" className="print:shadow-none print:border-none">
        <CardHeader className="border-b-2 border-black pb-6 text-center">
            <h2 className="text-2xl font-bold uppercase">Property Valuation Department</h2>
            <h3 className="text-xl font-semibold">Valuation Report</h3>
            <p className="text-sm mt-2">Loan Reference: {loan?.loanNumber}</p>
        </CardHeader>
        <CardContent className="p-12 space-y-8">
           <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="space-y-4">
                 <div>
                    <label className="font-bold uppercase text-xs text-muted-foreground">Customer Name</label>
                    <div className="p-2 border-b border-black font-medium">{loan?.customerName}</div>
                 </div>
                 <div>
                    <label className="font-bold uppercase text-xs text-muted-foreground">Estimated Value (ETB)</label>
                    <Input className="border-0 border-b border-black rounded-none h-auto p-0" value={reportData.estimatedValue} onChange={e => setReportData({...reportData, estimatedValue: e.target.value})} disabled={!isEditing || isAlreadyCompleted} />
                 </div>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="font-bold uppercase text-xs text-muted-foreground">Valuation Method</label>
                    <Input className="border-0 border-b border-black rounded-none h-auto p-0" value={reportData.valuationMethod} onChange={e => setReportData({...reportData, valuationMethod: e.target.value})} disabled={!isEditing || isAlreadyCompleted} />
                 </div>
                 <div>
                    <label className="font-bold uppercase text-xs text-muted-foreground">Inspection Date</label>
                    <div className="p-2 border-b border-black font-medium">{new Date().toLocaleDateString()}</div>
                 </div>
              </div>
           </div>

           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="font-bold uppercase text-xs text-muted-foreground">Property Description</label>
                 <Textarea className="min-h-[100px] border-black print:border-black" value={reportData.propertyDescription} onChange={e => setReportData({...reportData, propertyDescription: e.target.value})} disabled={!isEditing || isAlreadyCompleted} />
              </div>

              <div className="space-y-2">
                 <label className="font-bold uppercase text-xs text-muted-foreground">Location & Neighborhood Observations</label>
                 <Textarea className="min-h-[100px] border-black print:border-black" value={reportData.locationObservations} onChange={e => setReportData({...reportData, locationObservations: e.target.value})} disabled={!isEditing || isAlreadyCompleted} />
              </div>

              <div className="space-y-2">
                 <label className="font-bold uppercase text-xs text-muted-foreground">Market Analysis & Findings</label>
                 <Textarea className="min-h-[100px] border-black print:border-black" value={reportData.marketAnalysis} onChange={e => setReportData({...reportData, marketAnalysis: e.target.value})} disabled={!isEditing || isAlreadyCompleted} />
              </div>

              <div className="space-y-2">
                 <label className="font-bold uppercase text-xs text-muted-foreground">Final Valuation Recommendation</label>
                 <Textarea className="min-h-[100px] border-black print:border-black" value={reportData.finalRecommendation} onChange={e => setReportData({...reportData, finalRecommendation: e.target.value})} disabled={!isEditing || isAlreadyCompleted} />
              </div>
           </div>

           <div className="mt-12 grid grid-cols-2 gap-12 pt-12">
              <div className="text-center">
                 <div className="w-full border-b border-black h-8"></div>
                 <p className="font-bold mt-2">Valuation Officer</p>
              </div>
              <div className="text-center">
                 <div className="w-full border-b border-black h-8"></div>
                 <p className="font-bold mt-2">Department Head</p>
              </div>
           </div>
        </CardContent>
      </Card>
      
      <style jsx global>{`
        @media print {
          .print\:hidden {
            display: none !important;
          }
          body {
            background-color: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .Card {
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
