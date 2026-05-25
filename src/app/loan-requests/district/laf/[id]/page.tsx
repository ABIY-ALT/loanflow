'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, Save, ArrowLeft, Edit, FileDown, Plus, Trash2, AlertCircle } from 'lucide-react';
import { getLoanRequestById, updateLAF, submitType2ToValuation, submitDistrictLafAndSummary, approveDistrictManagerCheck, approveDistrictAnalyst, approveFinalDistrictManager } from '@/services/loan-service-prisma';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';
import { canAnalystSubmitToFinalManager, isAnalystReturnedFromManager } from '@/lib/district-workflow';
import { NIB_LOGO_SRC } from '@/lib/brand';

export default function LAFPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loan, setLoan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSubmittingToValuation, setIsSubmittingToValuation] = useState(false);
  const [isSubmittingToManager, setIsSubmittingToManager] = useState(false);
  const [isSubmittingToAnalyst, setIsSubmittingToAnalyst] = useState(false);
  const [isSubmittingToFinalManager, setIsSubmittingToFinalManager] = useState(false);

  // Expanded LAF Data Structure to match the image
  const [lafData, setLafData] = useState<any>({
    acknowledgmentDate: '',
    crmName: '',
    crmSignature: '',
    analystName: '',
    analystSignature: '',
    divisionManagerName: '',
    divisionManagerSignature: '',
    recommendationByCrmName: '',
    recommendationByCrmSignature: '',
    recommendationByLoanOfficerName: '',
    recommendationByLoanOfficerSignature: '',
    managerComments: '',
    managerFinalComments: '',
    creditDecisionWaad: '',
    creditDecisionDistrictName: '',
    loanOfficer: '',
    dateReceivedBy: '',
    creditRiskTeam: '',
    creditApprovingTeam: '',
    dateCommunicated: '',

    sector: '',
    subSector: '',
    subSectorCode: '',
    totalCapital: '2,056,000,000.00',
    totalExposure: '',
    exposureToCapitalRatio: '',
    relatedPartyInfo: 'N/R%',

    lafNo: '',
    branch: '',
    date: new Date().toISOString().split('T')[0],
    tradingLicense: '',
    tin: '',
    loanCode: '',
    applicantName: '',
    customerClassification: 'Retail',
    creditRiskGrade: 'C',
    typeOfBusiness: '',
    currentRequest: '',
    purpose: '',

    presentLoans: [
      { type: 'TL', limit: '8,500,000.00', balance: '4,316,005.56', grantedDate: '30/08/2022', dueDate: '30/08/2027', rate: '22.75%', repAmount: '663,731.00', arrears: '0', status: 'P' }
    ],
    collaterals: [
      { type: '', titleDeed: '', prevEstValue: '', prevEstDate: '', recentValue: '', recentDate: '', valueAfterMargin: '', remark: '' }
    ],

    totalCollateralValue: '0.00',
    lessExistingTL: '4,316,005.56',
    lessRecommendTL: '12,000,000.00',
    lessRecommendOD: '4,000,000.00',
    excessDeficit: '0.00',

    fulfillmentComments: '',
    creditInformation: '',
    taxClearance: '',
    basisOfRecommendation: [
      'The applicant has been in the business since 2008 E.C.',
      'Applicant has good account turnover and relationship with our bank.',
      'The business in which the applicant engaged in is viable and profitable.'
    ],
    analystRecommendation: '',
    approvingTeamMembers: [
      { name: '', role: 'Chairperson' },
      { name: '', role: 'V. Member' },
      { name: '', role: 'V. Member' },
      { name: '', role: 'N.V. Secretary' }
    ],
    creditDecisionWaad: '',
    refrainingIdeas: '',
    refrainingIdeasName: '',
    refrainingIdeasSignature: ''
  });

  useEffect(() => {
    async function fetchLoan() {
      setIsLoading(true);
      try {
        const result = await getLoanRequestById(id as string);
        if (result.error) {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        } else {
          setLoan(result.loan);
          if (result.loan?.lafData) {
            setLafData(result.loan.lafData);
          } else {
            setLafData((prev: any) => ({
              ...prev,
              applicantName: result.loan?.customerName || '',
              branch: result.loan?.customerBranch || '',
              sector: result.loan?.sectorName || '',
              typeOfBusiness: `Importing of ${result.loan?.sectorName || 'Goods'}`,
              currentRequest: `Import term loan of Birr ${result.loan?.loanAmount.toLocaleString()}.00 payable within 5 years`,
              purpose: result.loan?.loanPurpose || '',
              lafNo: `NIB/SAAD/${new Date().getFullYear().toString().slice(-2)}/${result.loan?.loanNumber.split('-').pop() || Math.floor(Math.random() * 1000)}`,
            }));
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
      const result = await updateLAF(id as string, lafData);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "LAF saved successfully." });
        setIsEditing(false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    const sections = document.querySelectorAll<HTMLElement>('#pdf-content .pdf-section');
    if (!sections.length) return;

    setIsExporting(true);
    toast({ title: "Generating PDF", description: "Preparing LAF document..." });

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      let isFirstPage = true;

      for (const section of Array.from(sections)) {
        const canvas = await html2canvas(section, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        while (heightLeft > 0) {
          if (!isFirstPage) pdf.addPage();
          isFirstPage = false;
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
          position = heightLeft - imgHeight;
        }
      }

      pdf.save(`LAF-${loan?.loanNumber || 'Export'}.pdf`);
      toast({ title: "Success", description: "LAF exported successfully." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmitToManager = async () => {
    setIsSubmittingToManager(true);
    try {
      // First save the current data
      await updateLAF(id as string, lafData);
      
      const result = await submitDistrictLafAndSummary(id as string);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case submitted to District Manager successfully." });
        router.push(`/loan-requests/${id}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingToManager(false);
    }
  };

  const handleApproveByManager = async () => {
    setIsSubmittingToAnalyst(true);
    try {
      const result = await approveDistrictManagerCheck(id as string, lafData.managerComments);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case approved and sent to Analyst Review." });
        router.push(`/loan-requests/${id}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingToAnalyst(false);
    }
  };
  const handleApproveByAnalyst = async () => {
    setIsSubmittingToFinalManager(true);
    try {
      const result = await approveDistrictAnalyst(id as string, lafData.analystRecommendation);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case analysis completed and sent to Final Manager Review." });
        router.push(`/loan-requests/${id}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingToFinalManager(false);
    }
  };

  const handleFinalApproveByManager = async () => {
    setIsSubmittingToFinalManager(true);
    try {
      const result = await approveFinalDistrictManager(id as string, lafData.managerFinalComments);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Final approval completed. Case sent for Committee Distribution." });
        router.push(`/loan-requests/${id}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingToFinalManager(false);
    }
  };

  const addRow = (table: 'presentLoans' | 'collaterals') => {
    const newRow = table === 'presentLoans' 
      ? { type: '', limit: '', balance: '', grantedDate: '', dueDate: '', rate: '', repAmount: '', arrears: '', status: '' }
      : { type: '', titleDeed: '', prevEstValue: '', prevEstDate: '', recentValue: '', recentDate: '', valueAfterMargin: '', remark: '' };
    setLafData({ ...lafData, [table]: [...lafData[table], newRow] });
  };

  const removeRow = (table: 'presentLoans' | 'collaterals', index: number) => {
    const newList = [...lafData[table]];
    newList.splice(index, 1);
    setLafData({ ...lafData, [table]: newList });
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;

  const isOrder4 = loan?.currentStageOrder === 4;
  const isOrder5 = loan?.currentStageOrder === 5;
  const isOrder6 = loan?.currentStageOrder === 6;
  const isOrder7 = loan?.currentStageOrder === 7;
  const isReturnedFromManager = isAnalystReturnedFromManager(loan ?? {});
  const canSendToFinalManager = canAnalystSubmitToFinalManager(loan ?? {});
  const isReadOnlyAtStage = ![4, 5, 6].includes(loan?.currentStageOrder || 0);
  const isReadOnly = !isEditing || isReadOnlyAtStage;

  return (
    <div className="print:p-0 print:bg-white print:m-0">
      <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-sm border sticky top-0 z-50 p-4 md:p-8 max-w-[1000px] mx-auto space-y-6 bg-slate-100">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-xl font-bold">Loan Approval Form (LAF)</h1>
            <p className="text-xs text-muted-foreground">{loan?.customerName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isOrder4 || isOrder5) && !isReadOnlyAtStage && (
            <Button 
              variant={isEditing ? "default" : "outline"} 
              className={cn(isEditing && "bg-amber-600 hover:bg-amber-700")}
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
              disabled={isSaving || isSubmittingToManager || isSubmittingToAnalyst}
            >
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : (isEditing ? <Save className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />)}
              {isEditing ? "Save Draft" : "Edit Form"}
            </Button>
          )}

          {isOrder4 && !isReadOnlyAtStage && (
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={handleSubmitToManager}
              disabled={isSubmittingToManager || isSaving}
            >
              {isSubmittingToManager ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Finalize & Send to Manager
            </Button>
          )}

          {isOrder5 && (
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              onClick={handleApproveByManager}
              disabled={isSubmittingToAnalyst}
            >
              {isSubmittingToAnalyst ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Approve & Send to Analyst
            </Button>
          )}

          {isOrder6 && canSendToFinalManager && (
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              onClick={handleApproveByAnalyst}
              disabled={isSubmittingToFinalManager}
            >
              {isSubmittingToFinalManager ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Complete & Send to Final Manager
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
          <Button onClick={handleExportPDF} disabled={isExporting} className="bg-slate-900 text-white"><FileDown className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>

      {isReturnedFromManager && (
        <Alert className="max-w-[1000px] mx-auto mb-4 print:hidden border-indigo-200 bg-indigo-50">
          <AlertCircle className="h-4 w-4 text-indigo-700" />
          <AlertTitle className="text-indigo-900">Returned for comment</AlertTitle>
          <AlertDescription className="text-indigo-800">
            The Operation Manager returned this case. You cannot send it back to the manager. Open the loan detail page and use{' '}
            <strong>Distribute for District Approval</strong> when your response is ready.
          </AlertDescription>
        </Alert>
      )}

      <div id="pdf-content" className="bg-white shadow-2xl p-[0.75in] mx-auto w-full text-[11px] font-serif leading-tight text-slate-900 border-t-[10px] border-amber-500 print:shadow-none print:border-none print:p-5 print:m-0 print:rounded-none max-w-[1000px]">

        <div className="pdf-section space-y-4">
        {/* Header */}
        <div className="flex justify-between mb-6 border-b-2 border-slate-900 pb-2 avoid-page-break">
          <div className="flex gap-4 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={NIB_LOGO_SRC}
              alt="NIB International Bank"
              width={50}
              height={50}
              className="h-[50px] w-[50px] flex-shrink-0 object-contain"
            />
            <div>
              <h2 className="text-lg font-bold">NIB INTERNATIONAL BANK</h2>
              <h3 className="text-md font-bold">LOAN APPROVAL FORM (LAF)</h3>
              <p className="italic text-[9px] font-bold text-red-600"># Highly Confidential</p>
            </div>
          </div>
          <div className="text-[9px] space-y-0.5 w-[280px]">
             {[
               { l: 'Acknowledgment Letter Date Provide', k: 'acknowledgmentDate' },
               { l: 'Customer Relationship Manager', k: 'crmName' },
               { l: 'Loan Officer:', k: 'loanOfficer' },
               { l: 'Date of Application Received By:', k: 'dateReceivedBy' },
               { l: 'Credit Risk Analysis Team', k: 'creditRiskTeam' },
               { l: 'Credit Approving Team', k: 'creditApprovingTeam' },
               { l: 'Date communicated to customer', k: 'dateCommunicated' }
             ].map((item, i) => (
               <div key={i} className="flex justify-between gap-1 items-end border-b border-dotted border-slate-300 h-4">
                 <span className="font-bold whitespace-nowrap">{item.l}</span>
                 {isReadOnly ? <span className="font-medium underline">{lafData[item.k]}</span> : <Input className="h-4 p-0 text-[9px] text-right border-none shadow-none focus-visible:ring-0" value={lafData[item.k]} onChange={e => setLafData({...lafData, [item.k]: e.target.value})} />}
               </div>
             ))}
          </div>
        </div>

        {/* Info Boxes */}
        <div className="grid grid-cols-2 gap-4 mb-4 avoid-page-break">
           <div className="border border-slate-900 p-1.5 space-y-0.5">
              {[
                { l: 'Sector:', k: 'sector' },
                { l: 'Sub-Sector:', k: 'subSector' },
                { l: 'Sub-sector code:', k: 'subSectorCode' },
                { l: 'Bank\'s total capital Birr:', k: 'totalCapital' },
                { l: 'Total exposure of a borrower:', k: 'totalExposure' },
                { l: 'Total exposure vs Capital Ratio:', k: 'exposureToCapitalRatio' },
                { l: 'Related Party Info:', k: 'relatedPartyInfo' }
              ].map((item, i) => (
                <div key={i} className="flex gap-1">
                  <span className="font-bold min-w-[130px]">{item.l}</span>
                  {isReadOnly ? <span className="underline">{lafData[item.k]}</span> : <Input className="h-3 p-0.5 text-[9px] border-none shadow-none focus-visible:ring-0" value={lafData[item.k]} onChange={e => setLafData({...lafData, [item.k]: e.target.value})} />}
                </div>
              ))}
           </div>
           <div className="border border-slate-900 border-dashed p-1.5 flex flex-col justify-center space-y-1">
              {[
                { l: 'Trading License Number:', k: 'tradingLicense' },
                { l: 'Tax Identification Number:', k: 'tin' },
                { l: 'Loan Code Number:', k: 'loanCode' }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center h-5">
                  <span className="font-bold">{item.l}</span>
                  {isReadOnly ? <span className="underline font-bold text-right">{lafData[item.k]}</span> : <Input className="h-5 w-1/2 text-right p-1 text-[9px]" value={lafData[item.k]} onChange={e => setLafData({...lafData, [item.k]: e.target.value})} />}
                </div>
              ))}
           </div>
        </div>

        {/* Primary Data (1-7) */}
        <div className="space-y-0.5 mb-4">
           {[
             { n: '1.', l: 'LAF No.', k: 'lafNo', extra: 'Branch', ek: 'branch', date: true },
             { n: '2.', l: 'Name of Applicant(s):', k: 'applicantName' },
             { n: '3.', l: 'Customer Classification:', k: 'customerClassification' },
             { n: '4.', l: 'Credit Risk Grade:', k: 'creditRiskGrade' },
             { n: '5.', l: 'Type of Business:', k: 'typeOfBusiness' },
             { n: '6.', l: 'Current Request:', k: 'currentRequest' },
             { n: '7.', l: 'Purpose:', k: 'purpose' }
           ].map((item, i) => (
             <div key={i} className="flex items-center gap-1 h-5">
               <span className="font-bold w-4">{item.n}</span>
               <span className="font-bold min-w-[140px]">{item.l}</span>
               <div className="flex-grow border-b border-slate-900 h-4">
                  {isReadOnly ? <span className="font-bold italic">{lafData[item.k]}</span> : <Input className="h-4 p-0 border-none italic font-bold text-[10px] shadow-none focus-visible:ring-0" value={lafData[item.k]} onChange={e => setLafData({...lafData, [item.k]: e.target.value})} />}
               </div>
               {item.extra && (
                 <>
                   <span className="font-bold ml-2">{item.extra}</span>
                   <div className="w-20 border-b border-slate-900 text-center h-4">
                      {isReadOnly ? <span className="font-bold italic">{lafData[item.ek]}</span> : <Input className="h-4 p-0 border-none text-center shadow-none focus-visible:ring-0" value={lafData[item.ek]} onChange={e => setLafData({...lafData, [item.ek]: e.target.value})} />}
                   </div>
                 </>
               )}
               {item.date && (
                 <>
                   <span className="font-bold ml-2">Date</span>
                   <div className="w-20 border-b border-slate-900 text-center h-4">
                      {isReadOnly ? <span className="font-bold italic">{lafData.date}</span> : <Input type="date" className="h-4 p-0 border-none shadow-none focus-visible:ring-0" value={lafData.date} onChange={e => setLafData({...lafData, date: e.target.value})} />}
                   </div>
                 </>
               )}
             </div>
           ))}
        </div>

        {/* Present Loans Table */}
        <div className="mb-4 avoid-page-break">
           <div className="flex justify-between items-center mb-0.5">
              <h4 className="font-bold">8. Present Loans and Credit Facilities</h4>
              {!isReadOnly && <Button size="sm" variant="ghost" className="h-4 text-[8px]" onClick={() => addRow('presentLoans')}><Plus className="h-2 w-2 mr-1"/>Add</Button>}
           </div>
           <Table className="border border-slate-900">
              <TableHeader className="bg-slate-100">
                <TableRow className="h-6 border-slate-900 border-b">
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-[9px] text-slate-900">No</TableHead>
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-[9px] text-slate-900">Type of Facility</TableHead>
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-[9px] text-slate-900">Limit</TableHead>
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-[9px] text-slate-900">Balance</TableHead>
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-[9px] text-slate-900">Date Granted</TableHead>
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-[9px] text-slate-900">Due Date</TableHead>
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-[9px] text-slate-900">Rate</TableHead>
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-[9px] text-slate-900">Arrears</TableHead>
                  <TableHead className="p-0.5 text-center font-bold text-[9px] text-slate-900">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {lafData.presentLoans.map((row: any, idx: number) => (
                   <TableRow key={idx} className="h-6 border-b border-slate-300">
                      <TableCell className="border-r border-slate-900 p-0.5 text-center">{idx + 1}</TableCell>
                      {['type', 'limit', 'balance', 'grantedDate', 'dueDate', 'rate', 'arrears', 'status'].map((col) => (
                        <TableCell key={col} className="border-r border-slate-900 p-0.5">
                           {isReadOnly ? <div className="text-center font-medium">{row[col]}</div> : <Input className="h-4 p-0 text-[9px] border-none text-center shadow-none focus-visible:ring-0" value={row[col]} onChange={e => {
                             const newList = [...lafData.presentLoans];
                             newList[idx][col] = e.target.value;
                             setLafData({...lafData, presentLoans: newList});
                           }} />}
                        </TableCell>
                      ))}
                      {!isReadOnly && <TableCell className="p-0.5 text-center"><Button variant="ghost" size="icon" className="h-3 w-3 text-red-500" onClick={() => removeRow('presentLoans', idx)}><Trash2 className="h-2 w-2"/></Button></TableCell>}
                   </TableRow>
                 ))}
              </TableBody>
           </Table>
        </div>

        {/* Collateral Table */}
        <div className="mb-4 avoid-page-break">
           <div className="flex justify-between items-center mb-0.5">
              <h4 className="font-bold">9. Collateral</h4>
              {!isReadOnly && <Button size="sm" variant="ghost" className="h-4 text-[8px]" onClick={() => addRow('collaterals')}><Plus className="h-2 w-2 mr-1"/>Add</Button>}
           </div>
           <Table className="border border-slate-900 text-[9px]">
              <TableHeader className="bg-slate-100">
                <TableRow className="border-slate-900 border-b">
                  <TableHead rowSpan={2} className="border-r border-slate-900 p-0.5 text-center font-bold text-slate-900">No</TableHead>
                  <TableHead rowSpan={2} className="border-r border-slate-900 p-0.5 text-center font-bold text-slate-900">Collateral Type</TableHead>
                  <TableHead rowSpan={2} className="border-r border-slate-900 p-0.5 text-center font-bold text-slate-900">Title Deed No</TableHead>
                  <TableHead rowSpan={2} className="border-r border-slate-900 p-0.5 text-center font-bold text-slate-900">Prev Est</TableHead>
                  <TableHead colSpan={2} className="border-r border-slate-900 p-0.5 text-center font-bold text-slate-900">Recent Estimation</TableHead>
                  <TableHead rowSpan={2} className="border-r border-slate-900 p-0.5 text-center font-bold text-slate-900">Val after Margin</TableHead>
                  <TableHead rowSpan={2} className="p-0.5 text-center font-bold text-slate-900">Remark</TableHead>
                </TableRow>
                <TableRow className="border-slate-900 border-b bg-slate-50">
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-slate-900">Value</TableHead>
                  <TableHead className="border-r border-slate-900 p-0.5 text-center font-bold text-slate-900">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {lafData.collaterals.map((row: any, idx: number) => (
                   <TableRow key={idx} className="border-b border-slate-300">
                      <TableCell className="border-r border-slate-900 p-0.5 text-center font-bold">{idx + 1}</TableCell>
                      {['type', 'titleDeed', 'prevEstValue', 'recentValue', 'recentDate', 'valueAfterMargin', 'remark'].map((col) => (
                        <TableCell key={col} className="border-r border-slate-900 p-0.5">
                           {isReadOnly ? <div className="text-center italic">{row[col]}</div> : <Textarea className="min-h-[24px] p-0.5 text-[8px] border-none shadow-none focus-visible:ring-0" value={row[col]} onChange={e => {
                             const newList = [...lafData.collaterals];
                             newList[idx][col] = e.target.value;
                             setLafData({...lafData, collaterals: newList});
                           }} />}
                        </TableCell>
                      ))}
                      {!isReadOnly && <TableCell className="p-0.5 text-center"><Button variant="ghost" size="icon" className="h-3 w-3 text-red-500" onClick={() => removeRow('collaterals', idx)}><Trash2 className="h-2 w-2"/></Button></TableCell>}
                   </TableRow>
                 ))}
                 {/* Summary Rows */}
                 {[
                   { l: 'Total Collateral Value', k: 'totalCollateralValue', bold: true },
                   { l: 'Less Existing facility', k: 'lessExistingTL' },
                   { l: 'Less Recommend TL', k: 'lessRecommendTL' },
                   { l: 'Less Recommend OD', k: 'lessRecommendOD' },
                   { l: 'Excess/Deficit (After Deductions)', k: 'excessDeficit', bold: true, bg: 'bg-slate-100' }
                 ].map((row, i) => (
                   <TableRow key={i} className={cn("h-5", row.bg)}>
                      <TableCell colSpan={4} className="border-r border-slate-900 p-0.5 font-bold text-right italic">{row.l}</TableCell>
                      <TableCell className="border-r border-slate-900 p-0.5 text-center font-bold">
                        {isReadOnly ? <span>{lafData[row.k]}</span> : <Input className="h-4 p-0 border-none text-center font-bold shadow-none focus-visible:ring-0" value={lafData[row.k]} onChange={e => setLafData({...lafData, [row.k]: e.target.value})} />}
                      </TableCell>
                      <TableCell className="border-r border-slate-900 p-0.5 text-center font-bold"></TableCell>
                      <TableCell className="border-r border-slate-900 p-0.5 text-center font-bold">
                         {isReadOnly ? <span>{lafData[row.k]}</span> : <Input className="h-4 p-0 border-none text-center font-bold shadow-none focus-visible:ring-0" value={lafData[row.k]} onChange={e => setLafData({...lafData, [row.k]: e.target.value})} />}
                      </TableCell>
                      <TableCell className="p-0.5"></TableCell>
                   </TableRow>
                 ))}
              </TableBody>
           </Table>
        </div>

        {/* Section 10 */}
        <div className="mb-4 border border-slate-900 p-2 space-y-1 avoid-page-break">
           <h4 className="font-bold text-xs uppercase">10. Fulfillment of relevant documents</h4>
           <div className="space-y-1 text-[10px]">
              <div>
                <span className="font-bold underline">Credit Information:</span>
                {isReadOnly ? <p className="italic ml-2">{lafData.creditInformation || "N/A"}</p> : <Textarea className="h-8 ml-2" value={lafData.creditInformation} onChange={e => setLafData({...lafData, creditInformation: e.target.value})} />}
              </div>
              <div>
                <span className="font-bold underline">Tax clearance:</span>
                {isReadOnly ? <p className="italic ml-2">{lafData.taxClearance || "N/A"}</p> : <Textarea className="h-8 ml-2" value={lafData.taxClearance} onChange={e => setLafData({...lafData, taxClearance: e.target.value})} />}
              </div>
           </div>
        </div>

        <div className="mt-8 flex justify-between text-[8px] text-muted-foreground border-t pt-1 italic uppercase font-sans print:hidden">
           <span>{lafData.lafNo}</span>
           <span>NIB INTERNATIONAL BANK - Internal Document</span>
           <span>Page 1 of 2</span>
        </div>
        </div>

        <div className="pdf-section space-y-4">
        {/* Basis of Recommendation */}
        <div className="mb-6 avoid-page-break">
           <h4 className="font-bold text-xs underline uppercase mb-2">11. Basis of Recommendation</h4>
           <ul className="space-y-1">
              {lafData.basisOfRecommendation.map((item: string, i: number) => (
                <li key={i} className="flex gap-2 items-start italic text-[10px]">
                   <span className="font-bold">➤</span>
                   <div className="flex-grow">
                      {isReadOnly ? <p>{item}</p> : <Input className="h-5 p-1" value={item} onChange={e => {
                        const newList = [...lafData.basisOfRecommendation];
                        newList[i] = e.target.value;
                        setLafData({...lafData, basisOfRecommendation: newList});
                      }} />}
                   </div>
                </li>
              ))}
              {!isReadOnly && <Button size="sm" variant="ghost" className="h-4 text-[8px]" onClick={() => setLafData({...lafData, basisOfRecommendation: [...lafData.basisOfRecommendation, '']})}>+ Add Point</Button>}
           </ul>
        </div>

        {/* Analysts Recommendation */}
        <div className="mb-6 space-y-4 avoid-page-break">
           <div>
              <h4 className="font-bold text-xs uppercase underline">12. CRM Confirmation</h4>
              <p className="italic text-[10px] mt-1">I confirm that all the information filled-out are in line with the checklist.</p>
              <div className="grid grid-cols-1 gap-2 mt-6 text-[10px]">
             <div>
               <label className="block font-semibold text-[9px] uppercase">CRM Name</label>
               {isReadOnly ? (
                 <div className="mt-1 font-bold">{lafData.crmName || 'CRM NAME'}</div>
               ) : (
                 <Input
                   className="mt-1 text-[10px]"
                   value={lafData.crmName}
                   placeholder="Enter CRM name"
                   onChange={e => setLafData({...lafData, crmName: e.target.value})}
                 />
               )}
             </div>
             <div>
               <label className="block font-semibold text-[9px] uppercase">CRM Signature</label>
               {isReadOnly ? (
                 <div className="mt-1 border-b border-slate-900 h-6" />
               ) : (
                 <Input
                   className="mt-1 text-[10px] border-b border-slate-900 bg-transparent focus-visible:ring-0"
                   value={lafData.crmSignature}
                   placeholder=" "
                   onChange={e => setLafData({...lafData, crmSignature: e.target.value})}
                 />
               )}
             </div>
           </div>
           </div>

            <div className="p-4 border border-slate-200 bg-slate-50 rounded-lg">
               <h4 className="font-bold text-xs uppercase underline mb-2">13. Recommendation of the Credit and Risk Analyst(s)</h4>
               {!isReadOnly ? (
                 <>
                   <Textarea 
                     className="min-h-[120px] text-[10px] bg-white border-indigo-300" 
                     placeholder="Analyst: Enter your detailed analysis and recommendation here..."
                     value={lafData.analystRecommendation || ''}
                     onChange={e => setLafData({...lafData, analystRecommendation: e.target.value})}
                   />
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-[10px]">
                     <div>
                       <label className="block font-semibold text-[9px] uppercase">Analyst Name</label>
                       <Input
                         className="mt-1 text-[10px]"
                         value={lafData.analystName}
                         placeholder="Enter analyst name"
                         onChange={e => setLafData({...lafData, analystName: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="block font-semibold text-[9px] uppercase">Analyst Signature</label>
                       <Input
                         className="mt-1 text-[10px] border-b border-slate-900 bg-transparent focus-visible:ring-0"
                         value={lafData.analystSignature}
                         placeholder=" "
                         onChange={e => setLafData({...lafData, analystSignature: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="block font-semibold text-[9px] uppercase">Division Manager Name</label>
                       <Input
                         className="mt-1 text-[10px]"
                         value={lafData.divisionManagerName}
                         placeholder="Enter division manager name"
                         onChange={e => setLafData({...lafData, divisionManagerName: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="block font-semibold text-[9px] uppercase">Division Manager Signature</label>
                       <Input
                         className="mt-1 text-[10px] border-b border-slate-900 bg-transparent focus-visible:ring-0"
                         value={lafData.divisionManagerSignature}
                         placeholder=" "
                         onChange={e => setLafData({...lafData, divisionManagerSignature: e.target.value})}
                       />
                     </div>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="mt-2 p-2 bg-white/50 border rounded text-[10px] italic min-h-[60px]">
                     {lafData.analystRecommendation || (isOrder6 ? "Click 'Edit' to enter analysis recommendation." : "No analyst recommendation yet.")}
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-[10px]">
                     <div>
                       <div className="font-semibold text-[9px] uppercase">Analyst Name</div>
                       <div className="mt-1 min-h-[24px] border-b border-slate-900">{lafData.analystName || '\u00A0'}</div>
                     </div>
                     <div>
                       <div className="font-semibold text-[9px] uppercase">Analyst Signature</div>
                       <div className="mt-1 min-h-[24px] border-b border-slate-900">{lafData.analystSignature || '\u00A0'}</div>
                     </div>
                     <div>
                       <div className="font-semibold text-[9px] uppercase">Division Manager Name</div>
                       <div className="mt-1 min-h-[24px] border-b border-slate-900">{lafData.divisionManagerName || '\u00A0'}</div>
                     </div>
                     <div>
                       <div className="font-semibold text-[9px] uppercase">Division Manager Signature</div>
                       <div className="mt-1 min-h-[24px] border-b border-slate-900">{lafData.divisionManagerSignature || '\u00A0'}</div>
                     </div>
                   </div>
                 </>
               )}
            </div>

           {/* District Manager Review */}
           <div className="p-4 border border-slate-200 bg-slate-50 rounded-lg mt-4">
               <h4 className="font-bold text-xs uppercase underline mb-2">14. Recommendation of the Customer Relationship Manager/Consumer Loan Officer</h4>
               {!isReadOnly ? (
                 <>
                   <Textarea 
                     className="min-h-[80px] text-[10px] bg-white border-amber-300" 
                     placeholder="Enter recommendation by CRM or Consumer Loan Officer here..."
                     value={lafData.managerComments || ''}
                     onChange={e => setLafData({...lafData, managerComments: e.target.value})}
                   />
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-[10px]">
                     <div>
                       <label className="block font-semibold text-[9px] uppercase">CRM Name</label>
                       <Input
                         className="mt-1 text-[10px]"
                         value={lafData.recommendationByCrmName}
                         placeholder="Enter CRM name"
                         onChange={e => setLafData({...lafData, recommendationByCrmName: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="block font-semibold text-[9px] uppercase">CRM Signature</label>
                       <Input
                         className="mt-1 text-[10px] border-b border-slate-900 bg-transparent focus-visible:ring-0"
                         value={lafData.recommendationByCrmSignature}
                         placeholder=" "
                         onChange={e => setLafData({...lafData, recommendationByCrmSignature: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="block font-semibold text-[9px] uppercase">Loan Officer Name</label>
                       <Input
                         className="mt-1 text-[10px]"
                         value={lafData.recommendationByLoanOfficerName}
                         placeholder="Enter loan officer name"
                         onChange={e => setLafData({...lafData, recommendationByLoanOfficerName: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="block font-semibold text-[9px] uppercase">Loan Officer Signature</label>
                       <Input
                         className="mt-1 text-[10px] border-b border-slate-900 bg-transparent focus-visible:ring-0"
                         value={lafData.recommendationByLoanOfficerSignature}
                         placeholder=" "
                         onChange={e => setLafData({...lafData, recommendationByLoanOfficerSignature: e.target.value})}
                       />
                     </div>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="min-h-[40px] text-[10px] italic p-2 bg-white/50 border rounded">
                     {lafData.managerComments || (isOrder5 ? "Click 'Edit' to enter recommendation." : "No recommendation yet.")}
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-[10px]">
                     <div>
                       <div className="font-semibold text-[9px] uppercase">CRM Name</div>
                       <div className="mt-1 min-h-[24px] border-b border-slate-900">{lafData.recommendationByCrmName || '\u00A0'}</div>
                     </div>
                     <div>
                       <div className="font-semibold text-[9px] uppercase">CRM Signature</div>
                       <div className="mt-1 min-h-[24px] border-b border-slate-900">{lafData.recommendationByCrmSignature || '\u00A0'}</div>
                     </div>
                     <div>
                       <div className="font-semibold text-[9px] uppercase">Loan Officer Name</div>
                       <div className="mt-1 min-h-[24px] border-b border-slate-900">{lafData.recommendationByLoanOfficerName || '\u00A0'}</div>
                     </div>
                     <div>
                       <div className="font-semibold text-[9px] uppercase">Loan Officer Signature</div>
                       <div className="mt-1 min-h-[24px] border-b border-slate-900">{lafData.recommendationByLoanOfficerSignature || '\u00A0'}</div>
                     </div>
                   </div>
                 </>
               )}
            </div>

            <div className="p-4 border border-slate-200 bg-slate-50 rounded-lg mt-4">
                <h4 className="font-bold text-xs uppercase underline mb-2">15. Name of Credit Approving Team</h4>
                {!isReadOnly ? (
                  <Textarea 
                    className="min-h-[80px] text-[10px] bg-white border-green-300" 
                    placeholder="Enter name(s) of credit approving team here..."
                    value={lafData.creditApprovingTeam || ''}
                    onChange={e => setLafData({...lafData, creditApprovingTeam: e.target.value})}
                  />
                ) : (
                  <div className="min-h-[40px] text-[10px] italic p-2 bg-white/50 border rounded">
                    {lafData.creditApprovingTeam || (isOrder7 ? "Click 'Edit' to enter credit approving team." : "No credit approving team name yet.")}
                  </div>
                )}
            </div>

            <div className="p-4 border border-slate-200 bg-slate-50 rounded-lg mt-4">
                <h4 className="font-bold text-xs uppercase underline mb-2">16. Credit Decision of {lafData.creditDecisionDistrictName || 'WAAD'} (Give reason for declining or deviation)</h4>
                {!isReadOnly ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-[9px] uppercase font-semibold mb-1">District Name</label>
                      <Input
                        className="w-full text-[10px]"
                        placeholder="Enter district name (e.g. WAAD)"
                        value={lafData.creditDecisionDistrictName || ''}
                        onChange={e => setLafData({...lafData, creditDecisionDistrictName: e.target.value})}
                      />
                    </div>
                    <Textarea
                      className="min-h-[80px] text-[10px] bg-white border-green-300"
                      placeholder="Enter credit decision here..."
                      value={lafData.creditDecisionWaad || ''}
                      onChange={e => setLafData({...lafData, creditDecisionWaad: e.target.value})}
                    />
                  </>
                ) : (
                  <div className="min-h-[40px] text-[10px] italic p-2 bg-white/50 border rounded">
                    {lafData.creditDecisionWaad || (isOrder7 ? "Click 'Edit' to enter credit decision." : "No credit decision yet.")}
                  </div>
                )}
            </div>
        </div>

        {/* Approving Team Members */}
        <div className="avoid-page-break">
           <h4 className="font-bold text-xs uppercase underline mb-6">17. Approving Team members</h4>
           <div className="grid grid-cols-4 gap-4 text-center">
              {lafData.approvingTeamMembers.map((member: any, i: number) => (
                <div key={i} className="space-y-1">
                   <div className="font-bold italic underline mb-1 h-6 flex items-end justify-center">
                      {isReadOnly ? member.name : <Input className="h-5 text-center text-[9px]" placeholder="Name" value={member.name} onChange={e => {
                        const newList = [...lafData.approvingTeamMembers];
                        newList[i].name = e.target.value;
                        setLafData({...lafData, approvingTeamMembers: newList});
                      }} />}
                   </div>
                   <div className="text-[9px] font-bold">({member.role})</div>
                </div>
              ))}
           </div>
        </div>

        {/* 18. Refraining Ideas */}
        <div className="mt-6 avoid-page-break">
           <h4 className="font-bold text-xs uppercase underline mb-2">18. Refraining Ideas of an Approving Team Member, if any (attach a separate paper if necessary)</h4>
           {isReadOnly ? (
             <div className="rounded border border-slate-300 bg-slate-50 p-3 text-[10px] italic">
               <div className="min-h-[50px]">{lafData.refrainingIdeas || 'No refraining ideas provided.'}</div>
             </div>
           ) : (
             <Textarea
               className="min-h-[80px] text-[10px] bg-white border-slate-300"
               placeholder="Enter any refraining ideas here..."
               value={lafData.refrainingIdeas}
               onChange={e => setLafData({...lafData, refrainingIdeas: e.target.value})}
             />
           )}
           <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[10px]">
             <div>
               <div className="font-semibold uppercase text-[9px]">Name</div>
               {!isReadOnly ? (
                 <Input
                   className="mt-1 text-[10px] border-b border-slate-900 bg-transparent focus-visible:ring-0"
                   value={lafData.refrainingIdeasName}
                   placeholder=" "
                   onChange={e => setLafData({...lafData, refrainingIdeasName: e.target.value})}
                 />
               ) : (
                 <div className="mt-1 h-6 border-b border-slate-900" />
               )}
             </div>
             <div>
               <div className="font-semibold uppercase text-[9px]">Signature</div>
               {!isReadOnly ? (
                 <Input
                   className="mt-1 text-[10px] border-b border-slate-900 bg-transparent focus-visible:ring-0"
                   value={lafData.refrainingIdeasSignature}
                   placeholder=" "
                   onChange={e => setLafData({...lafData, refrainingIdeasSignature: e.target.value})}
                 />
               ) : (
                 <div className="mt-1 h-6 border-b border-slate-900" />
               )}
             </div>
           </div>
        </div>

        {/* Footer */}
        <div className="mt-12 flex justify-between text-[8px] text-muted-foreground border-t pt-1 italic uppercase font-sans avoid-page-break">
           <span>{lafData.lafNo}</span>
           <span>NIB INTERNATIONAL BANK - Internal Document</span>
           <span className="print-page-number">Page</span>
        </div>
        </div>

      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
        .avoid-page-break {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        #pdf-content {
          font-family: 'Libre Baskerville', serif;
        }
        @media print {
          .print\:hidden { display: none !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            width: 210mm;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            color: black !important;
            font-family: Arial, sans-serif;
            counter-reset: page;
          }
          @page {
            margin: 15mm;
            size: A4;
            padding: 0;
          }
          #pdf-content {
            box-shadow: none !important;
            padding: 0 !important;
            border: none !important;
            margin: 0 !important;
            width: 100%;
            max-width: 100%;
          }
          .avoid-page-break,
          .pdf-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          table, tr, thead, tbody {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          header, footer {
            display: none !important;
          }
          .print-page-number::after {
            content: " " counter(page);
          }
        }
      `}</style>
    </div>
  );
}
