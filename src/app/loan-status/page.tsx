
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
import { Loader2, Search, BotMessageSquare, ListChecks, AlertCircle } from 'lucide-react';
import { loanStatusLookup, LoanStatusLookupInput, LoanStatusLookupOutput } from '@/ai/flows/loan-status-lookup';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const loanStatusSchema = z.object({
  identifier: z.string().min(1, { message: "Please enter a Loan or Customer Number." }),
  type: z.enum(['loanNumber', 'customerNumber']),
});

type LoanStatusFormValues = z.infer<typeof loanStatusSchema>;

export default function LoanStatusPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LoanStatusLookupOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoanStatusFormValues>({
    resolver: zodResolver(loanStatusSchema),
    defaultValues: {
      identifier: '',
      type: 'loanNumber', // Default to loan number
    },
  });

  async function onSubmit(data: LoanStatusFormValues) {
    setIsLoading(true);
    setLookupResult(null);
    setError(null);

    const input: LoanStatusLookupInput = data.type === 'loanNumber'
      ? { loanNumber: data.identifier }
      : { customerNumber: data.identifier };

    try {
      const result = await loanStatusLookup(input); // This is a Server Action call

      // Assuming loanStatusLookup returns LoanStatusLookupOutput or throws an error
      // Server actions typically don't return { error: string } like our custom service might
      // They either succeed and return data, or the promise rejects with an error.

      setLookupResult(result);
      toast({
        title: "Loan Status Retrieved",
        description: `Status for ${data.identifier} found.`,
      });
    } catch (err: any) {
      console.error("Loan status lookup error:", err);
      let errorMessage = "An unexpected error occurred during lookup.";
      if (err && typeof err.message === 'string') {
        errorMessage = err.message;
      }
      setError(errorMessage); // Set local error state for Alert display
      toast({
        title: "Lookup Failed",
        description: `Error: ${errorMessage}`,
        variant: "destructive",
        duration: 9000,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loan Status Lookup</h1>
        <p className="text-muted-foreground">
          Use AI to quickly find the status of a loan using its Loan Number or Customer Number.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Enter Loan Identifier</CardTitle>
          <CardDescription>Provide either the Loan Number or Customer Number.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan or Customer Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="e.g., LN00001 or CUST001" {...field} className="pl-10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Identifier Type</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
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
                           variant={field.value === 'customerNumber' ? 'default' : 'outline'}
                          onClick={() => field.onChange('customerNumber')}
                          className="flex-1"
                        >
                          Customer Number
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BotMessageSquare className="mr-2 h-4 w-4" />
                )}
                Lookup Status with AI
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Alert>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <AlertTitle className="ml-2">AI is Thinking...</AlertTitle>
          <AlertDescription className="ml-2">
            Please wait while we retrieve the loan status. This may take a moment.
          </AlertDescription>
        </Alert>
      )}

      {error && !isLoading && ( // Show local error Alert if not loading
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Lookup Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lookupResult && !isLoading && (
        <Card className="shadow-lg">
          <CardHeader className="bg-muted/30">
            <CardTitle className="flex items-center text-xl">
              <ListChecks className="mr-2 h-6 w-6 text-primary" />
              Loan Status Result
            </CardTitle>
            <CardDescription>
              AI-powered status for identifier: {form.getValues('identifier')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Status</h3>
              <p className="text-lg font-medium text-primary">{lookupResult.status}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Details</h3>
              <p className="text-base whitespace-pre-wrap">{lookupResult.details}</p>
            </div>
          </CardContent>
           <CardFooter>
            <p className="text-xs text-muted-foreground">
              This information is generated by AI and was last updated based on available data.
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

    