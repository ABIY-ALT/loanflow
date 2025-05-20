
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, TrendingUp, AlertTriangle, Loader2, AlertCircle } from "lucide-react";
import { getLoanRequests } from '@/services/loan-service';
import type { LoanRequest } from '@/types/loan';
import { LoanStage } from '@/types/loan';
import { subDays, parseISO, isAfter } from 'date-fns';

interface DashboardStats {
  activeLoansCount: number;
  newApplicationsCount: number;
  approvalRate: string; // Keeping as string/placeholder for now
  overdueTasksCount: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      setError(null);
      try {
        const loans = await getLoanRequests();
        
        const activeLoans = loans.filter(
          loan => ![LoanStage.REJECTED, LoanStage.FUNDS_DISBURSED].includes(loan.currentStage)
        ).length;

        const sevenDaysAgo = subDays(new Date(), 7);
        const newApplications = loans.filter(
          loan => isAfter(parseISO(loan.submittedDate), sevenDaysAgo)
        ).length;

        const overdueTasks = loans.filter(loan => loan.isOverdue).length;

        setStats({
          activeLoansCount: activeLoans,
          newApplicationsCount: newApplications,
          approvalRate: "78.5%", // Placeholder
          overdueTasksCount: overdueTasks,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred while fetching dashboard data.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

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
          ) : (
            <div className={cn("text-2xl font-bold", isErrorSource && "text-destructive")}>{value}</div>
          )}
          {description && !isLoading && <p className="text-xs text-muted-foreground">{description}</p>}
          {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        </CardContent>
      </Card>
    );

    if (link) {
      return <Link href={link} passHref className="block">{content}</Link>;
    }
    return content;
  };


  if (error) {
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
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertCircle className="mr-2 h-5 w-5" />
              Error Loading Dashboard Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page. If the problem persists, check the console or contact support.</p>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Loans"
          value={stats?.activeLoansCount ?? (isLoading ? '' : 0)}
          icon={Briefcase}
          // description="+12 since last month" // Dynamic description would need more data
        />
        <StatCard
          title="New Applications (7 days)"
          value={stats?.newApplicationsCount ?? (isLoading ? '' : 0)}
          icon={Users}
          // description="+5 in the last week"
        />
        <StatCard
          title="Approval Rate"
          value={stats?.approvalRate ?? (isLoading ? '' : "N/A")} // Static for now
          icon={TrendingUp}
          description={isLoading ? "" : "vs last month (placeholder)"}
        />
        <StatCard
          title="Overdue Tasks"
          value={stats?.overdueTasksCount ?? (isLoading ? '' : 0)}
          icon={AlertTriangle}
          description={isLoading ? "" : "Require immediate attention"}
          link="/overdue-tasks"
          isErrorSource={true}
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

// Helper to cn class names
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
