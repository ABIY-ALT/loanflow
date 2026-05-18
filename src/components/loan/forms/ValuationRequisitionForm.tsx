'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoanRequest } from '@/types/loan';
import { Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const pvrFormSchema = z.object({
  dateOfRequest: z.string().min(1, 'Date of request is required'),
  requestType: z.string().min(1, 'Request type is required'),
  branch: z.string().min(1, 'Branch is required'),
  requiredEngineer: z.string().min(1, 'Required engineer type is required'),
  applicantName: z.string().min(1, 'Applicant name is required'),
  properties: z.array(z.object({
    type: z.string(),
    use: z.string(),
    no: z.string(),
    tenure: z.string(),
    address: z.string(),
    status: z.string(),
    requiredDocuments: z.string(),
  })),
  documentsAttached: z.array(z.object({
    name: z.string(),
    isAttached: z.boolean(),
    originalOrCopy: z.string(),
    quantity: z.string(),
    remark: z.string(),
  })),
  remark: z.string().optional(),
});

type PvrFormValues = z.infer<typeof pvrFormSchema>;

interface ValuationRequisitionFormProps {
  loan: LoanRequest;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
  isReadOnly?: boolean;
}

export function ValuationRequisitionForm({ loan, onSave, isSaving, isReadOnly = false }: ValuationRequisitionFormProps) {
  const { toast } = useToast();
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  const form = useForm<PvrFormValues>({
    resolver: zodResolver(pvrFormSchema),
    defaultValues: {
      dateOfRequest: loan.pvrData?.dateOfRequest || new Date().toISOString().split('T')[0],
      requestType: loan.pvrData?.requestType || (Number(loan.loanAmount) > 20000000 ? 'Greater than 20Mil' : 'Less than 20Mil'),
      branch: loan.pvrData?.branch || loan.customerBranch || '',
      requiredEngineer: loan.pvrData?.requiredEngineer || 'CIVIL ENGINEER',
      applicantName: loan.pvrData?.applicantName || loan.customerName || '',
      properties: loan.pvrData?.properties || [
        { type: 'Commercial Bldg', use: 'Resi', no: '1', tenure: 'Leasehold', address: '', status: 'Completed', requiredDocuments: '' },
        { type: '', use: '', no: '', tenure: '', address: '', status: '', requiredDocuments: '' },
      ],
      documentsAttached: loan.pvrData?.documentsAttached || [
        { name: 'Estimation Fee Receipt', isAttached: true, originalOrCopy: 'Copy', quantity: '1', remark: '' },
        { name: 'Certified Copy of Title Deed', isAttached: true, originalOrCopy: 'Copy', quantity: '1', remark: '' },
        { name: 'Approved Site Plan', isAttached: false, originalOrCopy: '', quantity: '', remark: '' },
        { name: 'Location Map', isAttached: false, originalOrCopy: '', quantity: '', remark: '' },
      ],
      remark: loan.pvrData?.remark || '',
    },
  });

  const handleSubmit = async (values: PvrFormValues, isFinalize = false) => {
    try {
      if (isFinalize) setIsFinalizing(true);
      await onSave({
        pvrData: values,
        lafStatus: isFinalize ? 'EXPORTED' : 'PENDING',
        _isFinalizeAction: isFinalize
      });
      toast({
        title: isFinalize ? "PVR Finalized" : "PVR Draft Saved",
        description: isFinalize ? "Case has been sent to Valuation Department." : "Draft saved successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 shadow-xl overflow-hidden bg-amber-50/10">
      <CardHeader className="bg-primary/5 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-full">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">Property Valuation Requisition</CardTitle>
            <CardDescription className="text-base font-medium">To: Property Valuation Department</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((vals) => handleSubmit(vals, false))} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <FormField
                control={form.control}
                name="dateOfRequest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date of Request</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="h-12 text-lg border-2" disabled={isReadOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requestType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Request Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-lg border-2 focus:ring-primary">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Less than 20Mil">Less than 20 Million ETB</SelectItem>
                        <SelectItem value="Greater than 20Mil">Greater than 20 Million ETB</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="branch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Requested By (Branch)</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-12 text-lg border-2 font-semibold" disabled={isReadOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="requiredEngineer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3. Required Engineer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-lg border-2">
                          <SelectValue placeholder="Select engineer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CIVIL ENGINEER">CIVIL ENGINEER</SelectItem>
                        <SelectItem value="MECHANICAL ENGINEER">MECHANICAL ENGINEER</SelectItem>
                        <SelectItem value="ELECTRICAL ENGINEER">ELECTRICAL ENGINEER</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="applicantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">4. Applicant's Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-12 text-lg border-2 font-semibold" disabled={isReadOnly} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-2">5. Property Details</h3>
              <div className="rounded-lg border-2 overflow-hidden bg-background">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold py-4">Type of Property</TableHead>
                      <TableHead className="font-bold py-4">Valuation Use</TableHead>
                      <TableHead className="font-bold py-4">No. of Units</TableHead>
                      <TableHead className="font-bold py-4">Tenure/Ownership</TableHead>
                      <TableHead className="font-bold py-4">Specific Address</TableHead>
                      <TableHead className="font-bold py-4">Status</TableHead>
                      <TableHead className="font-bold py-4">Required Documents</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.getValues('properties').map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Input className="border-none shadow-none focus-visible:ring-1" placeholder="e.g. Building" {...form.register(`properties.${index}.type`)} disabled={isReadOnly} /></TableCell>
                        <TableCell><Input className="border-none shadow-none focus-visible:ring-1" placeholder="e.g. Residential" {...form.register(`properties.${index}.use`)} disabled={isReadOnly} /></TableCell>
                        <TableCell><Input className="border-none shadow-none focus-visible:ring-1" placeholder="1" {...form.register(`properties.${index}.no`)} disabled={isReadOnly} /></TableCell>
                        <TableCell><Input className="border-none shadow-none focus-visible:ring-1" placeholder="Leasehold" {...form.register(`properties.${index}.tenure`)} disabled={isReadOnly} /></TableCell>
                        <TableCell><Input className="border-none shadow-none focus-visible:ring-1" placeholder="House No..." {...form.register(`properties.${index}.address`)} disabled={isReadOnly} /></TableCell>
                        <TableCell><Input className="border-none shadow-none focus-visible:ring-1" placeholder="Completed" {...form.register(`properties.${index}.status`)} disabled={isReadOnly} /></TableCell>
                        <TableCell><Input className="border-none shadow-none focus-visible:ring-1" placeholder="..." {...form.register(`properties.${index}.requiredDocuments`)} disabled={isReadOnly} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b pb-2">6. Required Documents Attached</h3>
              <div className="rounded-lg border-2 overflow-hidden bg-background">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold py-4 w-12">Attached</TableHead>
                      <TableHead className="font-bold py-4">Document Name</TableHead>
                      <TableHead className="font-bold py-4">Original or Copy</TableHead>
                      <TableHead className="font-bold py-4 text-center w-20">Quantity</TableHead>
                      <TableHead className="font-bold py-4">Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.getValues('documentsAttached').map((_, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={form.watch(`documentsAttached.${index}.isAttached`)}
                            onCheckedChange={(checked) => form.setValue(`documentsAttached.${index}.isAttached`, !!checked)}
                            disabled={isReadOnly}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{form.getValues(`documentsAttached.${index}.name`)}</TableCell>
                        <TableCell><Input className="h-8 border-none shadow-none focus-visible:ring-1" {...form.register(`documentsAttached.${index}.originalOrCopy`)} disabled={isReadOnly} /></TableCell>
                        <TableCell><Input className="h-8 border-none shadow-none focus-visible:ring-1 text-center" {...form.register(`documentsAttached.${index}.quantity`)} disabled={isReadOnly} /></TableCell>
                        <TableCell><Input className="h-8 border-none shadow-none focus-visible:ring-1" {...form.register(`documentsAttached.${index}.remark`)} disabled={isReadOnly} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <FormField
              control={form.control}
              name="remark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">7. Remarks</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-12 border-2" placeholder="Any additional notes for the valuation department..." disabled={isReadOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="py-10 border-t-2 border-dashed mt-10">
              <div className="bg-muted/30 p-8 rounded-2xl border-2 border-dashed border-muted flex flex-col items-center text-center">
                <h3 className="text-xl font-bold text-muted-foreground uppercase tracking-widest mb-2">For the use of Property Valuation Department (PART II)</h3>
                <p className="text-sm text-muted-foreground/60 max-w-md italic">This section is reserved for the Property Valuation Department at Head Office. They will fill in site inspection dates, assigned engineers, and valuation details once the requisition is submitted.</p>
              </div>
            </div>

            {!isReadOnly && (
              <div className="pt-8 border-t flex justify-end gap-4">
                <Button type="button" variant="outline" className="px-10 h-14 text-lg font-bold" onClick={() => form.reset()} disabled={isSaving || isFinalizing}>Reset Form</Button>
                <Button 
                  type="button" 
                  variant="secondary" 
                  className="px-8 h-14 text-lg font-bold" 
                  onClick={() => form.handleSubmit((vals) => handleSubmit(vals, false))()} 
                  disabled={isSaving || isFinalizing}
                >
                  {isSaving && !isFinalizing && <Loader2 className="mr-2 h-6 w-6 animate-spin" />}
                  Save Draft
                </Button>
                <Button 
                  type="button" 
                  className="px-12 h-14 text-lg font-bold shadow-lg shadow-primary/20 bg-emerald-600 hover:bg-emerald-700" 
                  onClick={() => form.handleSubmit((vals) => handleSubmit(vals, true))()} 
                  disabled={isSaving || isFinalizing}
                >
                  {isFinalizing && <Loader2 className="mr-2 h-6 w-6 animate-spin" />}
                  Finalize & Send to Valuation
                </Button>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
