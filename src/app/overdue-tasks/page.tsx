'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ExternalLink, Clock, Loader2, AlertCircle, Building, User, Users, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getLoanRequests, getDepartments } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { format, parseISO } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { Alert, AlertDescription as AlertDescShadCN, AlertTitle as AlertTitleShadCN } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type OverdueFilter = 'all' | 'department' | 'my-assigned';

export default function OverdueTasksPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [allOverdueLoans, setAllOverdueLoans] = useState<LoanRequest[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<{id: string, name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filter, setFilter] = useState<OverdueFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  const canViewPage = user?.permissions.includes(PERMISSIONS.VIEW_OVERDUE_TASKS_REPORT);

  useEffect(() => {
    if (authLoading || !canViewPage) {
        if(!authLoading && !canViewPage) setIsLoading(false);
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

        if (loansResult.error) {
          setError(loansResult.error);
          setAllOverdueLoans([]);
        } else if (loansResult.loans) {
          setAllOverdueLoans(loansResult.loans.filter((loan) => loan.isOverdue));
        } else {
          setError(`No loan data received.`);
          setAllOverdueLoans([]);
        }

        if (deptsResult.departments) {
          setAvailableDepartments(deptsResult.departments);
        }

      } catch (err: any) {
        const errorMessage = err.message || "An unknown error occurred fetching page data.";
        setError(errorMessage);
        setAllOverdueLoans([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
  }, [authLoading, canViewPage]);

  const filteredLoans = useMemo(() => {
    let list = [...allOverdueLoans];

    // 1. Core Scoping (Tabs)
    if (filter === 'my-assigned') {
      list = list.filter(l => l.assignedToUsers.some(u => u.id === user?.id));
    } else if (filter === 'department') {
      list = list.filter(l => l.assignedDepartment === user?.department);
    }

    // 2. Specific Department Filter (Dropdown)
    if (selectedDept !== 'all') {
      list = list.filter(l => l.assignedDepartment === selectedDept);
    }

    // 3. Search Filter (Name or ID)
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(l => 
        l.customerName.toLowerCase().includes(lowerSearch) || 
        l.loanNumber.toLowerCase().includes(lowerSearch)
      );
    }

    return list;
  }, [allOverdueLoans, filter, user, searchTerm, selectedDept]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading overdue tasks...</p>
      </div>
    );
  }

  if (!canViewPage) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view overdue tasks.</p>
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
            <AlertTriangle className="mr-3 h-8 w-8 text-destructive" />
            Overdue Loan Tasks
          </h1>
          <p className="text-muted-foreground">
            These loan requests have passed their stage deadlines and require attention.
          </p>
        </div>
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      
      {error && (
         <Alert variant="destructive" className="max-w-2xl mx-auto whitespace-pre-wrap">
            <AlertCircle className="h-5 w-5" />
            <AlertTitleShadCN>Partial Data Error</AlertTitleShadCN>
            <AlertDescriptionShadCN>There was an issue loading some data: {error}</AlertDescriptionShadCN>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or loan ID..." 
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
            <SelectValue placeholder="Select Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {availableDepartments.map(dept => (
              <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all" value={filter} onValueChange={(v) => setFilter(v as OverdueFilter)} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all" className="gap-2"><Users className="h-4 w-4"/> All Overdue ({allOverdueLoans.length})</TabsTrigger>
          <TabsTrigger value="department" className="gap-2"><Building className="h-4 w-4"/> My Dept ({allOverdueLoans.filter(l => l.assignedDepartment === user?.department).length})</TabsTrigger>
          <TabsTrigger value="my-assigned" className="gap-2"><User className="h-4 w-4"/> My Assigned ({allOverdueLoans.filter(l => l.assignedToUsers.some(u => u.id === user?.id)).length})</TabsTrigger>
        </TabsList>

        <Card>
          <CardHeader>
            <CardTitle>Overdue Items ({filteredLoans.length})</CardTitle>
            <CardDescription>
              Review the details and take appropriate action for each overdue loan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLoans.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                <AlertCircle className="mx-auto h-12 w-12 opacity-20 mb-4" />
                <p className="text-lg font-semibold">No Overdue Tasks Found</p>
                <p>All loan requests in this view match your current schedule or filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Loan Number</TableHead>
                      <TableHead>Current Stage</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Stage Deadline</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan: LoanRequest) => (
                      <TableRow key={loan.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{loan.customerName}</TableCell>
                        <TableCell>{loan.loanNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{loan.currentStageName || 'Unknown Stage'}</Badge>
                        </TableCell>
                        <TableCell>{loan.assignedDepartment || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          {loan.stageDeadline ? (
                            <span className="text-destructive font-semibold flex items-center justify-end">
                              <Clock className="mr-1 h-4 w-4" />
                              {format(parseISO(loan.stageDeadline), 'MMM dd, yyyy')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Link href={`/loan-requests/${loan.id}`} passHref>
                            <Button variant="ghost" size="sm">
                              View Details
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </Button>
                          </Link>
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
