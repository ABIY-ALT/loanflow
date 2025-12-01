

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { useState } from 'react';
import { Loader2, Search, ListChecks, AlertCircle, ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { searchLoanRequests } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/contexts/auth-context';

export const loanStatusSchema = z.object({
  searchTerm: z.string().min(1, { message: "Please enter a search term." }),
  searchType: z.enum(['loanNumber', 'customerName', 'customerNumber']),
});

type LoanStatusFormValues = z.infer<typeof loanStatusSchema>;

export default function LoanStatusPage() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LoanRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canViewLookup = user?.permissions.includes(PERMISSIONS.VIEW_LOAN_STATUS_LOOKUP);
  const canViewDetails = user?.permissions.includes(PERMISSIONS.VIEW_LOAN_DETAILS);

  const form = useForm<LoanStatusFormValues>({
    resolver: zodResolver(loanStatusSchema),
    defaultValues: {
      searchTerm: '',
      searchType: 'loanNumber',
    },
  });

  async function onSubmit(data: LoanStatusFormValues) {
    if (!canViewLookup) return;
    setIsLoading(true);
    setLookupResult(null);
    setError(null);

    try {
      const result = await searchLoanRequests(data.searchTerm, data.searchType);

      if (result.error) {
        throw new Error(result.error);
      }

      setLookupResult(result.loans || []);
      toast({
        title: "Search Complete",
        description: `Found ${result.loans?.length || 0} matching loan(s).`,
      });
    } catch (err: any) {
      console.error("Loan status lookup error:", err);
      const errorMessage = err.message || "An unexpected error occurred during search.";
      setError(errorMessage);
      toast({
        title: "Search Failed",
        description: `Error: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  if (authLoading) {
     return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!canViewLookup) {
     return (
       <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to use the loan status lookup.</p>
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loan Status Lookup</h1>
        <p className="text-muted-foreground">
          Search for loans using Loan Number, Customer Name, or Customer Code.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Enter Search Criteria</CardTitle>
          <CardDescription>Provide a search term and select the identifier type.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="searchTerm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search Term</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="e.g., LN00001, John Doe, CUST001" {...field} className="pl-10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="searchType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Identifier Type</FormLabel>
                      <FormControl>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            type="button"
                            variant={field.value === 'loanNumber' ? 'default' : 'outline'}
                            onClick={() => field.onChange('loanNumber')}
                            className="flex-1"
                          >
                            Loan Number
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === 'customerName' ? 'default' : 'outline'}
                            onClick={() => field.onChange('customerName')}
                            className="flex-1"
                          >
                            Customer Name
                          </Button>
                           <Button
                            type="button"
                            variant={field.value === 'customerNumber' ? 'default' : 'outline'}
                            onClick={() => field.onChange('customerNumber')}
                            className="flex-1"
                          >
                            Customer Code
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search Loans
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-lg">Searching...</p>
        </div>
      )}

      {error && !isLoading && (
        <Card className="border-destructive">
             <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Search Error
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>{error}</p>
            </CardContent>
        </Card>
      )}

      {lookupResult && !isLoading && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <ListChecks className="mr-2 h-6 w-6 text-primary" />
              Search Results ({lookupResult.length})
            </CardTitle>
            <CardDescription>
              Displaying loans matching: "{form.getValues('searchTerm')}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lookupResult.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                  <p>No loans found matching your criteria.</p>
              </div>
            ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Submitted On</TableHead>
                    {canViewDetails && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lookupResult.map((loan) => (
                    <TableRow key={loan.id}>
                        <TableCell className="font-medium">{loan.loanNumber}</TableCell>
                        <TableCell>{loan.customerName}</TableCell>
                        <TableCell>{loan.loanAmount.toLocaleString()} ETB</TableCell>
                        <TableCell><Badge variant="secondary">{loan.currentStageName}</Badge></TableCell>
                        <TableCell>{format(parseISO(loan.submittedDate), 'PP')}</TableCell>
                        {canViewDetails && (
                        <TableCell className="text-right">
                            <Link href={`/loan-requests/${loan.id}`} passHref>
                                <Button variant="ghost" size="sm">View Loan <ExternalLink className="ml-2 h-3 w-3" /></Button>
                            </Link>
                        </TableCell>
                        )}
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
