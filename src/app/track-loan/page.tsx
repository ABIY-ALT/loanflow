
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function TrackLoanSearchPage() {
  const router = useRouter();
  const [loanId, setLoanId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId.trim()) return;

    setIsSubmitting(true);
    router.push(`/track-loan/${loanId.trim()}`);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
           <Image
            src="https://play-lh.googleusercontent.com/HR87m6M2_7ZmPGrSp_MSlmfG5uyx94iYthItSzrmWVgFWkJ3FPTOYCLPw0F_ul4mYg"
            alt="LoanFlow Logo"
            width={48}
            height={48}
            className="mx-auto h-12 w-12 text-primary mb-4"
          />
          <CardTitle className="text-3xl font-bold">Track Your Loan</CardTitle>
          <CardDescription>Enter your Loan ID to see the current status and workflow progress.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="loanId">Loan ID / Loan Number</Label>
              <Input
                id="loanId"
                placeholder="e.g., LN-PSQL-123456"
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
                required
                disabled={isSubmitting}
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-3" disabled={isSubmitting || !loanId.trim()}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Search className="mr-2 h-5 w-5" />
              )}
              Track Loan
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
