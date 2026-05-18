
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, FileText, CheckCircle } from 'lucide-react';
import type { LoanRequest } from '@/types/loan';
import { format } from 'date-fns';

interface LoanAnalysisWorkProps {
  loan: LoanRequest;
  isSaving: boolean;
  onSaveAnalysis: (notes: string) => Promise<void>;
}

export function LoanAnalysisWork({ loan, isSaving, onSaveAnalysis }: LoanAnalysisWorkProps) {
  const [analysisNotes, setAnalysisNotes] = useState('');

  const handleSubmit = async () => {
    if (!analysisNotes.trim()) return;
    await onSaveAnalysis(analysisNotes);
    setAnalysisNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>LAF Status</CardDescription>
            <CardTitle className="text-lg">{loan.lafStatus || 'PENDING'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valuation</CardDescription>
            <CardTitle className="text-lg">
              {loan.isValuationCompleted ? (
                <span className="text-green-600 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" /> COMPLETED
                </span>
              ) : (
                'PENDING'
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Loan Amount</CardDescription>
            <CardTitle className="text-lg">{loan.loanAmount.toLocaleString()} ETB</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Analyst Findings & Recommendation
          </CardTitle>
          <CardDescription>
            Provide your final analysis and recommendation for the District Committee.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter your detailed analysis and recommendation here..."
            className="min-h-[200px] text-base leading-relaxed"
            value={analysisNotes}
            onChange={(e) => setAnalysisNotes(e.target.value)}
            disabled={isSaving}
          />
          <div className="flex justify-end">
            <Button 
              onClick={handleSubmit} 
              disabled={isSaving || !analysisNotes.trim()}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit to Committee
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Show previous analysis if available in history or somewhere */}
      <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Recent Analysis History</h3>
          <div className="space-y-4">
              {loan.history.filter(h => h.stageName === "Analyst Review" || h.notes?.includes("Analysis completed")).map(h => (
                  <div key={h.id} className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{h.userName}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(h.timestamp), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{h.notes}</p>
                  </div>
              ))}
              {loan.history.filter(h => h.stageName === "Analyst Review" || h.notes?.includes("Analysis completed")).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No prior analysis records found for this case.</p>
              )}
          </div>
      </div>
    </div>
  );
}
