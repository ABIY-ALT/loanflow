
import type { Metadata } from 'next';
import './globals.css';
import AppLayout from '@/components/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context'; 
import { headers } from 'next/headers'; // Import headers

export const metadata: Metadata = {
  title: 'LoanFlow - Loan Management System',
  description: 'Efficiently manage loan requests and processes.',
  icons: null, 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = headers().get('x-nonce') || ''; // Get the nonce from the headers

  return (
    <html lang="en" suppressHydrationWarning nonce={nonce}>
      <body className="antialiased">
        <AuthProvider> {/* Ensure AuthProvider wraps AppLayout and children */}
          <AppLayout>
            {children}
          </AppLayout>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
