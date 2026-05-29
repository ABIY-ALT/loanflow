'use client';

import Link from 'next/link';
import { ArrowLeft, FolderKanban, ExternalLink, Loader2, AlertCircle, Flame, History, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests, getDepartments } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function getPendingAssignmentKey(loan: LoanRequest) {
  return [
    loan.customerId,
    loan.loanAmount,
    loan.sectorId,
    loan.requestTypeId,
    loan.loanPurpose.trim().toLowerCase(),
    loan.assignedDepartmentId || loan.assignedDepartment || '',
    loan.currentStageId || loan.currentStageName || '',
    loan.workflowVersionId || '',
    loan.submissionType || '',
  ].join('|');
}

function dedupePendingAssignmentLoans(loans: LoanRequest[]) {
  const latestByCase = new Map<string, LoanRequest>();

  for (const loan of loans) {
    // Prefer a stable unique identifier when available (loan.id),
    // otherwise fall back to the computed fingerprint used previously.
    const key = loan.id || getPendingAssignmentKey(loan);
    const existing = latestByCase.get(key);

    if (!existing || new Date(loan.lastUpdatedDate).getTime() > new Date(existing.lastUpdatedDate).getTime()) {
      latestByCase.set(key, loan);
    }
  }

  return Array.from(latestByCase.values());
}

export default function DepartmentQueuePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [unassignedLoans, setUnassignedLoans] = useState<LoanRequest[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<{id: string, name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  const canViewPage = user?.permissions.includes(PERMISSIONS.VIEW_UNASSIGNED_CASES_QUEUE);

  useEffect(() => {
    if (authLoading || !canViewPage) {
      if (!authLoading && !canViewPage) setIsLoading(false);
      return;
    }

    async function fetchPageData() {
      setIsLoading(true);
      setError(null);
      try {
        const [loansResult, deptsResult] = await Promise.all([
          getLoanRequests(),
          getDepartments()
        ]);

        if ('error' in loansResult && loansResult.error) {
          setError(loansResult.error);
          setUnassignedLoans([]);
        } else if ('loans' in loansResult && loansResult.loans) {
          // Filter for active cases in the department that have no assigned staff
          const filteredLoans = loansResult.loans.filter((loan: LoanRequest) =>
            loan.assignedToUsers.length === 0 && !loan.isReadyForManagerReview && !loan.isTerminalStage
          );
          setUnassignedLoans(dedupePendingAssignmentLoans(filteredLoans));
        }

        if (deptsResult.departments) {
          setAvailableDepartments(deptsResult.departments);
        }
        
        // Default to user's department if available
        if (user?.department) {
          setSelectedDept(user.department);
        }

      } catch (err: any) {
        setError(err.message || "An error occurred fetching data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
  }, [authLoading, canViewPage, user?.department]);

  const filteredLoans = useMemo(() => {
    let list = [...unassignedLoans];
    
    // 1. Filter by Department
    if (selectedDept !== 'all') {
      list = list.filter(l => l.assignedDepartment === selectedDept);
    }

    // 2. Filter by Search (Name or ID)
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(l => 
        l.customerName.toLowerCase().includes(lowerSearch) || 
        l.loanNumber.toLowerCase().includes(lowerSearch)
      );
    }

    return list.sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime();
    });
  }, [unassignedLoans, searchTerm, selectedDept]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading unassigned cases...</p>
      </div>
    );
  }

  if (!canViewPage) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view the unassigned cases queue.</p>
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
            <FolderKanban className="mr-3 h-8 w-8 text-primary" />
            Department Queue (Unassigned Staff)
          </h1>
          <p className="text-muted-foreground">
            These loans are awaiting assignment to a specific staff member.
          </p>
        </div>
        <Link href="/" passHref><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or ID..." 
            className="pl-10" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Select value={selectedDept} onValueChange={setSelectedDept}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {availableDepartments.map(dept => (
              <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cases Awaiting Staff Assignment ({filteredLoans.length})</CardTitle>
          <CardDescription>
            Assign these loans to staff members to begin processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLoans.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl">
              <FolderKanban className="mx-auto h-12 w-12 opacity-20 mb-4" />
              <p className="text-lg font-semibold">Queue is Clear</p>
              <p>No unassigned cases match your current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Urgent</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan: LoanRequest) => (
                    <TableRow key={loan.id} className={cn("hover:bg-muted/50", loan.isUrgent && "bg-red-50/50")}>
                      <TableCell className="text-center">
                        {loan.isUrgent && <Flame className="h-5 w-5 text-red-500 animate-pulse" />}
                      </TableCell>
                      <TableCell className="font-medium">{loan.customerName}</TableCell>
                      <TableCell className="font-mono text-xs">{loan.loanNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-muted/30">{loan.assignedDepartment}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{loan.currentStageName || 'Unknown Stage'}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{loan.parentSectorName}</div>
                        <div className="text-muted-foreground">{loan.sectorName}</div>
                      </TableCell>
                      <TableCell className="text-xs">{format(parseISO(loan.lastUpdatedDate), 'MMM dd, HH:mm')}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/loan-requests/${loan.id}?tab=history`} passHref title="View Audit Trail">
                            <Button variant="ghost" size="icon">
                              <History className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/loan-requests/${loan.id}`} passHref>
                            <Button variant="ghost" size="sm">View & Assign <ExternalLink className="ml-2 h-3 w-3" /></Button>
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
