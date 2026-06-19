

'use client';

import { 
  getLoanRequests, 
  getCaseReviewHistory, 
  getDepartmentUsers, 
  updateLoanRequest, 
  getLoanRequestById,
  recordCaseReview,
  getWorkflowDefinitions,
  moveLoanToStage,
  returnToDistrictAnalyst,
  returnToOriginatingCRM,
  type CaseReviewRecord
} from '@/services/loan-service-prisma';
import type { LoanRequest, User, WorkflowDefinition } from '@/types/loan';
import { format, parseISO, formatISO, addDays } from 'date-fns';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, AlertTitle as AlertTitleShadCN, AlertDescription as AlertDescriptionShadCN } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { EditLoanDetailsDialog } from '@/components/loan/dialogs/EditLoanDetailsDialog';
import { ReturnLoanForReworkDialog } from '@/components/loan/dialogs/ReturnLoanForReworkDialog';
import { UserPlus, ArrowLeft, UserCheck, ExternalLink, Loader2, AlertCircle, Building, Flame, Users as UsersIcon, Download, Inbox, CheckCircle2, RotateCcw, Search } from 'lucide-react';

// Helper to display assigned user names
const getAssignedUserNames = (users: User[]): string => {
  if (!users || users.length === 0) return "N/A";
  return users.map(u => u.fullName).join(', ');
};
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import Link from 'next/link';
import { PERMISSIONS } from '@/lib/permissions';

