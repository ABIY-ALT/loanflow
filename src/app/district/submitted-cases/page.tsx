
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { 
  FileOutput, 
  Search, 
  Loader2, 
  AlertCircle, 
  ExternalLink, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  User,
  History,
  Send,
  Network,
  StickyNote,
  UserCheck
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { getDistrictSubmittedLoanRequests, submitType2ToValuation, getDistrictAnalystsForLoan, handoffValuationReturnToAnalyst } from '@/services/loan-service-prisma';
import type { LoanRequest, User as AppUser } from '@/types/loan';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from '@/components/ui/checkbox';

type FilterStatus = 'all' | 'active' | 'overdue';

export default function DistrictSubmittedCasesPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const canViewPage = currentUser?.permissions.includes(PERMISSIONS.VIEW_OWN_SUBMITTED_CASES);

  async function fetchDistrictLoans() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDistrictSubmittedLoanRequests();
      if (result.error) {
        setError(result.error);
      } else {
        setLoans(result.loans || []);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while fetching district cases.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !canViewPage || !currentUser) {
        if (!authLoading) setIsLoading(false);
        return;
    }
    
    fetchDistrictLoans();
  }, [currentUser, authLoading, canViewPage]);

  const filteredLoans = useMemo(() => {
    let result = [...loans];

    // Status Filter
    if (statusFilter === 'active') {
      result = result.filter(l => !l.isTerminalStage);
    } else if (statusFilter === 'overdue') {
      result = result.filter(l => l.isOverdue && !l.isTerminalStage);
    }

    // Search Term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(l => 
        l.loanNumber.toLowerCase().includes(lowerSearch) ||
        l.customerName.toLowerCase().includes(lowerSearch) ||
        l.sectorName.toLowerCase().includes(lowerSearch) ||
        (l.createdBy?.fullName?.toLowerCase() || '').includes(lowerSearch)
      );
    }

    return result;
  }, [loans, statusFilter, searchTerm]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading district cases...</p>
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to view district submitted cases.</p>
        <Link href="/" passHref>
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <Network className="mr-3 h-8 w-8 text-primary" />
            District Submitted Cases
          </h1>
          <p className="text-muted-foreground">
            Monitor all loan requests submitted within your district.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>District Submissions ({filteredLoans.length})</CardTitle>
              <CardDescription>All loans submitted by CRM users in this district are shown here.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search number, customer, CRM..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Submissions</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="overdue">Overdue Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLoans.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground border rounded-lg bg-muted/10">
              <FileOutput className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No district cases found.</p>
              <p className="text-sm">Try adjusting your filters or search term.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Process</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Submitted On</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Workflow Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => (
                    <TableRow key={loan.id} className={cn("hover:bg-muted/50", loan.isOverdue && !loan.isTerminalStage && "bg-amber-50/50")}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-semibold">{loan.loanNumber}</span>
                          <Badge variant={loan.submissionType === 'TYPE2' ? "secondary" : "outline"} className={cn("w-fit text-[10px] py-0 px-1 font-normal", loan.submissionType === 'TYPE2' && "bg-amber-100 text-amber-800 border-amber-200")}>
                            {loan.submissionType === 'TYPE2' ? 'District Specialized' : 'Head Office'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <div className="font-medium">{loan.customerName}</div>
                           {(loan.history || []).some(h => h.notes && !h.notes.includes('Moved to') && !h.notes.includes('Marked complete')) && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <StickyNote className="h-3.5 w-3.5 text-blue-500 fill-blue-50" />
                                </TooltipTrigger>
                                <TooltipContent>Has manual notes</TooltipContent>
                              </Tooltip>
                           )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">{loan.sectorName}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                         <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {loan.createdBy?.fullName || 'Unknown'}
                         </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(parseISO(loan.submittedDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal border-primary/20">
                          {loan.currentStageName || 'Unknown Stage'}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Building className="h-3 w-3" /> {loan.assignedDepartment || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {loan.isTerminalStage ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 w-fit">Completed</Badge>
                          ) : loan.isReadyForManagerReview ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1 w-fit">
                              <UserCheck className="h-3 w-3" /> Awaiting Manager Review
                            </Badge>
                          ) : loan.isOverdue ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <Clock className="h-3 w-3" /> Overdue
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 w-fit">Active Pipeline</Badge>
                          )}
                          {loan.isReadyForManagerReview && (
                            <p className="text-[10px] text-amber-700 font-medium italic">Sent to Business Manager for Approval</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/loan-requests/${loan.id}`} passHref>
                            <Button variant="outline" size="sm" className="gap-2">
                              <ExternalLink className="h-3.5 w-3.5" /> View
                            </Button>
                          </Link>
                          <Link href={`/loan-requests/${loan.id}?tab=history`} passHref title="View Audit Trail">
                            <Button variant="ghost" size="icon">
                              <History className="h-4 w-4" />
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
    </TooltipProvider>
  );
}
