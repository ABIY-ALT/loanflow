
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">152</div>
            <p className="text-xs text-muted-foreground">+12 since last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">34</div>
            <p className="text-xs text-muted-foreground">+5 in the last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78.5%</div>
            <p className="text-xs text-muted-foreground">+2.1% from last month</p>
          </CardContent>
        </Card>
        <Link href="/overdue-tasks" passHref className="block">
          <Card className="border-destructive/50 dark:border-destructive hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Overdue Tasks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">7</div>
              <p className="text-xs text-muted-foreground">Require immediate attention</p>
            </CardContent>
          </Card>
        </Link>
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
