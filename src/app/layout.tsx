import type { Metadata } from 'next';
// import { GeistSans } from 'geist/font/sans'; // Removed problematic import
// import { GeistMono } from 'geist/font/mono'; // Removed problematic import
import './globals.css';
import AppLayout from '@/components/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";

// const geistSans = GeistSans; // Removed problematic import
// const geistMono = GeistMono; // Removed problematic import

export const metadata: Metadata = {
  title: 'LoanFlow - Loan Management System',
  description: 'Efficiently manage loan requests and processes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"> {/* Removed geistSans.variable and font-sans */}
        <AppLayout>
          {children}
        </AppLayout>
        <Toaster />
      </body>
    </html>
  );
}