export function ManagerReviewQueuePage({
  defaultTab = 'headoffice',
  pageTitle = 'Manager Review Queue',
}: {
  defaultTab?: 'district' | 'headoffice';
  pageTitle?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [reviewLoans, setReviewLoans] = useState<LoanRequest[]>([]);
  const [reviews, setReviews] = useState<CaseReviewRecord[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanRequest | null>(null);

  const canViewPage = currentUser?.permissions.includes(PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE);

  useEffect(() => {
    if (authIsLoading || !canViewPage) {
      if(!authIsLoading && !canViewPage) setIsLoading(false);
      return;
    }
    
    async function fetchPageData() {
      setIsLoading(true);
      setError(null);

      if (!currentUser?.department) {
        setError("Your user profile does not have an assigned department.");
        setIsLoading(false);
        return;
      }

      try {
        const [loansResult, historyResult, usersResult, wfResult] = await Promise.all([
          getLoanRequests(),
          getCaseReviewHistory({
            performedByUserId: currentUser.id,
            workflowPath: defaultTab === 'district' ? 'district' : 'headoffice',
          }),
          getDepartmentUsers(),
          getWorkflowDefinitions()
        ]);

        if (loansResult.error) setError(loansResult.error);
        if (loansResult && 'loans' in loansResult) {
          const districtDepartments = ['District', 'Service Sector Department'];
          const isDistrictReviewer = districtDepartments.includes(currentUser.department || '');
          const isDistrictQueue = defaultTab === 'district';

          const filtered = (loansResult.loans as LoanRequest[]).filter(l => {
            if (!(l.isReadyForManagerReview || l.isTerminalStage)) return false;

            if (isDistrictQueue) {
              return l.submissionType === 'TYPE2' && isDistrictReviewer;
            }

            // Head Office manager review — exclude district (TYPE-2) workflow cases
            if (l.submissionType === 'TYPE2') return false;
            return l.assignedDepartment === currentUser.department;
          });

          setReviewLoans(filtered);
        }

        if (historyResult.reviews) setReviews(historyResult.reviews);
        if (usersResult.users) setAllUsers(usersResult.users);
        if (wfResult.workflows) setWorkflowDefinitions(wfResult.workflows);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
  }, [currentUser, authIsLoading, canViewPage, defaultTab]);

  const handleLocalAndUpdateService = async (loanId: string, updates: Partial<LoanRequest>, successMsg: string) => {
    setIsSaving(true);
    try {
      const result = await updateLoanRequest(loanId, updates);
      if (result.error) throw new Error(result.error);
      
      setReviewLoans(prev => prev.map(l => l.id === loanId ? { ...l, ...updates } : l));
      toast({ title: "Success", description: successMsg });
      return { success: true };
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
      return { success: false };
    } finally {
      setIsSaving(false);
    }
  };

  const handleReturnToCRM = async (note: string) => {
    if (!selectedLoan) return;
    setIsSaving(true);
    try {
      const result = await returnToOriginatingCRM(selectedLoan.id, note);
      
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case returned to Originating CRM successfully." });
        setIsReturnDialogOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReturnToAnalyst = async (note: string, assigneeIds: string[], isCommentOnly?: boolean) => {
    if (!selectedLoan) return;
    setIsSaving(true);
    try {
      const result = await returnToDistrictAnalyst(selectedLoan.id, note, assigneeIds, isCommentOnly);
      
      if ('error' in result) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Case returned to Analyst successfully." });
        setIsReturnDialogOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManagerPromoteLoan = async (loan: LoanRequest, assignedUsers?: User[]) => {
    if (!loan || isSaving) return;
    setIsSaving(true);

    try {
      const wf = workflowDefinitions.find(d => d.versions.some(v => v.id === loan.workflowVersionId));
      const version = wf?.versions.find(v => v.id === loan.workflowVersionId);
      if (!version) throw new Error("Workflow version not found.");

      const currentIndex = version.stages.findIndex(s => s.id === loan.currentStageId);
      if (currentIndex === -1 || currentIndex >= version.stages.length - 1) throw new Error("No next stage available.");

      const nextStage = version.stages[currentIndex + 1];

      const reviewPayload = {
        loanRequestId: loan.id,
        action: 'APPROVED' as const,
        comment: `Case assigned and promoted to ${nextStage.name}.`,
        finalStatus: 'Approved & Promoted'
      };
      await recordCaseReview(reviewPayload);

      const moveResult = await moveLoanToStage(loan.id, nextStage.id);
      if (moveResult.error) throw new Error(moveResult.error);

      if (assignedUsers && assignedUsers.length > 0) {
        await updateLoanRequest(loan.id, { 
          assignedToUsers: assignedUsers,
          isReadyForManagerReview: false 
        });
      }

      toast({ title: "Case Promoted", description: `Successfully advanced to ${nextStage.name}` });
      setReviewLoans(prev => prev.filter(l => l.id !== loan.id));
      setIsAssignDialogOpen(false);

    } catch (err: any) {
      toast({ title: "Promotion Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignLoan = async (assignedUserIds: string[]) => {
    if (!selectedLoan) return;
    const selectedUsers = allUsers.filter(u => assignedUserIds.includes(u.id));
    
    const currentStageName = selectedLoan.currentStageName || '';
    const isDistrictAssignment = selectedLoan.submissionType === 'TYPE2' && 
                                (selectedLoan.currentStageOrder === 1 || selectedLoan.currentStageOrder === 5);

    if (isDistrictAssignment) {
      await handleManagerPromoteLoan(selectedLoan, selectedUsers);
    } else {
      await handleLocalAndUpdateService(selectedLoan.id, { 
        assignedToUsers: selectedUsers,
        isReadyForManagerReview: false
      }, "Staff assigned successfully.");
    }
    
    setIsAssignDialogOpen(false);
  };

  const filteredReviewLoans = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    if (!lowerSearch) return reviewLoans;

    return reviewLoans.filter((loan) => {
      const assignedNames = loan.assignedToUsers.map((u) => u.fullName).join(' ').toLowerCase();
      return (
        loan.loanNumber.toLowerCase().includes(lowerSearch) ||
        loan.customerName.toLowerCase().includes(lowerSearch) ||
        (loan.currentStageName || '').toLowerCase().includes(lowerSearch) ||
        assignedNames.includes(lowerSearch)
      );
    });
  }, [reviewLoans, searchTerm]);

  const filteredReviews = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();
    if (!lowerSearch) return reviews;

    return reviews.filter((review) =>
      review.loanNumber.toLowerCase().includes(lowerSearch) ||
      review.customerName.toLowerCase().includes(lowerSearch) ||
      review.action.toLowerCase().includes(lowerSearch) ||
      review.performedByName.toLowerCase().includes(lowerSearch) ||
      (review.comment || '').toLowerCase().includes(lowerSearch)
    );
  }, [reviews, searchTerm]);

  const sortedLoans = useMemo(() => {
    return [...filteredReviewLoans].sort((a, b) => {
      // Prioritize "Ready for Review"
      if (a.isReadyForManagerReview && !b.isReadyForManagerReview) return -1;
      if (!a.isReadyForManagerReview && b.isReadyForManagerReview) return 1;
      // Then prioritize Urgent
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      // Then prioritize Overdue
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Finally, by last updated date
      return new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime();
    });
  }, [filteredReviewLoans]);

  const visibleTabs = useMemo(() => {
    if (defaultTab === 'district') return ['district', 'history'];
    return ['headoffice', 'history'];
  }, [defaultTab]);

  const selectedTab = visibleTabs.includes(defaultTab) ? defaultTab : visibleTabs[0];

  const exportReviewHistoryToCSV = () => {
    if (filteredReviews.length === 0) return;
    const headers = ['Loan Number', 'Customer Name', 'Action', 'Reviewed By', 'Department', 'Date & Time', 'Final Status', 'Comment'];
    const csvData = filteredReviews.map(r => [
      r.loanNumber, r.customerName, r.action,
      r.performedByName, r.performedByDepartment || '',
      r.createdAt ? format(parseISO(r.createdAt), 'MMM dd, yyyy HH:mm') : '',
      r.finalStatus || '', r.comment || '',
    ]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'manager-review-history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading || authIsLoading) { 
     return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading cases for manager review...</p>
      </div>
    );
  }

  if (!canViewPage) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view the manager review queue.</p>
            <Link href="/" passHref>
                <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/>Go to Dashboard</Button>
            </Link>
        </div>
    );
  }


  if (error && reviewLoans.length === 0) { 
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight flex items-center"><UserCheck className="mr-3 h-8 w-8 text-primary" />Manager Review Queue</h1></div>
           <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
        </div>
        <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap"><AlertCircle className="h-5 w-5" /><AlertTitleShadCN>Error Loading Page Data</AlertTitleShadCN><AlertDescriptionShadCN>{error}</AlertDescriptionShadCN></Alert>
      </div>
    );
  }


  /* ── Helper: renders the queue card+table for a given set of loans ── */
  const renderQueueTable = (loans: LoanRequest[], mode: 'all' | 'district' | 'headoffice') => {
    const isDistrict = mode === 'district';
    const isHO = mode === 'headoffice';
    const borderColor = isDistrict ? 'border-amber-200' : isHO ? 'border-blue-200' : '';
    const bgColor = isDistrict ? 'bg-amber-50/40' : isHO ? 'bg-blue-50/40' : '';
    const titleColor = isDistrict ? 'text-amber-800' : isHO ? 'text-blue-800' : 'text-foreground';
    const emptyIcon = isDistrict ? '🏢' : isHO ? '🏦' : '✅';
    const pathLabel = isDistrict ? 'District Specialized' : isHO ? 'Head Office' : '';

    return (
      <Card className={cn(borderColor && `border ${borderColor}`, bgColor)}>
        <CardHeader>
          <CardTitle className={titleColor}>
            {pathLabel && <span className="mr-2">{pathLabel} —</span>}
            Cases for Your Review ({loans.length})
          </CardTitle>
          <CardDescription>
            {isDistrict
              ? 'District (TYPE-2) cases. At Stage 7 use "Return for Comment" to send back to the analyst.'
              : isHO
              ? 'Head Office (TYPE-1) cases. Use "Return for Rework" to reject and reassign.'
              : 'All cases across both workflow paths.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loans.length === 0 && !isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <p className="text-4xl mb-3">{emptyIcon}</p>
              <p className="text-lg font-semibold">No Cases Awaiting Review</p>
              <p>There are currently no {pathLabel || ''} loan requests in the manager review queue.</p>
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Urgent</TableHead>
                    {mode === 'all' && <TableHead>Path</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Assigned Staff</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan: LoanRequest) => {
                    const completedCount = loan.stageCompletedBy?.length || 0;
                    const assignedCount = loan.assignedToUsers.length;
                    const completionText = `${completedCount} of ${assignedCount} completed`;
                    const rowIsDistrict = loan.submissionType === 'TYPE2';
                    return (
                      <TableRow
                        key={loan.id}
                        className={cn(
                          'hover:bg-muted/50',
                          loan.isReadyForManagerReview
                            ? rowIsDistrict
                              ? 'bg-amber-50 dark:bg-amber-900/10'
                              : 'bg-blue-50 dark:bg-blue-900/10'
                            : '',
                          loan.isUrgent && 'border-2 border-red-400 dark:border-red-600'
                        )}
                      >
                        <TableCell className="text-center">
                          {loan.isUrgent && <Flame className="h-5 w-5 text-red-500" />}
                        </TableCell>

                        {/* Path badge — only in 'all' tab */}
                        {mode === 'all' && (
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] py-0 font-semibold',
                                rowIsDistrict
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              )}
                            >
                              {rowIsDistrict ? '🏢 District' : '🏦 Head Office'}
                            </Badge>
                          </TableCell>
                        )}

                        <TableCell>
                          {loan.isReadyForManagerReview ? (
                            <Badge className="bg-green-600 hover:bg-green-700 text-white w-fit">Ready for Review</Badge>
                          ) : (
                            <Badge variant="outline" className="w-fit">{`In Progress (${completionText})`}</Badge>
                          )}
                        </TableCell>

                        <TableCell className="font-medium">{loan.customerName}</TableCell>
                        <TableCell>{loan.loanNumber}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{loan.currentStageName || 'Unknown Stage'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <UsersIcon className="h-4 w-4 text-muted-foreground" />
                            {getAssignedUserNames(loan.assignedToUsers)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {loan.lastUpdatedDate
                            ? format(parseISO(loan.lastUpdatedDate), 'MMM dd, yyyy')
                            : <span className="text-muted-foreground">N/A</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center items-center gap-1 flex-wrap">
                            {/* District: Assign CRM/Analyst at stages 1-5 */}
                            {loan.isReadyForManagerReview && rowIsDistrict && loan.currentStageOrder !== 7 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-amber-400 text-amber-700 hover:bg-amber-50"
                                onClick={() => { setSelectedLoan(loan); setIsAssignDialogOpen(true); }}
                              >
                                <UserPlus className="mr-2 h-3.5 w-3.5" />
                                {loan.currentStageOrder === 5 ? 'Assign Analyst' : 'Assign CRM'}
                              </Button>
                            )}

                            {/* District Stage 7: Return for Comment only */}
                            {rowIsDistrict && loan.currentStageOrder === 7 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-indigo-500 text-indigo-700 hover:bg-indigo-50"
                                onClick={() => { setSelectedLoan(loan); setIsReturnDialogOpen(true); }}
                              >
                                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                Return for Comment
                              </Button>
                            )}

                            <Link href={`/loan-requests/${loan.id}`} passHref>
                              <Button variant="ghost" size="sm">
                                {loan.isReadyForManagerReview
                                  ? rowIsDistrict ? 'Review Case' : 'Review & Process'
                                  : 'View Details'}
                                <ExternalLink className="ml-2 h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <UserCheck className="mr-3 h-8 w-8 text-primary" />
            {pageTitle}
          </h1>
          <p className="text-muted-foreground">
            {defaultTab === 'district'
              ? <>District (TYPE-2) cases for the <span className="font-semibold text-primary">{currentUser?.department || 'N/A'}</span> department awaiting manager review. Urgent cases are prioritized.</>
              : <>Head Office cases assigned to the <span className="font-semibold text-primary">{currentUser?.department || 'N/A'}</span> department awaiting manager review. Urgent cases are prioritized.</>}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cases..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
        </div>
      </div>
      
      {error && (
         <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
            <AlertCircle className="h-5 w-5" />
            <AlertTitleShadCN>Partial Data Error</AlertTitleShadCN>
            <AlertDescriptionShadCN>There was an issue loading some data: {error}</AlertDescriptionShadCN>
        </Alert>
      )}

      <Tabs defaultValue={selectedTab} className="w-full">
        <TabsList>
          {visibleTabs.includes('district') && (
            <TabsTrigger value="district">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500"/>
                District ({sortedLoans.length})
              </span>
            </TabsTrigger>
          )}
          {visibleTabs.includes('headoffice') && (
            <TabsTrigger value="headoffice">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500"/>
                Head Office ({sortedLoans.length})
              </span>
            </TabsTrigger>
          )}
          {visibleTabs.includes('history') && (
            <TabsTrigger value="history">History ({filteredReviews.length})</TabsTrigger>
          )}
        </TabsList>

        {visibleTabs.includes('district') && (
          <TabsContent value="district">
            {renderQueueTable(sortedLoans, 'district')}
          </TabsContent>
        )}

        {visibleTabs.includes('headoffice') && (
          <TabsContent value="headoffice">
            {renderQueueTable(sortedLoans, 'headoffice')}
          </TabsContent>
        )}

        {visibleTabs.includes('history') && (
          <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>My Review History</CardTitle>
                <CardDescription>
                  {defaultTab === 'district'
                    ? 'Your district (TYPE-2) approvals, assignments, and rework decisions only.'
                    : 'Your head office workflow decisions only — district (TYPE-2) cases are listed under District Manager Review.'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportReviewHistoryToCSV} disabled={filteredReviews.length === 0}>
                <Download className="mr-2 h-4 w-4" />Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {filteredReviews.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Inbox className="mx-auto mb-4 h-12 w-12" />
                  <p className="text-lg font-semibold">No Review History</p>
                  <p className="mt-1">You have not recorded any approval or rework decisions yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Loan Number</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Reviewed By</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Final Status</TableHead>
                      <TableHead>Comment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReviews.map((review) => (
                      <TableRow key={review.id} className="hover:bg-muted/50">
                        <TableCell>
                          {review.action === 'APPROVED' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Approved
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300">
                              <RotateCcw className="h-3 w-3 mr-1" />Reworked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/loan-requests/${review.loanRequestId}`} className="text-primary hover:underline">
                            {review.loanNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{review.customerName}</TableCell>
                        <TableCell>{review.performedByName}</TableCell>
                        <TableCell>{review.performedByDepartment || 'N/A'}</TableCell>
                        <TableCell>{format(parseISO(review.createdAt), 'MMM dd, yyyy HH:mm')}</TableCell>
                        <TableCell>
                          {review.finalStatus ? (
                            <Badge variant="secondary">{review.finalStatus}</Badge>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={review.comment || ''}>
                          {review.comment || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
      <EditLoanDetailsDialog 
        isOpen={isAssignDialogOpen} 
        onOpenChange={setIsAssignDialogOpen} 
        loan={selectedLoan} 
        users={allUsers} 
        currentDepartment={currentUser?.department || ''} 
        onSubmit={async d => { await handleAssignLoan(d.assignedTo || []); }} 
        isSaving={isSaving} 
      />
      
      <ReturnLoanForReworkDialog
        isOpen={isReturnDialogOpen}
        onOpenChange={setIsReturnDialogOpen}
        loan={selectedLoan}
        forceCommentOnly={
          selectedLoan?.submissionType === 'TYPE2' && selectedLoan?.currentStageOrder === 7
        }
        users={
          selectedLoan?.submissionType === 'TYPE2' && selectedLoan?.currentStageOrder === 7
            ? allUsers.filter(u => u.department === 'District' || u.department === 'Service Sector Department')
            : allUsers.filter(u => u.department === selectedLoan?.assignedDepartment)
        }
        currentDepartment={
          selectedLoan?.submissionType === 'TYPE2' && selectedLoan?.currentStageOrder === 7
            ? 'District'
            : selectedLoan?.assignedDepartment || ''
        }
        onSubmit={async (note, assigneeIds) => {
          // District Stage 7 always uses comment-only path
          const isCommentOnly = selectedLoan?.submissionType === 'TYPE2' && selectedLoan?.currentStageOrder === 7 ? true : undefined;
          await handleReturnToAnalyst(note, assigneeIds, isCommentOnly);
        }}
        onReturnToCRM={handleReturnToCRM}
        isSaving={isSaving}
      />
    </div>
  );
}

export default function ManagerReviewPage() {
  return <ManagerReviewQueuePage />;
}
