'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getCustomers } from '@/services/loan-service-prisma';
import type { CustomerWithDepartment } from '@/types/loan';
import { Loader2, Users, AlertCircle, ArrowLeft, ExternalLink, Search } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { Input } from '@/components/ui/input';


export default function CustomersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithDepartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canViewCustomers = user?.permissions.includes(PERMISSIONS.VIEW_CUSTOMERS);

  useEffect(() => {
    if (authLoading || !canViewCustomers) {
        if (!authLoading) setIsLoading(false);
        return;
    }

    async function fetchCustomers() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getCustomers();
        if (result.error) {
          setError(result.error);
        } else {
          setCustomers(result.customers || []);
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomers();
  }, [authLoading, canViewCustomers]);
  
  const filteredCustomers = useMemo(() => {
    if (!searchTerm) {
      return customers;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(lowercasedFilter) ||
      customer.email.toLowerCase().includes(lowercasedFilter) ||
      (customer.phone && customer.phone.toLowerCase().includes(lowercasedFilter))
    );
  }, [customers, searchTerm]);


  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading customers...</p>
      </div>
    );
  }

  if (!canViewCustomers) {
    return (
       <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view this page.</p>
            <Link href="/" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
            </Link>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <Users className="mr-3 h-8 w-8 text-primary" />
            Customer Profiles
          </h1>
          <p className="text-muted-foreground">
            A centralized list of all customers with loan requests in the system.
          </p>
        </div>
        <Link href="/loan-requests/new" passHref>
          <Button>New Loan Request</Button>
        </Link>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>All Customers ({filteredCustomers.length})</CardTitle>
              <CardDescription>
                This table provides an overview of all customers and their associated loan requests.
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Current Department / Stage</TableHead>
                <TableHead className="text-center">Loan Requests</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                     {searchTerm ? 'No customers match your search.' : 'No customers found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell>{customer.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <div>{customer.mostRecentDepartment || 'N/A'}</div>
                      {customer.mostRecentStageName && (
                        <div className="text-xs text-muted-foreground">{customer.mostRecentStageName}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{customer.loanRequests.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Link href={`/customers/${customer.id}`} passHref>
                         <Button variant="ghost" size="sm">View Profile <ExternalLink className="ml-2 h-3 w-3" /></Button>
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
