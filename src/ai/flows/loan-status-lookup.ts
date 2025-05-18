'use server';
/**
 * @fileOverview Loan status lookup AI agent.
 *
 * - loanStatusLookup - A function that handles the loan status lookup process.
 * - LoanStatusLookupInput - The input type for the loanStatusLookup function.
 * - LoanStatusLookupOutput - The return type for the loanStatusLookup function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LoanStatusLookupInputSchema = z.object({
  loanNumber: z.string().optional().describe('The loan number to lookup.'),
  customerNumber: z.string().optional().describe('The customer number to lookup.'),
});
export type LoanStatusLookupInput = z.infer<typeof LoanStatusLookupInputSchema>;

const LoanStatusLookupOutputSchema = z.object({
  status: z.string().describe('The current status of the loan.'),
  details: z.string().describe('Additional details about the loan status.'),
});
export type LoanStatusLookupOutput = z.infer<typeof LoanStatusLookupOutputSchema>;

export async function loanStatusLookup(input: LoanStatusLookupInput): Promise<LoanStatusLookupOutput> {
  return loanStatusLookupFlow(input);
}

const prompt = ai.definePrompt({
  name: 'loanStatusLookupPrompt',
  input: {schema: LoanStatusLookupInputSchema},
  output: {schema: LoanStatusLookupOutputSchema},
  prompt: `You are an AI assistant helping a credit chief understand the status of a loan.

  Provide a concise status and relevant details based on the available information.

  Loan Number: {{loanNumber}}
  Customer Number: {{customerNumber}}`,
});

const loanStatusLookupFlow = ai.defineFlow(
  {
    name: 'loanStatusLookupFlow',
    inputSchema: LoanStatusLookupInputSchema,
    outputSchema: LoanStatusLookupOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
