
import type { Metadata } from 'next';
import './globals.css';
import AppLayout from '@/components/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";
// Removed: import { AuthProvider } from '@/contexts/auth-context'; 

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
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {/* Removed AuthProvider wrapper */}
        <AppLayout>
          {children}
        </AppLayout>
        <Toaster />
      </body>
    </html>
  );
}
