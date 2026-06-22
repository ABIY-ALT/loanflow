'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Printer, Save, ArrowLeft, Building2, Edit, AlertCircle, FileDown } from 'lucide-react';
import { getLoanRequestById, updateCustomerSummary } from '@/services/loan-service-prisma';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { exportElementToPDF } from '@/lib/pdf-export';
import { NIB_LOGO_SRC } from '@/lib/brand';

const ADDRESS_FIELDS: { key: string; label: string }[][] = [
  [
    { key: 'region', label: 'Region' },
    { key: 'town', label: 'Town' },
    { key: 'subCity', label: 'SubCity' },
    { key: 'kebele', label: 'Kebele' },
  ],
  [
    { key: 'hNo', label: 'HNo' },
    { key: 'tel', label: 'Tel' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'poBox', label: 'PoBox' },
  ],
  [
    { key: 'fax', label: 'Fax' },
    { key: 'email', label: 'Email' },
    { key: 'website', label: 'Website' },
  ],
];

export default function CustomerSummaryPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loan, setLoan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [summaryData, setSummaryData] = useState<any>({
    companyName: '',
    generalManager: '',
    formOfBusiness: {
        partnership: false,
        shareCompany: false,
        cooperative: false,
        privateLimited: false,
        jointVenture: false,
        others: false,
        othersDetail: ''
    },
    paidUpCapital: '',
    shareholders: [{ name: '', address: '', position: '', holdings: '', share: '' }],
    typeOfBusiness: '',
    yearOfEstablishment: '',
    tradeLicenseNo: '',
    yearOfRenewal: '',
    tin: '',
    address: {
        region: '', town: '', subCity: '', kebele: '', hNo: '', tel: '', mobile: '', poBox: '', fax: '', email: '', website: ''
    },
    creditRequested: [{ type: '', amount: '', period: '', installmentAmount: '', installmentPeriod: '' }],
    collateralOffered: [{ owner: '', type: '', value: '', titleDeed: '', address: '' }],
    bankingRelationship: {
        depositor: false, borrower: false, mortgagor: false, others: false, othersDetail: ''
    },
    outstandingBalance: ''
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
          if (result.loan?.customerSummaryData) {
            setSummaryData(result.loan.customerSummaryData);
          } else {
            // Pre-fill some data from loan request
            setSummaryData((prev: any) => ({
              ...prev,
              companyName: result.loan?.customerName || '',
              typeOfBusiness: result.loan?.sectorName || '',
              tin: result.loan?.lafData?.tin || '',
              address: { ...prev.address, email: result.loan?.customerEmail || '', mobile: result.loan?.customerPhone || '' }
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
      const result = await updateCustomerSummary(id as string, summaryData);
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Customer Summary updated successfully." });
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
    toast({ title: "Generating PDF", description: "Preparing Customer Summary document..." });

    try {
      await exportElementToPDF('pdf-content', `CAFC-${loan.loanNumber || 'Export'}.pdf`);
      toast({ title: "Success", description: "Customer Summary exported successfully." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    toast({
      title: "Generating PDF",
      description: "Please select 'Save as PDF' as the Destination in the print dialog.",
    });
    setTimeout(() => window.print(), 500);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  const isOrder4 = loan?.currentStageOrder === 4;
  const isOrder5 = loan?.currentStageOrder === 5;
  const isReadOnlyAtStage = (loan?.currentStageOrder > 4); 
  const isReadOnly = !isEditing || isReadOnlyAtStage;

  return (
    <div className="print:p-0">
      <div className="flex justify-between items-center mb-8 print:hidden p-8">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-3xl font-bold">Customer Summary (CAFC)</h1>
            <p className="text-muted-foreground truncate max-w-md">Credit Application Form for {loan?.customerName}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          {isOrder4 && !isReadOnlyAtStage && !isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Summary
            </Button>
          )}
          {isEditing && (
            <Button variant="outline" className="bg-amber-50 text-amber-700 border-amber-200" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExportPDF} disabled={isExporting} className="print:hidden bg-blue-600 hover:bg-blue-700">
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            {isExporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      {isReadOnlyAtStage && (
        <Alert className="mb-6 bg-slate-50 border-slate-200">
          <AlertCircle className="h-4 w-4 text-slate-600" />
          <AlertTitle>Read-Only Mode</AlertTitle>
          <AlertDescription>
            This summary has been submitted and forwarded to the Valuation department. It is now in read-only mode.
          </AlertDescription>
        </Alert>
      )}

      <Card id="pdf-content" className="print:shadow-none print:border-none print:m-0 print:rounded-none max-w-5xl mx-auto">
        <CardContent className="p-12 space-y-8 print:p-5">
          <div className="pdf-section space-y-8">
          {/* Header Section */}
          <div className="flex justify-between items-start border-b-2 border-black pb-6 avoid-page-break">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={NIB_LOGO_SRC}
                alt="NIB International Bank"
                width={64}
                height={64}
                className="h-16 w-16 flex-shrink-0 object-contain"
              />
              <div className="space-y-1">
                <h2 className="text-xl font-bold">NIB INTERNATIONAL BANK S.C.</h2>
                <h3 className="text-lg font-bold border-b border-black">CREDIT APPLICATION FORM FOR COMPANIES (CAFC)</h3>
              </div>
            </div>
            <div className="text-right space-y-4">
                <div className="border-2 border-black p-2 w-32 h-32 flex flex-col items-center justify-center text-[10px] text-center">
                    Photograph of General Manager
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-bold">Date:</span>
                    <span className="border-b border-black w-32">{new Date().toLocaleDateString()}</span>
                </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            <div className="flex gap-4 items-center">
              <span className="font-bold min-w-[180px]">1. Name of the Company(s)</span>
              <Input className="border-0 border-b border-black rounded-none h-8 print:border-b" value={summaryData.companyName} onChange={e => setSummaryData({...summaryData, companyName: e.target.value})} disabled={isReadOnly} />
            </div>

            <div className="flex gap-4 items-center">
              <span className="font-bold min-w-[180px]">2. Full name of the GM</span>
              <Input className="border-0 border-b border-black rounded-none h-8 print:border-b" value={summaryData.generalManager} onChange={e => setSummaryData({...summaryData, generalManager: e.target.value})} disabled={isReadOnly} />
            </div>

            <div className="space-y-2">
              <span className="font-bold">3. Form of Business:</span>
              <div className="grid grid-cols-2 gap-4 pl-6">
                {Object.entries(summaryData.formOfBusiness).filter(([k]) => k !== 'othersDetail').map(([key, val]: [string, any]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox id={key} checked={val} onCheckedChange={(checked) => setSummaryData({...summaryData, formOfBusiness: {...summaryData.formOfBusiness, [key]: checked}})} disabled={isReadOnly} />
                    <label htmlFor={key} className="text-sm font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <span className="font-bold min-w-[180px]">4. Paid up capital</span>
              <Input className="border-0 border-b border-black rounded-none h-8 print:border-b" value={summaryData.paidUpCapital} onChange={e => setSummaryData({...summaryData, paidUpCapital: e.target.value})} disabled={isReadOnly} />
            </div>

            {/* Shareholders Table */}
            <div className="space-y-2">
              <span className="text-sm italic pl-6">Name of shareholders, their position, address and respective shares:</span>
              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-black p-1 w-10">No.</th>
                    <th className="border border-black p-1">Name</th>
                    <th className="border border-black p-1">Address</th>
                    <th className="border border-black p-1">Position in Business</th>
                    <th className="border border-black p-1">Share Holdings (Birr)</th>
                    <th className="border border-black p-1">% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i}</td>
                      <td className="border border-black p-0"><Input className="border-0 rounded-none h-6 text-[10px]" disabled={isReadOnly} /></td>
                      <td className="border border-black p-0"><Input className="border-0 rounded-none h-6 text-[10px]" disabled={isReadOnly} /></td>
                      <td className="border border-black p-0"><Input className="border-0 rounded-none h-6 text-[10px]" disabled={isReadOnly} /></td>
                      <td className="border border-black p-0"><Input className="border-0 rounded-none h-6 text-[10px]" disabled={isReadOnly} /></td>
                      <td className="border border-black p-0"><Input className="border-0 rounded-none h-6 text-[10px]" disabled={isReadOnly} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
               <div className="flex gap-2 items-center">
                 <span className="font-bold text-sm">5. Type of Business</span>
                 <Input className="border-0 border-b border-black rounded-none h-6 text-sm" value={summaryData.typeOfBusiness} disabled={isReadOnly} />
               </div>
               <div className="flex gap-2 items-center">
                 <span className="font-bold text-sm">6. Year of establishment</span>
                 <Input className="border-0 border-b border-black rounded-none h-6 text-sm" disabled={isReadOnly} />
               </div>
               <div className="flex gap-2 items-center">
                 <span className="font-bold text-sm">7. Trade license No.</span>
                 <Input className="border-0 border-b border-black rounded-none h-6 text-sm" disabled={isReadOnly} />
               </div>
               <div className="flex gap-2 items-center">
                 <span className="font-bold text-sm">8. Year of renewal</span>
                 <Input className="border-0 border-b border-black rounded-none h-6 text-sm" disabled={isReadOnly} />
               </div>
            </div>

            <div className="flex gap-4 items-center">
              <span className="font-bold">9. Tax Identification Number (TIN)</span>
              <Input className="border-0 border-b border-black rounded-none h-8 w-64" value={summaryData.tin} disabled={isReadOnly} />
              <Input className="border-0 border-b border-black rounded-none h-8 w-64" value={summaryData.tin} disabled={isReadOnly} />
            </div>

            <div className="space-y-4 avoid-page-break">
               <span className="font-bold">10. Address:</span>
               <div className="space-y-4 pl-6 text-xs">
                  {ADDRESS_FIELDS.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-4 gap-4 avoid-page-break">
                      {row.map(({ key, label }) => (
                        <div key={key} className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold">{label}</label>
                          <Input
                            className="border-0 border-b border-black rounded-none h-6 p-0"
                            value={summaryData.address[key] ?? ''}
                            onChange={e => setSummaryData({...summaryData, address: {...summaryData.address, [key]: e.target.value}})}
                            disabled={isReadOnly}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
               </div>
            </div>
          </div>
          </div>

          <div className="pdf-section">
          {/* Signatures */}
          <div className="mt-12 space-y-8 avoid-page-break">
            <div className="flex flex-col items-center">
               <div className="w-64 border-b border-black h-8"></div>
               <span className="text-sm font-bold mt-2">Name of General Manager of the Company</span>
            </div>
            <div className="flex flex-col items-center">
               <div className="w-64 border-b border-black h-8"></div>
               <span className="text-sm font-bold mt-2">Signature</span>
            </div>
          </div>
          </div>
        </CardContent>
      </Card>
      
      <style jsx global>{`
        .avoid-page-break {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        @media print {
          .print\:hidden {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            width: 210mm;
            height: 297mm;
            background-color: white !important;
            padding: 0 !important;
            margin: 0 !important;
            color: black !important;
            font-family: Arial, sans-serif;
          }
          @page {
            margin: 15mm;
            size: A4;
            padding: 0;
          }
          #pdf-content {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
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
          .Card {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          /* Hide browser headers/footers */
          header, footer {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
