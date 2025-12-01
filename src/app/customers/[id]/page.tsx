
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getCustomerById } from '@/services/loan-service-prisma';
import type { Customer } from '@/types/loan';
import { Loader2, User, ArrowLeft, ExternalLink, Mail, Phone, Building, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';

// A version of Customer type for this page that includes the full loan request objects
interface CustomerWithFullLoanDetails extends Omit<Customer, 'loanRequests'> {
  loanRequests: Customer['loanRequests'];
}


export default function CustomerProfilePage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();

  const [customer, setCustomer] = useState<CustomerWithFullLoanDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const canViewProfile = user?.permissions.includes(PERMISSIONS.VIEW_CUSTOMERS);


  useEffect(() => {
    if (authLoading || !canViewProfile) {
        if (!authLoading && !canViewProfile) setIsLoading(false);
        return;
    }

    if (!customerId) {
      setError("Customer ID is missing from the URL.");
      setIsLoading(false);
      return;
    }

    async function fetchCustomer() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getCustomerById(customerId);
        if (result.error) {
          setError(result.error);
        } else {
          setCustomer(result.customer as CustomerWithFullLoanDetails | null);
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomer();
  }, [customerId, authLoading, canViewProfile]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading customer profile...</p>
      </div>
    );
  }
  
  if (!canViewProfile) {
     return (
       <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view customer profiles.</p>
            <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4"/>Go Back</Button>
        </div>
    );
  }
  
  if (error) {
     return (
       <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Error Loading Profile</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link href="/customers" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Customers List</Button>
            </Link>
        </div>
    );
  }

  if (!customer) {
    return (
       <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Customer Not Found</h1>
            <p className="text-muted-foreground mb-6">The customer profile could not be found.</p>
             <Link href="/customers" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Customers List</Button>
            </Link>
        </div>
    )
  }

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <User className="mr-3 h-8 w-8 text-primary" />
            {customer.name}
          </h1>
          <p className="text-muted-foreground">
            Customer Profile and Loan History
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Link href="/customers" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to List</Button>
            </Link>
            <Link href="/loan-requests/new" passHref>
              <Button>New Loan for Customer</Button>
            </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-muted-foreground"/>
                <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{customer.email}</p>
                </div>
            </div>
             <div className="flex items-center gap-3">
                <Phone className="h-6 w-6 text-muted-foreground"/>
                <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{customer.phone || 'N/A'}</p>
                </div>
            </div>
             <div className="flex items-center gap-3">
                <Building className="h-6 w-6 text-muted-foreground"/>
                <div>
                    <p className="text-sm text-muted-foreground">Branch</p>
                    <p className="font-medium">{customer.branch || 'N/A'}</p>
                </div>
            </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Loan Requests ({customer.loanRequests.length})</CardTitle>
          <CardDescription>
            A list of all loan requests associated with this customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan Number</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Submitted On</TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.loanRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No loan requests found for this customer.
                  </TableCell>
                </TableRow>
              ) : (
                customer.loanRequests.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.loanNumber}</TableCell>
                    <TableCell>{loan.loanAmount.toLocaleString()} ETB</TableCell>
                    <TableCell>{format(parseISO(loan.submittedDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell><Badge variant="secondary">{loan.currentStageName}</Badge></TableCell>
                    <TableCell className="text-right">
                       <Link href={`/loan-requests/${loan.id}`} passHref>
                            <Button variant="ghost" size="sm">View Loan <ExternalLink className="ml-2 h-3 w-3" /></Button>
                       </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
