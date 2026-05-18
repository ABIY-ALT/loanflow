
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, MapPin, ArrowRight, Wallet, Network } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { AlertCircle } from 'lucide-react';

export default function NewLoanSelectionPage() {
  const { user, isLoading } = useAuth();
  const canCreateRequest = user?.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST);

  if (isLoading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!canCreateRequest) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to create new loan requests.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">Submit New Loan Request</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Select the submission channel to begin the application process. Choose Head Office for standard workflows or District for parallel processing.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 pt-8">
        {/* Head Office Option */}
        <Link href="/loan-requests/head-office" className="group">
          <Card className="h-full border-2 transition-all duration-300 hover:border-primary hover:shadow-xl relative overflow-hidden group-hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <Building size={120} />
            </div>
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Head Office Submission</CardTitle>
              <CardDescription className="text-base">
                Standard loan application workflow managed by the Head Office departments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-primary" /> Sequential multi-stage workflow</li>
                <li className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-primary" /> Department-specific review stages</li>
                <li className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-primary" /> Comprehensive analysis pipeline</li>
              </ul>
              <Button className="w-full group-hover:bg-primary" variant="outline">
                Begin Head Office Submission <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        {/* District Option */}
        <Link href="/loan-requests/district" className="group">
          <Card className="h-full border-2 transition-all duration-300 hover:border-blue-600 hover:shadow-xl relative overflow-hidden group-hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <MapPin size={120} className="text-blue-600" />
            </div>
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-blue-600">District Submission</CardTitle>
              <CardDescription className="text-base">
                Fast-track district workflow with parallel LAF generation and Valuation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-blue-600" /> Parallel Valuation and LAF processing</li>
                <li className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-blue-600" /> District Committee approval flow</li>
                <li className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-blue-600" /> Optimized for faster branch resolution</li>
              </ul>
              <Button className="w-full hover:bg-blue-600 hover:text-white transition-colors" variant="outline">
                Begin District Submission <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="bg-muted/30 rounded-xl p-8 flex flex-col md:flex-row items-center gap-6 border border-dashed border-muted-foreground/30">
        <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shrink-0 shadow-sm">
            <Network className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1 text-center md:text-left">
            <h3 className="font-semibold text-lg">Need help choosing?</h3>
            <p className="text-sm text-muted-foreground">
                Head Office submissions are typically used for large corporate loans and specialized products, while District submissions are designed for standard retail and SME loans within branch limits.
            </p>
        </div>
      </div>
    </div>
  );
}
