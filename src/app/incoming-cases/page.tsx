'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { 
  BellRing, 
  Search, 
  Loader2, 
  AlertCircle, 
  ArrowLeft,
  UserPlus,
  Clock,
  Flame,
  CheckCircle2,
  History,
  Users,
  Eye,
  MessageSquare,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { getAssignedByMePortfolio, getIncomingLoanRequests } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { cn } from '@/lib/utils';
import { QuickFollowUpDialog } from '@/components/loan/dialogs/QuickFollowUpDialog';

export default function IncomingCasesPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [delegatedPortfolioLoans, setDelegatedPortfolioLoans] = useState<LoanRequest[]>([]);
  const [incomingLoans, setIncomingLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Status Dialog State
  const [selectedLoanForStatus, setSelectedLoanForStatus] = useState<LoanRequest | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  const canViewPage = currentUser?.permissions.includes(PERMISSIONS.VIEW_INCOMING_CASES);

  useEffect(() => {
    if (authLoading || !canViewPage || !currentUser) {
        if (!authLoading) setIsLoading(false);
        return;
    }
    
    async function fetchLoans() {
      setIsLoading(true);
      setError(null);
      try {
        const [incomingResult, delegatedResult] = await Promise.all([
          getIncomingLoanRequests(),
          getAssignedByMePortfolio(),
        ]);

        if (incomingResult.error) {
          setError(incomingResult.error);
          return;
        }
        if (delegatedResult.error) {
          setError(delegatedResult.error);
          return;
        }

        if ('loans' in incomingResult && incomingResult.loans) {
          setIncomingLoans(incomingResult.loans);
        }
        if ('loans' in delegatedResult && delegatedResult.loans) {
          setDelegatedPortfolioLoans(delegatedResult.loans);
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchLoans();
    const intervalId = window.setInterval(fetchLoans, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser, authLoading, canViewPage]);

  // Filter 1: Queue Awaiting Assignment
  // Filter 2: Cases Ever Assigned by Me (historical)
  const delegatedLoans = useMemo(() => delegatedPortfolioLoans, [delegatedPortfolioLoans]);

  const filterLoans = (list: LoanRequest[]) => {
    if (!searchTerm) return list;
    const lowerSearch = searchTerm.toLowerCase();
    return list.filter(l => 
      l.loanNumber.toLowerCase().includes(lowerSearch) ||
      l.customerName.toLowerCase().includes(lowerSearch) ||
      l.sectorName.toLowerCase().includes(lowerSearch)
    );
  };

  const sortLoans = (list: LoanRequest[]) => {
    return [...list].sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime();
    });
  };

  const filteredIncoming = useMemo(() => sortLoans(filterLoans(incomingLoans)), [incomingLoans, searchTerm]);
  const filteredDelegated = useMemo(() => sortLoans(filterLoans(delegatedLoans)), [delegatedLoans, searchTerm]);

  const openStatusView = (loan: LoanRequest) => {
    setSelectedLoanForStatus(loan);
    setIsStatusDialogOpen(true);
  };

  const exportDelegatedToCSV = () => {
    if (filteredDelegated.length === 0) return;
    const headers = [
      'Loan Number', 'Customer', 'Current Stage', 'Current Assignees', 'Assigned Department', 'Stage Deadline', 'Latest Activity', 'Latest Activity At', 'Assignment/Completion History'
    ];
    const csvData = filteredDelegated.map(loan => {
      // Find assignment/completion events in history
      const assignmentEvents = (loan.history || []).filter(h => h.notes && (h.notes.toLowerCase().includes('assigned') || h.notes.toLowerCase().includes('completed') || h.notes.toLowerCase().includes('reassign')));
      const historySummary = assignmentEvents.map(h => `${h.timestamp}: ${h.userName} (${h.userRole || ''}) - ${h.notes}`).join(' | ');
      const latestHistory = (loan.history || [])[0];
      return [
        loan.loanNumber,
        loan.customerName,
        loan.currentStageName || '',
        loan.assignedToUsers.map(u => u.fullName).join('; '),
        loan.assignedDepartment || '',
        loan.stageDeadline ? format(parseISO(loan.stageDeadline), 'MMM dd, yyyy') : '',
        latestHistory?.notes || '',
        latestHistory?.timestamp ? format(parseISO(latestHistory.timestamp), 'MMM dd, yyyy HH:mm') : '',
        historySummary
      ];
    });
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'delegated_portfolio_cases.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
            Incoming & Delegated Cases
          </h1>
          <p className="text-muted-foreground">
            Manage new arrivals in {currentUser?.department || 'your department'} and track cases you have assigned.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search cases..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link href="/" passHref>
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-6 h-12">
          <TabsTrigger value="queue" className="gap-2 text-base">
            <BellRing className="h-4 w-4" />
            Queue Awaiting Assignment ({filteredIncoming.length})
          </TabsTrigger>
          <TabsTrigger value="assigned" className="gap-2 text-base">
            <Users className="h-4 w-4" />
            Assigned by Me ({filteredDelegated.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4 animate-in fade-in-50 duration-300">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Unassigned Dept Queue
              </CardTitle>
              <CardDescription>New cases promoted to your department that need staff delegation.</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredIncoming.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                  <BellRing className="mx-auto h-12 w-12 opacity-20 mb-4" />
                  <p className="text-xl font-medium">Queue is Clear</p>
                  <p className="text-sm">No new unassigned cases at this time.</p>
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
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIncoming.map((loan) => (
                        <TableRow key={loan.id} className={cn("hover:bg-primary/5 transition-colors", loan.isUrgent && "bg-red-50/50")}>
                          <TableCell className="text-center">
                            {loan.isUrgent && <Flame className="h-5 w-5 text-red-500 animate-pulse inline" />}
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
                              <Link href={`/loan-requests/${loan.id}`} passHref>
                                <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-sm">
                                  <UserPlus className="mr-2 h-4 w-4" /> Assign Staff
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
        </TabsContent>

        <TabsContent value="assigned" className="space-y-4 animate-in fade-in-50 duration-300">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="flex flex-row items-start sm:items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Delegated Portfolio
                </CardTitle>
                <CardDescription>Tracking cases where you have assigned the active staff.</CardDescription>
              </div>
              <Button onClick={exportDelegatedToCSV} variant="outline" size="sm" className="h-8 shadow-sm" disabled={filteredDelegated.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {filteredDelegated.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                  <Users className="mx-auto h-12 w-12 opacity-20 mb-4" />
                  <p className="text-xl font-medium">No Delegated Cases</p>
                  <p className="text-sm">You haven't assigned any active cases in this stage.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-12">Urgent</TableHead>
                        <TableHead>Loan Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Assigned Staff</TableHead>
                        <TableHead>Current Stage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latest Activity</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDelegated.map((loan) => (
                        <TableRow key={loan.id} className={cn("hover:bg-primary/5 transition-colors", loan.isUrgent && "bg-red-50/50")}>
                          <TableCell className="text-center">
                            {loan.isUrgent && <Flame className="h-5 w-5 text-red-500 animate-pulse inline" />}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold">{loan.loanNumber}</TableCell>
                          <TableCell>
                            <div className="font-semibold">{loan.customerName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex -space-x-2 overflow-hidden">
                              {loan.assignedToUsers.map((u) => (
                                <Badge key={u.id} variant="secondary" className="border border-background text-[10px] py-0 px-1.5">
                                  {u.fullName.split(' ')[0]}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">{loan.currentStageName}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{loan.assignedDepartment}</div>
                          </TableCell>
                          <TableCell>
                            {loan.isReadyForManagerReview ? (
                              <Badge className="bg-green-600 text-white text-[10px]">Review Ready</Badge>
                            ) : loan.isOverdue ? (
                              <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">In Progress</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <div className="text-xs font-medium truncate">{loan.history?.[0]?.notes || 'No recent update'}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {loan.history?.[0]?.timestamp ? format(parseISO(loan.history[0].timestamp), 'MMM dd, HH:mm') : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(parseISO(loan.lastUpdatedDate), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 border-orange-200 text-orange-700 hover:bg-orange-50"
                                onClick={() => openStatusView(loan)}
                              >
                                <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Follow-up
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openStatusView(loan)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
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
        </TabsContent>
      </Tabs>

      <QuickFollowUpDialog 
        isOpen={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        loan={selectedLoanForStatus}
      />
    </div>
  );
}
