'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { getDistrictDashboardAnalytics } from '@/services/loan-service-prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertCircle,
  Briefcase,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  PieChartIcon,
  MapPin,
  Users,
  RefreshCw,
  ArrowLeft,
  Building2,
  FileDown,
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { LoanRequest, User } from '@/types/loan';

const formatCompactETB = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B ETB`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ETB`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K ETB`;
  return `${value.toLocaleString()} ETB`;
};

const COLORS = [
  'hsl(45, 100%, 52%)',   // Honey primary
  'hsl(217, 91%, 60%)',   // Blue
  'hsl(173, 80%, 36%)',   // Teal
  'hsl(142, 71%, 45%)',   // Green
  'hsl(280, 65%, 60%)',   // Purple
  'hsl(30, 80%, 60%)',    // Orange
];

export default function DistrictDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  
  // Data State
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [crms, setCrms] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [crmFilter, setCrmFilter] = useState('all');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  const canViewDashboard = useMemo(
    () => user?.permissions.includes(PERMISSIONS.VIEW_OWN_SUBMITTED_CASES),
    [user]
  );

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDistrictDashboardAnalytics();
      if (result.error) {
        setError(result.error);
      } else {
        setLoans(result.loans || []);
        setBranches(result.branches || []);
        setCrms(result.crms || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!canViewDashboard) {
      setIsLoading(false);
      return;
    }
    fetchData();
  }, [authLoading, canViewDashboard]);

  // Derived Filtered Data
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const matchesSearch = 
        loan.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBranch = branchFilter === 'all' || loan.customerBranch === branchFilter;
      
      const matchesCrm = crmFilter === 'all' || loan.createdById === crmFilter;
      
      const loanAmt = Number(loan.loanAmount);
      const matchesMin = !amountMin || loanAmt >= Number(amountMin);
      const matchesMax = !amountMax || loanAmt <= Number(amountMax);

      return matchesSearch && matchesBranch && matchesCrm && matchesMin && matchesMax;
    });
  }, [loans, searchTerm, branchFilter, crmFilter, amountMin, amountMax]);

  // Derived Analytics from Filtered Data
  const analytics = useMemo(() => {
    const activeLoans = filteredLoans.filter(l => !l.isTerminalStage);
    const completedLoans = filteredLoans.filter(l => l.isTerminalStage);
    const totalValue = filteredLoans.reduce((sum, l) => sum + Number(l.loanAmount), 0);
    const activeValue = activeLoans.reduce((sum, l) => sum + Number(l.loanAmount), 0);
    const overdueCount = filteredLoans.filter(l => l.isOverdue).length;
    const awaitingReviewCount = filteredLoans.filter(l => l.isReadyForManagerReview).length;

    // Branch Performance
    const branchMap = new Map<string, { count: number, value: number }>();
    filteredLoans.forEach(l => {
      const branch = l.customerBranch || 'Unknown';
      const stats = branchMap.get(branch) || { count: 0, value: 0 };
      stats.count += 1;
      stats.value += Number(l.loanAmount);
      branchMap.set(branch, stats);
    });
    const branchData = Array.from(branchMap.entries())
      .map(([name, stats]) => ({ name, count: stats.count, value: stats.value }))
      .sort((a, b) => b.value - a.value);

    // Stage Distribution
    const stageMap = new Map<string, number>();
    activeLoans.forEach(l => {
      const stage = l.currentStageName || 'Initial Stage';
      stageMap.set(stage, (stageMap.get(stage) || 0) + 1);
    });
    const stageData = Array.from(stageMap.entries()).map(([name, value]) => ({ name, value }));

    // Analyst Load
    const analystMap = new Map<string, number>();
    activeLoans.forEach(l => {
      l.assignedToUsers.forEach(u => {
        if (u.customRoleName?.toLowerCase().includes('analyst') || u.customRoleName?.toLowerCase().includes('appraisal')) {
          analystMap.set(u.fullName, (analystMap.get(u.fullName) || 0) + 1);
        }
      });
    });
    const analystData = Array.from(analystMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      metrics: {
        totalCount: filteredLoans.length,
        activeCount: activeLoans.length,
        completedCount: completedLoans.length,
        overdueCount,
        awaitingReviewCount,
        totalValue,
        activeValue,
      },
      branchData,
      stageData,
      analystData,
    };
  }, [filteredLoans]);

  const handleExportCSV = () => {
    const headers = [
      'Loan Number', 'Customer', 'Branch', 'Amount (ETB)', 'Status', 'Current Stage', 'Created By', 'Submitted Date'
    ];
    
    const rows = filteredLoans.map(l => [
      l.loanNumber,
      l.customerName,
      l.customerBranch || 'N/A',
      l.loanAmount,
      l.isTerminalStage ? 'Completed' : (l.isOverdue ? 'Overdue' : 'Active'),
      l.currentStageName || 'N/A',
      l.createdById || 'Unknown',
      format(new Date(l.submittedDate), 'yyyy-MM-dd')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `district_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setBranchFilter('all');
    setCrmFilter('all');
    setAmountMin('');
    setAmountMax('');
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg mt-4 animate-pulse">Gathering district intel...</p>
      </div>
    );
  }

  if (!canViewDashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Unauthorized</h1>
        <p className="text-muted-foreground mb-6">District Director access is required for this view.</p>
        <Button onClick={() => router.push('/')}>Return to Base</Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Data Retrieval Error</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Retry Connection
        </Button>
      </div>
    );
  }

  const activeFilterCount = [
    searchTerm ? 1 : 0,
    branchFilter !== 'all' ? 1 : 0,
    crmFilter !== 'all' ? 1 : 0,
    amountMin ? 1 : 0,
    amountMax ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
             </Button>
             <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
               <MapPin className="h-3 w-3 mr-1" /> District Operations
             </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {user?.districtName || 'District'} Command Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Advanced monitoring for portfolio performance and branch activity.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCSV} disabled={filteredLoans.length === 0}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>
          <Button className="gap-2" onClick={fetchData}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <Card className="border-primary/5 shadow-sm">
        <CardHeader 
          className="py-3 px-6 cursor-pointer select-none hover:bg-muted/30 transition-colors"
          onClick={() => setShowFilters(!showFilters)}
        >
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Discovery Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
           </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="px-6 pb-6 pt-2 space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search Number or Customer..." 
                    className="pl-10 h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={crmFilter} onValueChange={setCrmFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All District CRMs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All District CRMs</SelectItem>
                    {crms.map(c => <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 lg:col-span-1">
                   <Input 
                    type="number" 
                    placeholder="Min Amt" 
                    className="h-9" 
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                   />
                   <span className="text-muted-foreground">-</span>
                   <Input 
                    type="number" 
                    placeholder="Max Amt" 
                    className="h-9" 
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                   />
                </div>
             </div>
             {activeFilterCount > 0 && (
               <div className="flex justify-end pt-2">
                 <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 text-muted-foreground hover:text-destructive">
                   <X className="h-3 w-3 mr-1" /> Clear All Filters
                 </Button>
               </div>
             )}
          </CardContent>
        )}
      </Card>

      {/* Metric Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'District Portfolio', value: formatCompactETB(analytics.metrics.totalValue), subtitle: `${analytics.metrics.totalCount} total cases`, icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
          { title: 'Active Pipeline', value: formatCompactETB(analytics.metrics.activeValue), subtitle: `${analytics.metrics.activeCount} live loans`, icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { title: 'Overdue Attention', value: analytics.metrics.overdueCount, subtitle: 'Urgent follow-up needed', icon: AlertTriangle, color: analytics.metrics.overdueCount > 0 ? 'text-red-500' : 'text-emerald-500', bg: analytics.metrics.overdueCount > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10' },
          { 
            title: 'Awaiting Manager Review', 
            value: analytics.metrics.awaitingReviewCount, 
            subtitle: 'Ready for assignment', 
            icon: Users, 
            color: analytics.metrics.awaitingReviewCount > 0 ? 'text-amber-500' : 'text-muted-foreground', 
            bg: 'bg-amber-500/10',
            onClick: () => router.push('/manager-review')
          },
        ].map((card) => (
          <Card 
            key={card.title} 
            className={cn(
              "relative overflow-hidden border-primary/5 shadow-sm transition-all",
              card.onClick && "cursor-pointer hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 shadow-amber-500/5"
            )}
            onClick={card.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">{card.subtitle}</p>
              {card.title === 'Awaiting Manager Review' && Number(card.value) > 0 && (
                <div className="absolute bottom-1 right-2">
                   <div className="flex items-center text-[8px] font-bold text-amber-600 animate-pulse">
                      ACTION REQUIRED <ChevronDown className="h-2 w-2 ml-0.5 -rotate-90" />
                   </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branch Visualization */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-bold">Branch Performance Benchmark</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-[320px] pt-4">
            {analytics.branchData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.branchData} layout="vertical" margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border shadow-xl rounded-lg p-3 text-xs">
                            <p className="font-bold mb-1 text-primary">{payload[0].payload.name}</p>
                            <div className="space-y-1">
                              <p className="flex justify-between gap-4"><span>Value:</span> <span className="font-mono">{formatCompactETB(payload[0].value as number)}</span></p>
                              <p className="flex justify-between gap-4 text-muted-foreground"><span>Cases:</span> <span className="font-mono">{payload[0].payload.count}</span></p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(45, 100%, 52%)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : <NoDataView />}
          </CardContent>
        </Card>

        {/* Stage Visualization */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <PieChartIcon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base font-bold">Pipeline Stage Saturation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-[320px] pt-4">
            {analytics.stageData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.stageData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {analytics.stageData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border shadow-xl rounded-lg p-2 text-[10px]">
                            <p className="font-bold mb-1">{payload[0].name}</p>
                            <p className="text-primary font-mono">{payload[0].value} Cases</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <NoDataView />}
          </CardContent>
        </Card>
      </div>

      {/* Personnel Workload Oversight */}
      <Card className="border-primary/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Users className="h-4 w-4" />
             </div>
             <div>
                <CardTitle className="text-base">Staff Workload Balance</CardTitle>
                <CardDescription className="text-xs">Active capacity monitoring for district personnel.</CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent>
           {analytics.analystData.length > 0 ? (
             <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-bold uppercase">Personnel</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-center">Active Load</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">Capacity Index</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {analytics.analystData.map((analyst) => {
                     const cap = 10;
                     const util = Math.min((analyst.count / cap) * 100, 100);
                     return (
                       <TableRow key={analyst.name}>
                         <TableCell className="text-sm font-semibold">{analyst.name}</TableCell>
                         <TableCell className="text-center">
                            <Badge variant="outline" className="px-3 font-mono text-xs">{analyst.count}</Badge>
                         </TableCell>
                         <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-3">
                               <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className={cn("h-full transition-all duration-1000", util > 85 ? "bg-red-500" : util > 60 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${util}%` }} />
                               </div>
                               <span className="text-[10px] font-mono font-bold w-8">{Math.round(util)}%</span>
                            </div>
                         </TableCell>
                       </TableRow>
                     );
                   })}
                </TableBody>
             </Table>
           ) : <NoDataView text="No personnel assignments detected with current filters." />}
        </CardContent>
      </Card>
    </div>
  );
}

function NoDataView({ text = "No records found matching current discovery parameters." }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
      <AlertCircle className="h-8 w-8 mb-2" />
      <p className="text-xs font-medium max-w-[200px]">{text}</p>
    </div>
  );
}
