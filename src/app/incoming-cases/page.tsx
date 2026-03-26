
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { 
  BellRing, 
  Search, 
  Loader2, 
  AlertCircle, 
  ExternalLink, 
  ArrowLeft,
  UserPlus,
  Building,
  Clock,
  Flame,
  CheckCircle2,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { getLoanRequests } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { cn } from '@/lib/utils';

export default function IncomingCasesPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canViewPage = currentUser?.permissions.includes(PERMISSIONS.VIEW_INCOMING_CASES);

  useEffect(() => {
    if (authLoading || !canViewPage || !currentUser) {
        if (!authLoading) setIsLoading(false);
        return;
    }
    
    async function fetchIncomingLoans() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getLoanRequests();
        if (result.error) {
          setError(result.error);
        } else if (result.loans) {
          // Filter: same department AND no assigned staff AND not ready for manager review yet (it's new to the dept)
          const incoming = result.loans.filter(loan => 
            loan.assignedDepartment === currentUser.department && 
            loan.assignedToUsers.length === 0 &&
            !loan.isReadyForManagerReview
          );
          setLoans(incoming);
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchIncomingLoans();
  }, [currentUser, authLoading, canViewPage]);

  const filteredLoans = useMemo(() => {
    if (!searchTerm) return loans;
    const lowerSearch = searchTerm.toLowerCase();
    return loans.filter(l => 
      l.loanNumber.toLowerCase().includes(lowerSearch) ||
      l.customerName.toLowerCase().includes(lowerSearch) ||
      l.sectorName.toLowerCase().includes(lowerSearch)
    );
  }, [loans, searchTerm]);

  const sortedLoans = useMemo(() => {
    return [...filteredLoans].sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime();
    });
  }, [filteredLoans]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading incoming cases...</p>
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to view incoming department cases.</p>
        <Link href="/" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <BellRing className="mr-3 h-8 w-8 text-primary" />
            Incoming Cases: {currentUser?.department || 'My Department'}
          </h1>
          <p className="text-muted-foreground">
            New loan requests promoted to your department that are awaiting staff assignment.
          </p>
        </div>
        <Link href="/" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
        </Link>
      </div>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Queue Awaiting Assignment ({sortedLoans.length})
              </CardTitle>
              <CardDescription>Managers should assign these cases to relevant staff members.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search cases..." 
                className="pl-10 border-primary/20 focus-visible:ring-primary"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedLoans.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
              <div className="mx-auto h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <BellRing className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-xl font-medium">No New Incoming Cases</p>
              <p className="text-sm">Your department queue is currently up-to-date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-12">Urgent</TableHead>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Action Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLoans.map((loan) => (
                    <TableRow key={loan.id} className={cn("hover:bg-primary/5 transition-colors", loan.isUrgent && "bg-red-50/50")}>
                      <TableCell className="text-center">
                        {loan.isUrgent && (
                          <div className="flex justify-center">
                            <Flame className="h-5 w-5 text-red-500 animate-pulse" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-primary">{loan.loanNumber}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{loan.customerName}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{loan.sectorName}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium bg-background border-primary/30 text-primary">
                          {loan.currentStageName || 'Review'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {format(parseISO(loan.lastUpdatedDate), 'MMM dd, HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/loan-requests/${loan.id}?tab=history`} passHref title="View Audit Trail">
                            <Button variant="ghost" size="icon">
                              <History className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/loan-requests/${loan.id}`} passHref>
                            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-md hover:shadow-lg transition-all group">
                              <UserPlus className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
                              Assign Staff
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
