'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { subDays, parseISO, startOfYear, isAfter, isBefore, isSameMonth, format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { PERMISSIONS } from '@/lib/permissions';
import { getLoanRequests } from '@/services/loan-service-prisma';
import type { LoanRequest } from '@/types/loan';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import {
  Search,
  SlidersHorizontal,
  FileDown,
  Loader2,
  AlertCircle,
  Briefcase,
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChartIcon,
  X,
  Eye,
  ExternalLink,
} from 'lucide-react';

const statusOptions = ['All', 'Active', 'Pending', 'Approved', 'Disbursed', 'Overdue', 'Terminated', 'Closed'] as const;
const sectorOptions = ['All', 'Construction Manufacturing and Agriculture Sector Department', 'Institutional Banking and Hospitality and Green Financing Sector', 'Service sector Department'] as const;
const dateRangeOptions = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This Year', 'Custom Date'] as const;

type StatusFilter = (typeof statusOptions)[number];
type SectorFilter = (typeof sectorOptions)[number];
type DateRangeFilter = (typeof dateRangeOptions)[number];

type HighLevelStage =
  | 'New Request'
  | 'Valuation'
  | 'Appraisal'
  | 'Credit Approval'
  | 'Contract & Collateral'
  | 'Disbursed'
  | 'Active/Monitoring'
  | 'Non-Performing'
  | 'Closed';

const ITEMS_PER_PAGE = 10;

