
import { getPublicLoanStatusByLoanNumber } from '@/services/loan-service-prisma';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PublicLoanStatusStepper } from '@/components/PublicLoanStatusStepper';
import Image from 'next/image';

interface PublicLoanStatusPageProps {
  params: { id: string };
}

export default async function PublicLoanStatusPage({ params }: PublicLoanStatusPageProps) {
  const loanNumber = params.id;
  const result = await getPublicLoanStatusByLoanNumber(loanNumber);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
                 <Image
                    src="https://play-lh.googleusercontent.com/HR87m6M2_7ZmPGrSp_MSlmfG5uyx94iYthItSzrmWVgFWkJ3FPTOYCLPw0F_ul4mYg"
                    alt="LoanFlow Logo"
                    width={40}
                    height={40}
                    className="h-10 w-10"
                />
                <div>
                    <h1 className="text-2xl font-bold text-primary">Loan Status Tracker</h1>
                    <p className="text-muted-foreground">Real-time progress for your application.</p>
                </div>
            </div>
            <Link href="/track-loan" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Search Another Loan</Button>
            </Link>
        </header>

        {result.error || !result.data ? (
          <Card className="text-center border-destructive">
            <CardHeader>
                <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-2"/>
                <CardTitle className="text-destructive">Loan Not Found</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    {result.error || `Loan reference "${loanNumber}" not found. Please check your ID and try again.`}
                </p>
            </CardContent>
          </Card>
        ) : (
          <PublicLoanStatusStepper loanData={result.data} />
        )}
      </div>
    </div>
  );
}
