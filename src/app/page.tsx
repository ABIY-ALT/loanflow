
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, TrendingUp, AlertTriangle, Loader2, AlertCircle } from "lucide-react";
import { getLoanRequests } from '@/services/loan-service-prisma'; // Explicitly using prisma service
import type { LoanRequest } from '@/types/loan';
import { subDays, parseISO, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';

interface DashboardStats {
  activeLoansCount: number;
  newApplicationsCount: number;
  approvalRate: string;
  overdueTasksCount: number;
}

// Default empty stats
const defaultStats: DashboardStats = {
  activeLoansCount: 0,
  newApplicationsCount: 0,
  approvalRate: "N/A",
  overdueTasksCount: 0,
};

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null); // Initialize to null to show loading
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);

  const canViewDashboard = useMemo(() => user?.permissions.includes(PERMISSIONS.VIEW_DASHBOARD), [user]);

  useEffect(() => {
    if (authLoading || !canViewDashboard) {
      if(!authLoading && !canViewDashboard) setIsLoading(false);
      return;
    }

    async function fetchDashboardData() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getLoanRequests(); // This now calls the Prisma-backed service

        if (result.error) {
          console.error("Error from getLoanRequests service in Dashboard:", result.error, result);
          setError(result.error);
          setStats(defaultStats); // Set to default stats on error
        } else if (result.loans) {
          const loans = result.loans;
          
          const activeLoans = loans.filter(loan => !loan.isTerminalStage).length;

          const sevenDaysAgo = subDays(new Date(), 7);
          const newApplications = loans.filter(
            (loan): loan is LoanRequest & { submittedDate: string } => 
              typeof loan.submittedDate === 'string' && isAfter(parseISO(loan.submittedDate), sevenDaysAgo)
          ).length;
          
          const overdueTasks = loans.filter(loan => loan.isOverdue).length;

          const terminalLoans = loans.filter(loan => loan.isTerminalStage);
          const approvedLoansCount = terminalLoans.filter(loan => 
            loan.currentStageName?.toLowerCase().includes('funded') || loan.currentStageName?.toLowerCase().includes('approved')
          ).length;
          const rejectedLoansCount = terminalLoans.filter(loan => 
            loan.currentStageName?.toLowerCase().includes('rejected') || loan.currentStageName?.toLowerCase().includes('terminated')
          ).length;

          const totalCompleted = approvedLoansCount + rejectedLoansCount;
          const approvalRateValue = totalCompleted > 0 ? (approvedLoansCount / totalCompleted) * 100 : 0;
          const approvalRateString = totalCompleted > 0 ? `${approvalRateValue.toFixed(1)}%` : "N/A";

          setStats({
            activeLoansCount: activeLoans,
            newApplicationsCount: newApplications,
            approvalRate: approvalRateString,
            overdueTasksCount: overdueTasks,
          });
        } else {
          setError("No loan data received for dashboard.");
          setStats(defaultStats); // Set to default stats if no data
        }
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        const errorMessage = err.message || "An unexpected error occurred fetching dashboard data.";
        setError(errorMessage);
        setStats(defaultStats); // Set to default stats on catch
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, [authLoading, canViewDashboard]);


  const StatCard = ({ title, value, icon: Icon, description, link, isErrorSource }: { title: string, value: string | number, icon: React.ElementType, description?: string, link?: string, isErrorSource?: boolean }) => {
    const content = (
      <Card className={cn(isErrorSource ? "border-destructive/50 dark:border-destructive hover:shadow-md transition-shadow" : "hover:shadow-md transition-shadow")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={cn("text-sm font-medium", isErrorSource && "text-destructive")}>{title}</CardTitle>
          <Icon className={cn("h-4 w-4 text-muted-foreground", isErrorSource && "text-destructive")} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : error && title === "Active Loans" ? ( 
             <div className="flex items-center text-destructive">
                <AlertCircle className="h-6 w-6 mr-2" />
                <span>Error</span>
            </div>
          ) : (
            <div className={cn("text-2xl font-bold", isErrorSource && "text-destructive")}>{value}</div>
          )}
          {description && !isLoading && (!error || title !== "Active Loans") && <p className="text-xs text-muted-foreground">{description}</p>}
          {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        </CardContent>
      </Card>
    );

    if (link) {
      return <Link href={link} passHref className="block">{content}</Link>;
    }
    return content;
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading dashboard...</p>
      </div>
    );
  }

  if (!canViewDashboard) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You do not have permission to view the dashboard.</p>
        </div>
    );
  }


  if (error && !stats && isLoading) { 
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to LoanFlow</h1>
            <p className="text-muted-foreground">Your central hub for managing loan applications.</p>
          </div>
           <Link href="/loan-requests/new" passHref>
            <Button>New Loan Request</Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="mr-2 h-5 w-5" />
          <AlertTitle>Error Loading Dashboard Data</AlertTitle>
          <AlertDescription>
            <p className="whitespace-pre-wrap">
              Could not load dashboard statistics. Details: {error}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
                Please try refreshing the page. If the issue persists, check the browser console for more details.
            </p>
          </AlertDescription>
        </Alert>
        <Card>
            <CardHeader>
                <CardTitle>Quick Access</CardTitle>
                <CardDescription>Navigate to key areas of the application.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Link href="/loan-process" passHref>
                    <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                        <div className="flex flex-col items-start">
                            <span className="font-semibold">View Loan Pipeline</span>
                            <span className="text-xs text-muted-foreground">Visualize loan stages on the Kanban board.</span>
                        </div>
                    </Button>
                </Link>
                <Link href="/loan-status" passHref>
                    <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                        <div className="flex flex-col items-start">
                            <span className="font-semibold">Loan Status Lookup</span>
                            <span className="text-xs text-muted-foreground">Quickly find loan status using AI.</span>
                        </div>
                    </Button>
                </Link>
                 <Link href="/settings" passHref>
                     <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                        <div className="flex flex-col items-start">
                            <span className="font-semibold">Configure Workflows</span>
                            <span className="text-xs text-muted-foreground">Manage loan stages and timelines.</span>
                        </div>
                    </Button>
                </Link>
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to LoanFlow</h1>
          <p className="text-muted-foreground">Your central hub for managing loan applications.</p>
        </div>
        <Link href="/loan-requests/new" passHref>
          <Button>New Loan Request</Button>
        </Link>
      </div>

      {error && !isLoading && ( 
          <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Dashboard Update Error</AlertTitle> 
              <AlertDescription>{error} Some statistics might not be up-to-date.</AlertDescription> 
          </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Loans"
          value={isLoading ? "-" : (stats?.activeLoansCount ?? 0)}
          icon={Briefcase}
          description={isLoading ? "Loading..." : `${stats?.activeLoansCount ?? 0} loans currently being processed`}
        />
        <StatCard
          title="New Applications (7 days)"
          value={isLoading ? "-" : (stats?.newApplicationsCount ?? 0)}
          icon={Users}
          description={isLoading ? "Loading..." : `${stats?.newApplicationsCount ?? 0} new loans in the last week`}
        />
        <StatCard
          title="Approval Rate"
          value={isLoading ? "-" : (stats?.approvalRate ?? "N/A")}
          icon={TrendingUp}
          description={isLoading ? "Loading..." : "Based on all completed loans"}
        />
        <StatCard
          title="Overdue Tasks"
          value={isLoading ? "-" : (stats?.overdueTasksCount ?? 0)}
          icon={AlertTriangle}
          description={isLoading ? "Loading..." : (stats?.overdueTasksCount ?? 0) > 0 ? "Require immediate attention" : "All tasks on schedule"}
          link="/overdue-tasks"
          isErrorSource={!isLoading && !error && stats ? (stats.overdueTasksCount > 0) : false}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Access</CardTitle>
          <CardDescription>Navigate to key areas of the application.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/loan-process" passHref>
                 <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                    <div className="flex flex-col items-start">
                        <span className="font-semibold">View Loan Pipeline</span>
                        <span className="text-xs text-muted-foreground">Visualize loan stages on the Kanban board.</span>
                    </div>
                </Button>
            </Link>
            <Link href="/loan-status" passHref>
                 <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                    <div className="flex flex-col items-start">
                        <span className="font-semibold">Loan Status Lookup</span>
                        <span className="text-xs text-muted-foreground">Quickly find loan status using AI.</span>
                    </div>
                </Button>
            </Link>
             <Link href="/settings" passHref>
                 <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                    <div className="flex flex-col items-start">
                        <span className="font-semibold">Configure Workflows</span>
                        <span className="text-xs text-muted-foreground">Manage loan stages and timelines.</span>
                    </div>
                </Button>
            </Link>
        </CardContent>
      </Card>
    </div>
  );
}