const formatETB = (value: number) => `${value.toLocaleString()} ETB`;
const formatCompactETB = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B ETB`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ETB`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K ETB`;
  return `${value.toLocaleString()} ETB`;
};

const getHighLevelStage = (loan: LoanRequest): HighLevelStage => {
  const stageName = (loan.currentStageName || '').toLowerCase();

  if (stageName.includes('non-performing') || stageName.includes('npl')) return 'Non-Performing';
  if (loan.isTerminalStage && stageName.includes('closed')) return 'Closed';
  if (loan.isTerminalStage && (stageName.includes('terminated') || stageName.includes('rejected'))) return 'Closed';
  if (stageName.includes('disbur') || stageName.includes('funded')) return 'Disbursed';
  if (stageName.includes('contract') || stageName.includes('collateral')) return 'Contract & Collateral';
  if (stageName.includes('approval') || stageName.includes('cat')) return 'Credit Approval';
  if (stageName.includes('appraisal')) return 'Appraisal';
  if (stageName.includes('valuation')) return 'Valuation';
  if (stageName.includes('monitor')) return 'Active/Monitoring';

  return 'New Request';
};

const getLoanStatus = (loan: LoanRequest): StatusFilter => {
  const stageName = (loan.currentStageName || '').toLowerCase();

  if (loan.isTerminalStage) {
    if (stageName.includes('closed')) return 'Closed';
    if (stageName.includes('terminated') || stageName.includes('rejected')) return 'Terminated';
    if (stageName.includes('approved') || stageName.includes('funded') || stageName.includes('disbur')) return 'Approved';
    return 'Closed';
  }

  if (loan.isOverdue) return 'Overdue';
  if (stageName.includes('approval') || stageName.includes('cat')) return 'Pending';
  if (stageName.includes('disbur')) return 'Disbursed';

  return 'Active';
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    Disbursed: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    Overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    Terminated: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
    Closed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  };
  return colors[status] || 'bg-secondary text-secondary-foreground';
};

const getSectorLabel = (loan: LoanRequest) => {
  const original = loan.parentSectorName || loan.sectorName || 'Unknown';
  if (original.includes('Manufacturing') || original.includes('Agriculture')) return 'Construction Manufacturing and Agriculture Sector Department';
  if (original.includes('Institutional Banking') || original.includes('Green Financing')) return 'Institutional Banking and Hospitality and Green Financing Sector';
  if (original.includes('Service') || original.includes('Mining')) return 'Service sector Department';
  return original;
};

const matchesSectorFilter = (loan: LoanRequest, filter: SectorFilter) => {
  if (filter === 'All') return true;
  return getSectorLabel(loan) === filter;
};

const getRelationshipManager = (loan: LoanRequest) => {
  const manager = loan.assignedToUsers?.[0];
  return manager?.fullName || manager?.email || 'Unassigned';
};

export default function ExecutiveOverviewPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>('All');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('This Year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [relationshipManager, setRelationshipManager] = useState('All');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [showFilters, setShowFilters] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [overviewLoan, setOverviewLoan] = useState<LoanRequest | null>(null);

  const canViewDashboard = useMemo(
    () => user?.permissions.includes(PERMISSIONS.VIEW_EXECUTIVE_OVERVIEW),
    [user]
  );

  const handleExport = () => {
    const rows = sortedFilteredLoans.map((loan) => ({
      loanId: loan.loanNumber,
      customerName: loan.customerName,
      sector: getSectorLabel(loan),
      amountETB: loan.loanAmount,
      applicationDate: format(parseISO(loan.submittedDate), 'yyyy-MM-dd'),
      status: getLoanStatus(loan),
      currentStage: getHighLevelStage(loan),
      relationshipManager: getRelationshipManager(loan),
      lastUpdated: format(parseISO(loan.lastUpdatedDate), 'yyyy-MM-dd'),
    }));

    const headers = [
      'Loan ID',
      'Customer Name',
      'Sector',
      'Amount (ETB)',
      'Application Date',
      'Current / Final Status',
      'Current Stage',
      'Relationship Manager',
      'Last Updated',
    ];

    const escapeCsv = (value: unknown) => {
      const str = String(value ?? '');
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [
      headers.join(','),
      ...rows.map((row) => [
        row.loanId,
        row.customerName,
        row.sector,
        row.amountETB,
        row.applicationDate,
        row.status,
        row.currentStage,
        row.relationshipManager,
        row.lastUpdated,
      ].map(escapeCsv).join(',')),
    ];

    const blob = new Blob([`\uFEFF${csvLines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `executive-overview-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (authLoading || !canViewDashboard) {
      if (!authLoading) setIsLoading(false);
      return;
    }

    const fetchLoans = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getLoanRequests();
        if (result.error) {
          setError(result.error);
          setLoans([]);
        } else if ('loans' in result && result.loans) {
          setLoans(result.loans);
        } else {
          setLoans([]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch loan data.');
        setLoans([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLoans();
  }, [authLoading, canViewDashboard]);

  const relationshipManagers = useMemo(() => {
    const managers = new Set<string>();
    loans.forEach((loan) => {
      managers.add(getRelationshipManager(loan));
    });
    return Array.from(managers).sort();
  }, [loans]);

  const filteredLoans = useMemo(() => {
    let filtered = [...loans];

    if (searchTerm) {
      const needle = searchTerm.toLowerCase();
      filtered = filtered.filter((loan) =>
        loan.loanNumber.toLowerCase().includes(needle) ||
        loan.customerName.toLowerCase().includes(needle) ||
        loan.loanAmount.toString().includes(needle)
      );
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter((loan) => getLoanStatus(loan) === statusFilter);
    }

    if (sectorFilter !== 'All') {
      filtered = filtered.filter((loan) => matchesSectorFilter(loan, sectorFilter));
    }

    if (relationshipManager !== 'All') {
      filtered = filtered.filter((loan) => getRelationshipManager(loan) === relationshipManager);
    }

    if (amountMin) {
      const minValue = Number(amountMin);
      if (!Number.isNaN(minValue)) {
        filtered = filtered.filter((loan) => loan.loanAmount >= minValue);
      }
    }

    if (amountMax) {
      const maxValue = Number(amountMax);
      if (!Number.isNaN(maxValue)) {
        filtered = filtered.filter((loan) => loan.loanAmount <= maxValue);
      }
    }

    if (dateRange) {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = now;

      if (dateRange === 'Last 7 days') startDate = subDays(now, 7);
      if (dateRange === 'Last 30 days') startDate = subDays(now, 30);
      if (dateRange === 'Last 90 days') startDate = subDays(now, 90);
      if (dateRange === 'This Year') startDate = startOfYear(now);
      if (dateRange === 'Custom Date') {
        startDate = customFrom ? parseISO(customFrom) : null;
        endDate = customTo ? parseISO(customTo) : null;
      }

      if (startDate) {
        filtered = filtered.filter((loan) => isAfter(parseISO(loan.submittedDate), startDate as Date));
      }
      if (endDate) {
        filtered = filtered.filter((loan) => isBefore(parseISO(loan.submittedDate), endDate as Date));
      }
    }

    if (selectedSector) {
      filtered = filtered.filter((loan) => getSectorLabel(loan) === selectedSector);
    }

    return filtered;
  }, [
    loans,
    searchTerm,
    statusFilter,
    sectorFilter,
    relationshipManager,
    amountMin,
    amountMax,
    dateRange,
    customFrom,
    customTo,
    selectedSector,
  ]);

  // Reset history page when filters change
  useEffect(() => {
    setHistoryPage(1);
  }, [searchTerm, statusFilter, sectorFilter, relationshipManager, amountMin, amountMax, dateRange, customFrom, customTo, selectedSector]);

  const metrics = useMemo(() => {
    const activeLoans = filteredLoans.filter((loan) => !loan.isTerminalStage);
    const totalActiveValue = activeLoans.reduce((sum, loan) => sum + loan.loanAmount, 0);

    const pendingApprovals = filteredLoans.filter((loan) => getLoanStatus(loan) === 'Pending');

    const thisMonthDisbursed = filteredLoans.filter((loan) => {
      const stageName = (loan.currentStageName || '').toLowerCase();
      return stageName.includes('disbur') && isSameMonth(parseISO(loan.lastUpdatedDate), new Date());
    });

    const overdueLoans = filteredLoans.filter((loan) => loan.isOverdue);

    const thirtyDaysAgo = subDays(new Date(), 30);
    const terminalInWindow = filteredLoans.filter(
      (loan) => loan.isTerminalStage && isAfter(parseISO(loan.lastUpdatedDate), thirtyDaysAgo)
    );

    const approvedCount = terminalInWindow.filter((loan) => {
      const stageName = (loan.currentStageName || '').toLowerCase();
      return stageName.includes('approved') || stageName.includes('funded') || stageName.includes('disbur');
    }).length;

    const rejectedCount = terminalInWindow.filter((loan) => {
      const stageName = (loan.currentStageName || '').toLowerCase();
      return stageName.includes('rejected') || stageName.includes('terminated');
    }).length;

    const approvalRate = approvedCount + rejectedCount > 0
      ? `${((approvedCount / (approvedCount + rejectedCount)) * 100).toFixed(1)}%`
      : 'N/A';

    return {
      activeCount: activeLoans.length,
      activeValue: totalActiveValue,
      pipelineValue: filteredLoans.reduce((sum, loan) => sum + loan.loanAmount, 0),
      pendingCount: pendingApprovals.length,
      disbursedCount: thisMonthDisbursed.length,
      disbursedValue: thisMonthDisbursed.reduce((sum, loan) => sum + loan.loanAmount, 0),
      overdueCount: overdueLoans.length,
      overdueValue: overdueLoans.reduce((sum, loan) => sum + loan.loanAmount, 0),
      approvalRate,
    };
  }, [filteredLoans]);

  const summaryRows = useMemo(() => {
    const bySector = new Map<string, LoanRequest[]>();

    filteredLoans.forEach((loan) => {
      const sector = getSectorLabel(loan);
      if (!bySector.has(sector)) bySector.set(sector, []);
      bySector.get(sector)?.push(loan);
    });

    return Array.from(bySector.entries()).map(([sector, sectorLoans]) => {
      const stageCounts = sectorLoans.reduce(
        (acc, loan) => {
          const stage = getHighLevelStage(loan);
          if (stage === 'Valuation') acc.valuation += 1;
          if (stage === 'Appraisal') acc.appraisal += 1;
          if (stage === 'Credit Approval') acc.approval += 1;
          if (stage === 'Contract & Collateral') acc.ready += 1;
          if (stage === 'Active/Monitoring' || stage === 'Disbursed') acc.active += 1;
          return acc;
        },
        { valuation: 0, appraisal: 0, approval: 0, ready: 0, active: 0 }
      );

      const overdueCount = sectorLoans.filter((loan) => loan.isOverdue).length;
      const totalValue = sectorLoans.reduce((sum, loan) => sum + loan.loanAmount, 0);

      let health: 'green' | 'yellow' | 'red' = 'green';
      if (overdueCount > 0) health = 'red';
      else if (stageCounts.approval > 0 || stageCounts.ready > 0) health = 'yellow';

      return {
        sector,
        totalLoans: sectorLoans.length,
        ...stageCounts,
        totalValue,
        health,
      };
    });
  }, [filteredLoans]);

  const statusChartData = useMemo(() => {
    const counts = statusOptions.reduce<Record<string, number>>((acc, status) => {
      if (status !== 'All') acc[status] = 0;
      return acc;
    }, {});

    filteredLoans.forEach((loan) => {
      const status = getLoanStatus(loan);
      if (status !== 'All') counts[status] += 1;
    });

    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([status, value]) => ({ status, value }));
  }, [filteredLoans]);

  const sectorChartData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredLoans.forEach((loan) => {
      const sector = getSectorLabel(loan);
      counts.set(sector, (counts.get(sector) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([sector, value]) => ({ sector, value }));
  }, [filteredLoans]);

  const statusChartConfig = {
    Active: { label: 'Active', color: 'hsl(142, 71%, 45%)' },
    Pending: { label: 'Pending', color: 'hsl(45, 100%, 52%)' },
    Approved: { label: 'Approved', color: 'hsl(217, 91%, 60%)' },
    Disbursed: { label: 'Disbursed', color: 'hsl(199, 89%, 48%)' },
    Overdue: { label: 'Overdue', color: 'hsl(0, 84%, 60%)' },
    Terminated: { label: 'Terminated', color: 'hsl(220, 9%, 46%)' },
    Closed: { label: 'Closed', color: 'hsl(173, 80%, 36%)' },
  } as const;

  const sectorBarColors = [
    'hsl(45, 100%, 52%)',   // Honey primary
    'hsl(30, 80%, 60%)',    // Accent orange
    'hsl(217, 91%, 60%)',   // Blue
    'hsl(173, 80%, 36%)',   // Teal
    'hsl(142, 71%, 45%)',   // Green
    'hsl(280, 65%, 60%)',   // Purple
  ];

  // Sorted loans for history tab
  const sortedFilteredLoans = useMemo(() => {
    return [...filteredLoans].sort((a, b) => parseISO(b.submittedDate).getTime() - parseISO(a.submittedDate).getTime());
  }, [filteredLoans]);

  const historyTotalPages = Math.max(1, Math.ceil(sortedFilteredLoans.length / ITEMS_PER_PAGE));
  const historyStartIndex = (historyPage - 1) * ITEMS_PER_PAGE;
  const paginatedHistory = sortedFilteredLoans.slice(historyStartIndex, historyStartIndex + ITEMS_PER_PAGE);

  const activeFilterCount = [
    statusFilter !== 'All' ? 1 : 0,
    sectorFilter !== 'All' ? 1 : 0,
    relationshipManager !== 'All' ? 1 : 0,
    amountMin ? 1 : 0,
    amountMax ? 1 : 0,
    searchTerm ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setSectorFilter('All');
    setRelationshipManager('All');
    setAmountMin('');
    setAmountMax('');
    setDateRange('This Year');
    setCustomFrom('');
    setCustomTo('');
    setSelectedSector(null);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Loading executive overview...</p>
      </div>
    );
  }

  if (!canViewDashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to view this dashboard.</p>
      </div>
    );
  }

  const metricCards = [
    {
      title: 'Active Loans',
      value: metrics.activeCount,
      subtitle: formatCompactETB(metrics.activeValue),
      icon: Briefcase,
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
    },
    {
      title: 'Pipeline Value',
      value: formatCompactETB(metrics.pipelineValue),
      subtitle: `${filteredLoans.length} total loans`,
      icon: DollarSign,
      iconBg: 'bg-blue-500/15',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Pending Approval',
      value: metrics.pendingCount,
      subtitle: 'Awaiting credit decision',
      icon: Clock,
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Disbursed This Month',
      value: metrics.disbursedCount,
      subtitle: formatCompactETB(metrics.disbursedValue),
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Overdue Loans',
      value: metrics.overdueCount,
      subtitle: formatCompactETB(metrics.overdueValue),
      icon: AlertTriangle,
      iconBg: metrics.overdueCount > 0 ? 'bg-red-500/15' : 'bg-emerald-500/15',
      iconColor: metrics.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Approval Rate (30d)',
      value: metrics.approvalRate,
      subtitle: 'Approved vs rejected',
      icon: TrendingUp,
      iconBg: 'bg-teal-500/15',
      iconColor: 'text-teal-600 dark:text-teal-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            Executive Overview
          </h1>
          <p className="text-muted-foreground mt-1">High-level portfolio view for executive leadership.</p>
        </div>
        <Button className="gap-2" variant="outline" onClick={handleExport}>
          <FileDown className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground leading-tight">{card.title}</p>
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', card.iconBg)}>
                  <Icon className={cn('h-4 w-4', card.iconColor)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters Section - Collapsible */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 flex items-center justify-center text-[10px] rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-7 text-xs"
                  onClick={(e) => { e.stopPropagation(); clearAllFilters(); }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
              {showFilters ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4 pt-0">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by loan ID, customer, or amount..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <Select value={relationshipManager} onValueChange={setRelationshipManager}>
                <SelectTrigger className="min-w-[200px]">
                  <SelectValue placeholder="Relationship Manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Relationship Managers</SelectItem>
                  {relationshipManagers.map((manager) => (
                    <SelectItem key={manager} value={manager}>
                      {manager}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRangeFilter)}>
                <SelectTrigger className="min-w-[160px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  {dateRangeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'Custom Date' && (
              <div className="flex flex-wrap gap-3">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="w-auto"
                />
                <span className="self-center text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="w-auto"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Input
                type="number"
                min="0"
                placeholder="Min amount (ETB)"
                value={amountMin}
                onChange={(event) => setAmountMin(event.target.value)}
                className="w-[160px]"
              />
              <Input
                type="number"
                min="0"
                placeholder="Max amount (ETB)"
                value={amountMax}
                onChange={(event) => setAmountMax(event.target.value)}
                className="w-[160px]"
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {statusOptions.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant={statusFilter === status ? 'default' : 'outline'}
                      className={cn("h-7 text-xs rounded-full px-3", statusFilter !== status && "hover:bg-primary/10 hover:text-primary hover:border-primary/30")}
                      onClick={() => setStatusFilter(status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Sector</p>
                <div className="flex flex-wrap gap-1.5">
                  {sectorOptions.map((sector) => (
                    <Button
                      key={sector}
                      type="button"
                      size="sm"
                      variant={sectorFilter === sector ? 'default' : 'outline'}
                      className={cn("h-7 text-xs rounded-full px-3", sectorFilter !== sector && "hover:bg-primary/10 hover:text-primary hover:border-primary/30")}
                      onClick={() => setSectorFilter(sector)}
                    >
                      {sector}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                <PieChartIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Loans by Status</CardTitle>
                <CardDescription className="text-xs">Portfolio distribution snapshot</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {statusChartData.length > 0 ? (
              <ChartContainer
                config={statusChartConfig}
                className="h-[260px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="status"
                    innerRadius={55}
                    outerRadius={90}
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  >
                    {statusChartData.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={statusChartConfig[entry.status as keyof typeof statusChartConfig]?.color || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                No data to display
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Loans by Sector</CardTitle>
                <CardDescription className="text-xs">Distribution across business sectors</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sectorChartData.length > 0 ? (
              <ChartContainer
                config={{}}
                className="h-[260px]"
              >
                <BarChart data={sectorChartData}>
                  <XAxis dataKey="sector" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {sectorChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={sectorBarColors[index % sectorBarColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                No data to display
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pipeline" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Pipeline Summary
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Loan History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline Summary by Sector</CardTitle>
              <CardDescription>Click a row to drill-down into sector details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sector</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Valuation</TableHead>
                      <TableHead className="text-center">Appraisal</TableHead>
                      <TableHead className="text-center">Approval</TableHead>
                      <TableHead className="text-center">Ready</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                          No pipeline data matches current filters.
                        </TableCell>
                      </TableRow>
                    ) : summaryRows.map((row) => (
                      <TableRow
                        key={row.sector}
                        className="cursor-pointer transition-colors hover:bg-primary/5"
                        onClick={() => {
                          setSelectedSector(row.sector);
                          setActiveTab('history');
                        }}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'h-2.5 w-2.5 rounded-full ring-2 ring-offset-1',
                                row.health === 'green'
                                  ? 'bg-emerald-500 ring-emerald-500/30'
                                  : row.health === 'yellow'
                                    ? 'bg-amber-400 ring-amber-400/30'
                                    : 'bg-rose-500 ring-rose-500/30'
                              )}
                            />
                            {row.sector}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-semibold">{row.totalLoans}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{row.valuation || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-center">{row.appraisal || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-center">{row.approval || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-center">{row.ready || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-center">{row.active || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right font-medium">{formatETB(row.totalValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Loan History</CardTitle>
                  <CardDescription>
                    {sortedFilteredLoans.length} loan{sortedFilteredLoans.length !== 1 ? 's' : ''} found · Sorted by newest first
                  </CardDescription>
                </div>
                {selectedSector && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedSector(null)} className="gap-1.5">
                    <X className="h-3.5 w-3.5" />
                    Clear sector filter
                  </Button>
                )}
              </div>
              {selectedSector && (
                <div className="pt-2">
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/25 border-0">{selectedSector}</Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center h-24 text-muted-foreground">
                          No loans match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : paginatedHistory.map((loan) => {
                      const status = getLoanStatus(loan);
                      return (
                        <TableRow key={loan.id} className="transition-colors hover:bg-primary/5">
                          <TableCell className="font-medium text-primary">{loan.loanNumber}</TableCell>
                          <TableCell className="font-medium">{loan.customerName}</TableCell>
                          <TableCell className="text-sm">{getSectorLabel(loan)}</TableCell>
                          <TableCell className="text-right font-medium">{formatETB(loan.loanAmount)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(parseISO(loan.submittedDate), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-[11px] font-medium border-0', getStatusColor(status))}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{getHighLevelStage(loan)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{getRelationshipManager(loan)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(parseISO(loan.lastUpdatedDate), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1"
                                onClick={() => setOverviewLoan(loan)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Overview
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => router.push(`/loan-requests/${loan.id}`)}
                                title="View Detail"
                                aria-label="View Detail"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {historyTotalPages > 1 && (
              <CardFooter className="flex items-center justify-between border-t pt-4">
                <span className="text-sm text-muted-foreground">
                  Showing {historyStartIndex + 1}–{Math.min(historyStartIndex + ITEMS_PER_PAGE, sortedFilteredLoans.length)} of {sortedFilteredLoans.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {historyPage} of {historyTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                    disabled={historyPage >= historyTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Banner */}
      {error && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" />
              Data Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      )}

      <Dialog open={!!overviewLoan} onOpenChange={(open) => { if (!open) setOverviewLoan(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loan Overview</DialogTitle>
            <DialogDescription>
              Quick executive summary for this case.
            </DialogDescription>
          </DialogHeader>


          {overviewLoan && (
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Loan ID:</span> <span className="font-medium">{overviewLoan.loanNumber}</span></div>
              <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{overviewLoan.customerName}</span></div>
              <div><span className="text-muted-foreground">Sector:</span> <span className="font-medium">{getSectorLabel(overviewLoan)}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{formatETB(overviewLoan.loanAmount)}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{getLoanStatus(overviewLoan)}</span></div>
              <div><span className="text-muted-foreground">Stage:</span> <span className="font-medium">{getHighLevelStage(overviewLoan)}</span></div>
              <div><span className="text-muted-foreground">Current Department:</span> <span className="font-medium">{overviewLoan.assignedDepartment || overviewLoan.assignedDepartmentId || overviewLoan.sectorName || 'N/A'}</span></div>
              <div><span className="text-muted-foreground">Relationship Manager:</span> <span className="font-medium">{getRelationshipManager(overviewLoan)}</span></div>
              <div><span className="text-muted-foreground">Application Date:</span> <span className="font-medium">{format(parseISO(overviewLoan.submittedDate), 'MMM d, yyyy')}</span></div>
              <div><span className="text-muted-foreground">Last Updated:</span> <span className="font-medium">{format(parseISO(overviewLoan.lastUpdatedDate), 'MMM d, yyyy')}</span></div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOverviewLoan(null)}>Close</Button>
            {overviewLoan && (
              <Button onClick={() => router.push(`/loan-requests/${overviewLoan.id}`)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Detail
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
