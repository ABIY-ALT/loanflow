'use client';

import Link from 'next/link';
import { ArrowLeft, FolderKanban, ExternalLink, Loader2, AlertCircle, Building, Flame, History, Briefcase, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests, getDepartments } from '@/services/loan-service-prisma';
import { getSectors } from '@/services/sector-and-request-type-service';
import type { LoanRequest, Sector, Department } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DepartmentQueuePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [unassignedLoans, setUnassignedLoans] = useState<LoanRequest[]>([]);
  const [parentSectors, setParentSectors] = useState<Sector[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<{id: string, name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [activeTab, setActiveTab] = useState<string>('all');
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
        const [loansResult, sectorsResult, deptsResult] = await Promise.all([
          getLoanRequests(),
          getSectors(),
          getDepartments()
        ]);

        if (loansResult.error) {
          setError(loansResult.error);
          setUnassignedLoans([]);
        } else if (loansResult.loans) {
          // We fetch all loans and filter for unassigned cases in the service layer (if scoped)
          // but we apply stricter "unassigned" logic here for the specific queue view
          const filteredLoans = loansResult.loans.filter(loan =>
            loan.assignedToUsers.length === 0 && !loan.isReadyForManagerReview && !loan.isTerminalStage
          );
          setUnassignedLoans(filteredLoans);
        }

        if (sectorsResult.sectors) {
          setParentSectors(sectorsResult.sectors.filter(s => !s.parentId));
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

    // 2. Filter by Sector Tab
    if (activeTab !== 'all') {
      list = list.filter(l => l.parentSectorId === activeTab);
    }

    // 3. Filter by Search (Name or ID)
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
  }, [unassignedLoans, activeTab, searchTerm, selectedDept]);

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

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto p-1 bg-muted/50 border">
          <TabsTrigger value="all" className="gap-2"><FolderKanban className="h-4 w-4"/> All Unassigned</TabsTrigger>
          {parentSectors.map(sector => (
            <TabsTrigger key={sector.id} value={sector.id} className="gap-2">
              <Briefcase className="h-4 w-4"/> {sector.name}
            </TabsTrigger>
          ))}
        </TabsList>

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
      </Tabs>
    </div>
  );
}
