
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
  Info,
  History,
  Send,
  FileText,
  UserCircle,
  Edit
} from 'lucide-react';
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
import { getSubmittedLoanRequests, submitType2ToValuation, getDistrictAnalystsForLoan, handoffValuationReturnToAnalyst } from '@/services/loan-service-prisma';
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

export default function MySubmittedCasesPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const [selectedLoanForValuation, setSelectedLoanForValuation] = useState<LoanRequest | null>(null);
  const [confirmChecklist, setConfirmChecklist] = useState(false);
  const [isSubmittingToValuation, setIsSubmittingToValuation] = useState(false);
  const [selectedLoanForAnalyst, setSelectedLoanForAnalyst] = useState<LoanRequest | null>(null);
  const [analystsForLoan, setAnalystsForLoan] = useState<AppUser[]>([]);
  const [selectedAnalystId, setSelectedAnalystId] = useState('');
  const [isPreparingAnalystDialog, setIsPreparingAnalystDialog] = useState(false);
  const [isSendingToAnalyst, setIsSendingToAnalyst] = useState(false);

  const canViewPage = currentUser?.permissions.includes(PERMISSIONS.VIEW_OWN_SUBMITTED_CASES);

  async function fetchSubmittedLoans() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getSubmittedLoanRequests();
      if (result.error) {
        setError(result.error);
      } else {
        setLoans(result.loans || []);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while fetching your cases.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !canViewPage || !currentUser) {
        if (!authLoading) setIsLoading(false);
        return;
    }
    
    fetchSubmittedLoans();
  }, [currentUser, authLoading, canViewPage]);

  const handleForwardToValuation = async () => {
    if (!selectedLoanForValuation || !confirmChecklist) return;
    
    setIsSubmittingToValuation(true);
    try {
      const result = await submitType2ToValuation(selectedLoanForValuation.id);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case forwarded to Valuation Department." });
        setSelectedLoanForValuation(null);
        setConfirmChecklist(false);
        fetchSubmittedLoans();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingToValuation(false);
    }
  };

  const openSendToAnalystDialog = async (loan: LoanRequest) => {
    setIsPreparingAnalystDialog(true);
    try {
      const result = await getDistrictAnalystsForLoan(loan.id);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }
      setAnalystsForLoan(result.analysts || []);
      setSelectedAnalystId('');
      setSelectedLoanForAnalyst(loan);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load analysts.", variant: "destructive" });
    } finally {
      setIsPreparingAnalystDialog(false);
    }
  };

  const handleSendToAnalyst = async () => {
    if (!selectedLoanForAnalyst || !selectedAnalystId) return;
    setIsSendingToAnalyst(true);
    try {
      const result = await handoffValuationReturnToAnalyst(selectedLoanForAnalyst.id, selectedAnalystId);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case sent to district analyst." });
        setSelectedLoanForAnalyst(null);
        setSelectedAnalystId('');
        setAnalystsForLoan([]);
        fetchSubmittedLoans();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send case.", variant: "destructive" });
    } finally {
      setIsSendingToAnalyst(false);
    }
  };

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
        l.sectorName.toLowerCase().includes(lowerSearch)
      );
    }

    return result;
  }, [loans, statusFilter, searchTerm]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading your submitted cases...</p>
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to view your submitted cases.</p>
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
            <FileOutput className="mr-3 h-8 w-8 text-primary" />
            My Submitted Cases
          </h1>
          <p className="text-muted-foreground">
            Track the real-time progress of head office loan requests you have submitted. District-originated submissions are managed in District Submitted Cases and by assigned CRM workflows.
          </p>
        </div>
        <Link href="/loan-requests/new" passHref>
          <Button>Submit New Loan</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Submitted Loans ({filteredLoans.length})</CardTitle>
              <CardDescription>Only loans where you are the initial inputter are shown here.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search number, customer..." 
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
              <p className="text-lg font-medium">No submitted cases found.</p>
              <p className="text-sm">Try adjusting your filters or search term.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Submitted On</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => (
                    <TableRow key={loan.id} className={cn("hover:bg-muted/50", loan.isOverdue && !loan.isTerminalStage && "bg-amber-50/50")}>
                      <TableCell className="font-mono text-xs font-semibold">{loan.loanNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{loan.customerName}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">{loan.sectorName}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(parseISO(loan.submittedDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal border-primary/20">
                          {loan.currentStageStatus === 'RETURNED_FROM_VALUATION'
                            ? `Returned from Valuation to District CRM (${loan.currentStageName || 'Unknown Stage'})`
                            : loan.currentStageName || 'Unknown Stage'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-muted-foreground" />
                          {loan.assignedDepartment || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {loan.isTerminalStage ? (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">Completed</Badge>
                        ) : loan.isOverdue ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <Clock className="h-3 w-3" /> Overdue
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Active</Badge>
                        )}
                        {loan.currentStageStatus && (
                          <div className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">{loan.currentStageStatus}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(loan.lastUpdatedDate), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/loan-requests/${loan.id}?tab=history`} passHref title="View Audit Trail">
                            <Button variant="ghost" size="icon">
                              <History className="h-4 w-4" />
                            </Button>
                          </Link>
                          {loan.submissionType === 'TYPE2' && !loan.isReadyForValuation ? (
                            <>
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="h-8 bg-green-600 hover:bg-green-700"
                                onClick={() => setSelectedLoanForValuation(loan)}
                              >
                                Send <Send className="ml-1.5 h-3 w-3" />
                              </Button>
                            </>
                          ) : loan.currentStageStatus === 'RETURNED_FROM_VALUATION' ? (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 bg-blue-600 hover:bg-blue-700"
                                onClick={() => openSendToAnalystDialog(loan)}
                                disabled={isPreparingAnalystDialog}
                              >
                                {isPreparingAnalystDialog && selectedLoanForAnalyst?.id === loan.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                                Send Returned Case To Analyst <User className="ml-1.5 h-3 w-3" />
                              </Button>
                              <Link href={`/loan-requests/${loan.id}`} passHref>
                                <Button variant="ghost" size="sm" className="h-8">
                                  View <ExternalLink className="ml-1.5 h-3 w-3" />
                                </Button>
                              </Link>
                            </>
                          ) : (
                            <Link href={`/loan-requests/${loan.id}`} passHref>
                              <Button variant="ghost" size="sm" className="h-8">
                                View <ExternalLink className="ml-1.5 h-3 w-3" />
                              </Button>
                            </Link>
                          )}
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

      {/* Forward to Valuation Dialog */}
      <Dialog open={!!selectedLoanForValuation} onOpenChange={(open) => !open && setSelectedLoanForValuation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward to Valuation Department</DialogTitle>
            <DialogDescription>
              Confirm completion of all documents for {selectedLoanForValuation?.customerName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="p-4 bg-muted rounded-md space-y-2 text-sm">
                <div className="flex items-center gap-2">
                   {selectedLoanForValuation?.lafData ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                   <span>Loan Approval Form (LAF)</span>
                </div>
                <div className="flex items-center gap-2">
                   {selectedLoanForValuation?.customerSummaryData ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                   <span>Customer Summary (CAFC)</span>
                </div>
             </div>
             <div className="flex items-start space-x-3 pt-2">
                <Checkbox id="confirm" checked={confirmChecklist} onCheckedChange={(checked: boolean) => setConfirmChecklist(checked)} />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="confirm" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I have completed all necessary documents
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Checking this confirms that the LAF and Customer Summary are ready for valuation review.
                  </p>
                </div>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLoanForValuation(null)}>Cancel</Button>
            <Button 
              onClick={handleForwardToValuation} 
              disabled={isSubmittingToValuation || !confirmChecklist}
            >
              {isSubmittingToValuation ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward Returned Case to Analyst */}
      <Dialog open={!!selectedLoanForAnalyst} onOpenChange={(open) => !open && setSelectedLoanForAnalyst(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Case To District Analyst</DialogTitle>
            <DialogDescription>
              Review valuation result and route {selectedLoanForAnalyst?.loanNumber} to a district analyst.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-md text-sm space-y-1">
              <p><span className="font-semibold">Customer:</span> {selectedLoanForAnalyst?.customerName}</p>
              <p><span className="font-semibold">Valuation:</span> {selectedLoanForAnalyst?.isValuationCompleted ? "Completed" : "Pending"}</p>
              {selectedLoanForAnalyst?.valuationReportData?.finalRecommendation && (
                <p><span className="font-semibold">Recommendation:</span> {selectedLoanForAnalyst.valuationReportData.finalRecommendation}</p>
              )}
              <p className="text-xs text-muted-foreground">Open full case details to review complete valuation report before routing.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select District Analyst</label>
              <Select value={selectedAnalystId} onValueChange={setSelectedAnalystId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose analyst" />
                </SelectTrigger>
                <SelectContent>
                  {analystsForLoan.length === 0 ? (
                    <SelectItem value="__none" disabled>No analysts found in this department</SelectItem>
                  ) : (
                    analystsForLoan.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLoanForAnalyst(null)}>Cancel</Button>
            <Button onClick={handleSendToAnalyst} disabled={isSendingToAnalyst || !selectedAnalystId || analystsForLoan.length === 0}>
              {isSendingToAnalyst ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <User className="h-4 w-4 mr-2" />}
              Send To Analyst
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
