
'use server';
import prisma from '@/lib/prisma';
import type {
  LoanRequest as PrismaLoanRequest,
  WorkflowDefinition as PrismaWorkflowDefinition,
  WorkflowVersion as PrismaWorkflowVersion,
  WorkflowStageDefinition as PrismaWorkflowStageDefinition,
  Department as PrismaDepartment,
  User as PrismaUser,
  LoanDocument as PrismaLoanDocument,
  LoanHistoryEntry as PrismaLoanHistoryEntry,
  Role as PrismaRole,
  Sector as PrismaSector,
  RequestType as PrismaRequestType,
  DocumentRequirement as PrismaDocumentRequirement,
  Customer as PrismaCustomer,
  Prisma,
} from '@prisma/client';

import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department, LoanDocument, LoanHistoryEntry, DocumentRequirement, Customer, CustomerWithDepartment, Sector, RequestType } from '@/types/loan';
import { LoanDocumentStatus as AppLoanDocumentStatus, DocumentRequirementType as AppDocumentRequirementType } from '@/types/loan';
import { PERMISSIONS, type AppPermission } from '@/lib/permissions';
import { getCommitteeSettings, getDistrictSettings } from './settings-service';
import { createCaseAssignedNotifications } from './notification-service';
import { getCurrentUser } from '@/app/auth/actions';
import { normalizeEthiopianPhone } from '@/lib/utils';
import { canDistributeToDistrictApproval } from '@/lib/district-workflow';
import {
  dedupeLoanRowsBySubmission,
  dedupeOrderedLoanRows,
  type LoanRowForDedup,
} from '@/lib/loan-submission-fingerprint';
import {
  acquireSubmissionLock,
  buildSubmissionLockFingerprint,
  finalizeSubmissionDedup,
  guardAgainstDuplicateSubmission,
  releaseSubmissionDedupForLoan,
  generateUniqueLoanNumber,
  normalizeSubmissionEmail,
  normalizeSubmissionText,
  isPlaceholderEmail,
  generateGuestCustomerEmail,
} from '@/services/loan-submission-guard';

import { formatISO, parseISO, addDays, isBefore, isValid } from 'date-fns';
import { safeJsonParse, mapPrismaUserToAppUser, mapPrismaLoanToAppLoan } from './utils/mappers';

// Seeded District Specialized workflow id — the single workflow used by the
// District channel. Centralized so the channel->workflow binding is explicit
// and guarded in both submission paths.
const DISTRICT_WORKFLOW_ID = 'wf-district-specialized';

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  if (originalError !== undefined) {
    console.error(`[PrismaService:${context || 'Unknown'}] Error: ${message}`, originalError);
  } else {
    console.error(`[PrismaService:${context || 'Unknown'}] Error: ${message}`);
  }
  return { error: message };
};

function mapAndDedupePrismaLoans<T extends LoanRowForDedup>(
  prismaLoans: T[],
  options: { districtOverdueHours?: number } = {},
): LoanRequest[] {
  // Restore deduping to prevent showing the same application multiple times if it was
  // accidentally double-submitted or exists as multiple rows for the same intent.
  return dedupeLoanRowsBySubmission(prismaLoans).map((pl) =>
    mapPrismaLoanToAppLoan(pl as any, options),
  );
}

async function getDistrictBranchNames(districtId?: string): Promise<string[] | null> {
  if (!districtId) return null;
  const branches = await prisma.branch.findMany({
    where: { districtId },
    select: { name: true },
  });
  return branches.map((b) => b.name);
}

const PLACEHOLDER_SECTOR_NAMES = new Set([
  'unselected sector',
  'unselected',
  'n/a',
  'none',
]);

const CANONICAL_CHILD_SECTOR_PARENT: Record<string, string> = {
  'financial institution': 'Institutional Banking and Hospitality and Green Financing Sector',
  'mining, power and water': 'Institutional Banking and Hospitality and Green Financing Sector',
  'domestic trade and service': 'Service sector Department',
  'hotel and tourism': 'Service sector Department',
  transport: 'Service sector Department',
  'international trade - export': 'Service sector Department',
  'international trade - import': 'Service sector Department',
  'personal loan': 'Service sector Department',
  'manufacturing industry': 'Construction Manufacturing and Agriculture Sector Department',
  agriculture: 'Construction Manufacturing and Agriculture Sector Department',
  'building and construction': 'Construction Manufacturing and Agriculture Sector Department',
  'building & construction': 'Construction Manufacturing and Agriculture Sector Department',
};

function normalizeRoutingName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function roleMatches(roleName: string | null | undefined, tokens: string[]) {
  const normalizedRole = normalizeRoutingName(roleName);
  return tokens.some((token) => normalizedRole.includes(normalizeRoutingName(token)));
}

function getWorkflowCodeFromName(name?: string | null): number | null {
  const match = String(name || '').match(/\bWF-(\d{2})\b/i);
  return match ? Number(match[1]) : null;
}

function getRoleHierarchyForStage(stageName: string, departmentName: string, workflowName?: string | null): string[][] {
  const combined = normalizeRoutingName(`${workflowName || ''} ${stageName} ${departmentName}`);
  const workflowCode = getWorkflowCodeFromName(workflowName);

  if (combined.includes('valuation')) {
    return [['Chief', 'Deputy Chief'], ['Director'], ['Manager'], ['Property Valuation Officer', 'Valuation Officer', 'Officer']];
  }

  // WF-05: Appraisal Workflow
  if (workflowCode === 5 || combined.includes('appraisal')) {
    return [['Chief', 'Deputy Chief'], ['Director'], ['Division Manager', 'Manager'], ['Credit Analyst', 'Appraisal Officer', 'Officer', 'Analyst']];
  }

  if (workflowCode === 7 || combined.includes('appraisal')) {
    return [['Chief', 'Deputy Chief'], ['Director'], ['Manager'], ['Credit Appraisal Officer', 'Appraisal Officer', 'Officer', 'Analyst']];
  }

  if (workflowCode === 3 || workflowCode === 6 || workflowCode === 8 || combined.includes('rm valuation result') || combined.includes('disbursement')) {
    return [['CRM', 'Customer Relationship Manager', 'Relationship Manager'], ['Loan Officer', 'Officer']];
  }

  return [['Chief', 'Deputy Chief'], ['Director'], ['Manager'], ['CRM', 'Customer Relationship Manager', 'Relationship Manager'], ['Officer']];
}

type ResolvedSubmissionSector =
  | {
      sector: PrismaSector & {
        parentId: string;
        parent: PrismaSector;
      };
    }
  | { error: string };

async function resolveChildSectorForSubmission(sectorId: string): Promise<ResolvedSubmissionSector> {
  const selectedChildSector = await prisma.sector.findUnique({
    where: { id: String(sectorId || '').trim() },
    include: { parent: true },
  });

  if (!selectedChildSector) {
    return { error: 'Invalid child sector selected.' };
  }

  const normalizedChildName = normalizeRoutingName(selectedChildSector.name);
  if (PLACEHOLDER_SECTOR_NAMES.has(normalizedChildName)) {
    return { error: 'A valid child sector must be selected. "Unselected Sector" cannot be used for loan routing.' };
  }

  const canonicalParentName = CANONICAL_CHILD_SECTOR_PARENT[normalizedChildName];
  let resolvedParent = selectedChildSector.parent;

  if (canonicalParentName && normalizeRoutingName(resolvedParent?.name) !== normalizeRoutingName(canonicalParentName)) {
    const canonicalParent = await prisma.sector.findUnique({ where: { name: canonicalParentName } });
    if (!canonicalParent) {
      return { error: `Parent sector "${canonicalParentName}" is not configured.` };
    }

    await prisma.sector.update({
      where: { id: selectedChildSector.id },
      data: { parentId: canonicalParent.id },
    });
    resolvedParent = canonicalParent;
  }

  if (!resolvedParent || PLACEHOLDER_SECTOR_NAMES.has(normalizeRoutingName(resolvedParent.name))) {
    return { error: 'Selected child sector is not linked to a valid parent sector department.' };
  }

  return {
    sector: {
      ...selectedChildSector,
      parentId: resolvedParent.id,
      parent: resolvedParent,
    },
  };
}

async function findWorkflowAssignee(
  client: Prisma.TransactionClient | typeof prisma,
  params: {
    departmentId: string;
    departmentName: string;
    stageName: string;
    workflowName?: string | null;
    allowedRoles?: string | null;
    preferredUserIds?: string[];
  },
): Promise<{ id: string; name: string; customRoleName: string | null } | null> {
  const preferredUserIds = params.preferredUserIds?.filter(Boolean) || [];
  if (preferredUserIds.length > 0) {
    const preferred = await client.user.findFirst({
      where: {
        id: { in: preferredUserIds },
        departmentId: params.departmentId,
        isActive: true,
      },
      select: { id: true, name: true, customRole: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    if (preferred) {
      return { id: preferred.id, name: preferred.name, customRoleName: preferred.customRole?.name || null };
    }
  }

  const users = await client.user.findMany({
    where: { departmentId: params.departmentId, isActive: true },
    select: { id: true, name: true, customRole: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  if (users.length === 0) return null;

  const allowedRoles = safeJsonParse<string[]>(params.allowedRoles, []);
  if (allowedRoles.length > 0) {
    const allowed = users.find((u) => roleMatches(u.customRole?.name, allowedRoles));
    if (allowed) return { id: allowed.id, name: allowed.name, customRoleName: allowed.customRole?.name || null };
  }

  const hierarchy = getRoleHierarchyForStage(params.stageName, params.departmentName, params.workflowName);
  for (const roleGroup of hierarchy) {
    const assignee = users.find((u) => roleMatches(u.customRole?.name, roleGroup));
    if (assignee) return { id: assignee.id, name: assignee.name, customRoleName: assignee.customRole?.name || null };
  }

  const fallback = users[0];
  return { id: fallback.id, name: fallback.name, customRoleName: fallback.customRole?.name || null };
}

// Escalates to the highest-ranked active user in a department: Chief > Director > Manager > first user.
// Used for Head Office (TYPE1) loans entering a department for the first time.
async function findHighestAuthorityInDepartment(
  client: Prisma.TransactionClient | typeof prisma,
  departmentId: string,
): Promise<{ id: string; name: string; customRoleName: string | null } | null> {
  const users = await client.user.findMany({
    where: { departmentId, isActive: true },
    select: { id: true, name: true, customRole: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  if (users.length === 0) return null;

  const authorityTiers: string[][] = [
    ['chief', 'deputy chief'],
    ['director'],
    ['manager'],
  ];

  for (const tier of authorityTiers) {
    const match = users.find((u) => roleMatches(u.customRole?.name, tier));
    if (match) return { id: match.id, name: match.name, customRoleName: match.customRole?.name ?? null };
  }

  const fallback = users[0];
  return { id: fallback.id, name: fallback.name, customRoleName: fallback.customRole?.name ?? null };
}

// Finds the most recent user (from loan history) who currently belongs to the given department.
// Used by Head Office (TYPE1) loans returning to a previously-visited department, or for rework.
// Pass excludeUserId to skip the user triggering the action (e.g. the manager doing the rework).
async function findLastHandlerInDepartment(
  client: Prisma.TransactionClient | typeof prisma,
  departmentId: string,
  history: { userId: string; timestamp: Date | string }[],
  excludeUserId?: string,
): Promise<{ id: string; name: string; customRoleName: string | null } | null> {
  if (history.length === 0) return null;

  const historyUserIds = [...new Set(
    history.map((h) => h.userId).filter((uid) => uid && uid !== excludeUserId),
  )];
  if (historyUserIds.length === 0) return null;

  const usersInDept = await client.user.findMany({
    where: { id: { in: historyUserIds }, departmentId, isActive: true },
    select: { id: true, name: true, customRole: { select: { name: true } } },
  });

  if (usersInDept.length === 0) return null;

  const deptUserMap = new Map(usersInDept.map((u) => [u.id, u]));

  const sorted = [...history]
    .filter((h) => h.userId !== excludeUserId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  for (const entry of sorted) {
    const u = deptUserMap.get(entry.userId);
    if (u) return { id: u.id, name: u.name, customRoleName: u.customRole?.name ?? null };
  }

  return null;
}

/**
 * SERVICE LAYER (Internal Logic)
 */

// ---------------------------------------------------------------------------
// Customer resolution
// ---------------------------------------------------------------------------

/**
 * Identify or create the customer for a loan submission.
 *
 * Priority order:
 *  1. Real email   → upsert by email; existing record is NEVER overwritten.
 *  2. Placeholder/no email + phone → find existing customer by phone number.
 *     Re-using the same customer record enables correct duplicate detection
 *     for customers who don't have email addresses.
 *  3. No match     → create a new customer with a unique synthetic email key.
 */
async function resolveCustomerForSubmission(
  tx: Prisma.TransactionClient,
  loanData: any,
  normalizedPhone: string | null,
): Promise<{ id: string }> {
  const normalizedEmail = normalizeSubmissionEmail(loanData.customerEmail);
  const customerName = normalizeSubmissionText(loanData.customerName);
  const customerBranch = normalizeSubmissionText(loanData.customerBranch);

  // 1. Real email → find-or-create; never overwrite existing customer data.
  if (!isPlaceholderEmail(normalizedEmail)) {
    return tx.customer.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: {
        email: normalizedEmail,
        name: customerName,
        phone: normalizedPhone || null,
        branch: customerBranch || null,
      },
      select: { id: true },
    });
  }

  // 2. Placeholder / no email → look up by phone number.
  //    This is the key step that lets the downstream duplicate guard work for
  //    customers without real email addresses.
  if (normalizedPhone) {
    const byPhone = await tx.customer.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true },
      orderBy: { createdAt: 'asc' }, // oldest record = original customer entry
    });
    if (byPhone) return byPhone;
  }

  // 3. No match at all → create a brand-new customer.
  return tx.customer.create({
    data: {
      email: generateGuestCustomerEmail(),
      name: customerName,
      phone: normalizedPhone || null,
      branch: customerBranch || null,
    },
    select: { id: true },
  });
}

async function addLoanRequestInternal(
  user: User,
  loanData: any
): Promise<{ id?: string; isDuplicate?: boolean; error?: string }> {
  // Hoisted so the catch block can recover gracefully from a unique-constraint race.
  let resolvedDepartmentId: string | null = null;
  try {
    const sectorResolution = await resolveChildSectorForSubmission(loanData.sectorId);
    if ('error' in sectorResolution) {
      return createErrorResult(sectorResolution.error, "addLoanRequestInternal");
    }
    const selectedChildSector = sectorResolution.sector;

    const firstWorkflowInSequence = await prisma.workflowDefinition.findFirst({
      where: {
        sectorId: selectedChildSector.id,
        name: { startsWith: 'WF-01' },
      },
      orderBy: [{ order: 'desc' }, { createdAt: 'desc' }],
    });

    if (!firstWorkflowInSequence) {
      return createErrorResult(`No workflow sequence found for the selected Child Sector.`, "addLoanRequestInternal");
    }

    // Channel guard: the Head Office channel must resolve a Head Office (WF-0x)
    // workflow, never the District Specialized workflow. Fail loudly if a seed/config
    // error ever crosses the channels rather than silently routing the wrong pipeline.
    if (firstWorkflowInSequence.id === DISTRICT_WORKFLOW_ID) {
      return createErrorResult(
        `Channel mismatch: Head Office submission resolved the District workflow. Check the workflow seed/config for this sector.`,
        "addLoanRequestInternal",
      );
    }

    const activeVersion = await prisma.workflowVersion.findFirst({
      where: {
        workflowDefinitionId: firstWorkflowInSequence.id,
        isActive: true,
      },
      include: {
        workflowDefinition: {
          include: { sector: { include: { parent: true } } },
        },
        stages: {
          orderBy: { order: 'asc' },
          include: { responsibleDepartment: true }
        },
      },
    });

    if (!activeVersion || activeVersion.stages.length === 0) {
      return createErrorResult(`The first workflow in the sequence has no active version or is improperly configured.`, "addLoanRequestInternal");
    }

    const firstStage = activeVersion.stages[0];
    let initialDepartment = firstStage.responsibleDepartment;

    // Safety: If the initial stage is assigned to a Valuation department unexpectedly
    // (e.g., stage 0 routes to Property Valuation), prefer a non-valuation department
    // if another stage in the workflow handles the actual business intake.
    try {
      const isValuation = (name?: string) => String(name || '').toLowerCase().includes('valuation');
      if (isValuation(initialDepartment?.name) && activeVersion.stages.length > 1) {
        const fallbackStage = activeVersion.stages.find(s => !isValuation(s.responsibleDepartment?.name));
        if (fallbackStage) {
          console.warn('[PrismaService:addLoanRequestInternal] Stage 0 assigned to valuation department; falling back to non-valuation department from stage', fallbackStage.name);
          initialDepartment = fallbackStage.responsibleDepartment;
        } else {
          console.warn('[PrismaService:addLoanRequestInternal] All stages appear to be valuation; keeping initial department as-is');
        }
      }
    } catch (e) {
      console.warn('[PrismaService:addLoanRequestInternal] Error during initial department safety check', e);
    }
    resolvedDepartmentId = initialDepartment.id;
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    const systemUserId = 'system-prisma';
    const initialAssignee = await findWorkflowAssignee(prisma, {
      departmentId: initialDepartment.id,
      departmentName: initialDepartment.name,
      stageName: firstStage.name,
      workflowName: firstWorkflowInSequence.name,
      allowedRoles: firstStage.allowedRoles,
    });

    const initialHistoryNote = `Loan application submitted by ${user.fullName}. Child Sector: ${selectedChildSector.name}. Parent Sector Department: ${selectedChildSector.parent.name}. Initial Department: ${initialDepartment.name}. Workflow: ${firstWorkflowInSequence.name} (V${activeVersion.versionNumber}). Initial stage: ${firstStage.name}.${initialAssignee ? ` Assigned to ${initialAssignee.name}.` : ' Awaiting assignment.'}`;

    const availableStatusesObj = safeJsonParse<Record<string, string[]>>(firstStage.availableStatuses, {});
    const availableStatusesForDept = availableStatusesObj[firstStage.responsibleDepartment.name] || [];
    const initialStatus = availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';
    const normalizedCustomerPhone = normalizeEthiopianPhone(loanData.customerPhone);

    console.log('[PrismaService:addLoanRequestInternal] Creating loan:', {
      sectorId: selectedChildSector.id,
      sectorName: selectedChildSector.name,
      workflowDefinition: firstWorkflowInSequence?.name,
      workflowVersionId: activeVersion?.id,
      firstStage: firstStage?.name,
      initialDepartment: initialDepartment?.name,
    });

    const newLoan = await prisma.$transaction(async (tx) => {
      await acquireSubmissionLock(tx, buildSubmissionLockFingerprint(loanData));

      const customer = await resolveCustomerForSubmission(tx, loanData, normalizedCustomerPhone);

      // Exact-duplicate guard: same customer + amount + sector + type + purpose = reject.
      // Any change in those fields = create a new loan request.
      const guard = await guardAgainstDuplicateSubmission(tx, loanData, customer.id);
      if ('id' in guard) {
        console.info('[PrismaService:addLoanRequestInternal] Returning existing submission:', guard.id);
        return { id: guard.id, isDuplicate: true };
      }

      const created = await tx.loanRequest.create({
        data: {
          loanNumber: generateUniqueLoanNumber('LN-PSQL'),
          customer: { connect: { id: customer.id } },
          loanAmount: loanData.loanAmount,
          sector: { connect: { id: selectedChildSector.id } },
          requestType: { connect: { id: loanData.requestTypeId } },
          loanPurpose: normalizeSubmissionText(loanData.loanPurpose),
          submissionType: 'TYPE1', // Head Office channel (explicit; do not rely on schema default)
          submittedDate: currentDate,
          lastUpdatedDate: currentDate,
          stageEntryDate: currentDate,
          stageDeadline: stageDeadlineDate,
          workflowVersion: { connect: { id: activeVersion.id } },
          currentWorkflowStage: { connect: { id: firstStage.id } },
          assignedDepartment: { connect: { id: initialDepartment.id } },
          ...(initialAssignee ? { assignedToUsers: { connect: { id: initialAssignee.id } } } : {}),
          currentStageStatus: initialStatus,
          createdBy: { connect: { id: user.id } },
          history: {
            create: [
              {
                stageName: firstStage.name,
                timestamp: currentDate,
                notes: initialHistoryNote,
                user: { connect: { id: user.id } }
              }
            ]
          }
        },
        select: { id: true },
      });
      await finalizeSubmissionDedup(tx, guard.dedupKey, created.id);
      return { id: created.id, isDuplicate: false };
    });

    return { id: newLoan.id, isDuplicate: newLoan.isDuplicate };
  } catch (e: any) {
    return createErrorResult(`Failed to add loan request. ${e.message}`, "addLoanRequestInternal", e);
  }
}

async function getLoanRequestsInternal(user: User): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const userPermissions = new Set(user.permissions || []);
    let whereClause: any = {};

    const isFullAdmin = userPermissions.has(PERMISSIONS.MANAGE_USERS);

    if (isFullAdmin) {
      whereClause = {};
    } else {
      // Create shared whereClause parts
      const userContextFilter = {
        OR: [
          { createdBy: { id: user.id } },
          { assignedBy: { id: user.id } },
          { assignedToUsers: { some: { id: user.id } } }
        ]
      };

      const isManager = userPermissions.has(PERMISSIONS.VIEW_MANAGER_REVIEW_QUEUE);

      if (user.departmentId) {
        if (user.districtId) {
          // District Users see their department cases OR any District-scoped Type 2 cases 
          // (They'll be further filtered by districtBranchNames below)
          if (isManager) {
            whereClause = {
              OR: [
                { assignedDepartmentId: user.departmentId },
                { submissionType: 'TYPE2' },
                userContextFilter
              ]
            };
          } else {
            whereClause = {
              OR: [
                { assignedDepartmentId: user.departmentId },
                { assignedToUsers: { some: { id: user.id } } }
              ]
            };
          }
        } else {
          // Standard users see only their department or cases they are direct participants in
          if (isManager) {
            whereClause = {
              OR: [
                { assignedDepartmentId: user.departmentId },
                userContextFilter
              ]
            };
          } else {
            whereClause = {
              OR: [
                { assignedDepartmentId: user.departmentId },
                { assignedToUsers: { some: { id: user.id } } }
              ]
            };
          }
        }
      } else {
        whereClause = userContextFilter;
      }
    }

    const districtBranchNames = await getDistrictBranchNames(user.districtId);
    if (user.districtId && districtBranchNames && districtBranchNames.length === 0) {
      return { loans: [] };
    }
    const districtFilter = districtBranchNames
      ? { customer: { branch: { in: districtBranchNames } } }
      : null;

    const prismaLoans = await prisma.loanRequest.findMany({
      where: districtFilter ? { AND: [whereClause, districtFilter] } : whereClause,
      orderBy: [{ isUrgent: 'desc' }, { lastUpdatedDate: 'desc' }],
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
        assignedDepartment: true,
        assignedBy: true,
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const districtSettings = await getDistrictSettings();
    return {
      loans: mapAndDedupePrismaLoans(prismaLoans, { districtOverdueHours: districtSettings.overdueHours }),
    };
  } catch (e: any) {
    return createErrorResult("Failed to fetch loan requests.", "getLoanRequestsInternal", e);
  }
}

/**
 * CONTROLLER LAYER (Exported Actions)
 */

/**
 * Check how many active (non-terminal) loans a customer already has.
 * Used by submission forms to warn staff before creating a duplicate.
 * Lookup order: real email → phone (for placeholder-email customers).
 */
export async function checkCustomerForActiveLoans(
  phone: string,
  email: string,
): Promise<{ count: number }> {
  try {
    const normalizedPhone = normalizeEthiopianPhone(phone) || normalizeSubmissionText(phone);
    const normalizedEmail = normalizeSubmissionEmail(email);

    let customerId: string | null = null;

    if (!isPlaceholderEmail(normalizedEmail)) {
      const customer = await prisma.customer.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      customerId = customer?.id ?? null;
    } else if (normalizedPhone) {
      const customer = await prisma.customer.findFirst({
        where: { phone: normalizedPhone },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      customerId = customer?.id ?? null;
    }

    if (!customerId) return { count: 0 };

    const count = await prisma.loanRequest.count({
      where: { customerId, isTerminalStage: false },
    });
    return { count };
  } catch {
    return { count: 0 };
  }
}

export async function addLoanRequest(loanData: any): Promise<{ id?: string; isDuplicate?: boolean; error?: string }> {
  const { user } = await getCurrentUser();
  if (!user || !user.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST)) {
    return createErrorResult("Unauthorized", "addLoanRequest");
  }
  return addLoanRequestInternal(user, loanData);
}

export async function addType2LoanRequest(loanData: any): Promise<{ id?: string; isDuplicate?: boolean; error?: string }> {
  const { user } = await getCurrentUser();
  if (!user || !user.permissions.includes(PERMISSIONS.CREATE_LOAN_REQUEST)) {
    return createErrorResult("Unauthorized", "addType2LoanRequest");
  }

  // Hoisted so the catch block can recover gracefully from a unique-constraint race.
  let resolvedDepartmentId: string | null = null;
  try {
    const sectorResolution = await resolveChildSectorForSubmission(loanData.sectorId);
    if ('error' in sectorResolution) {
      return createErrorResult(sectorResolution.error, "addType2LoanRequest");
    }
    const selectedChildSector = sectorResolution.sector;

    const result = await prisma.$transaction(async (tx) => {
      await acquireSubmissionLock(tx, buildSubmissionLockFingerprint(loanData));

      const normalizedCustomerPhone = normalizeEthiopianPhone(loanData.customerPhone);
      const customer = await resolveCustomerForSubmission(tx, loanData, normalizedCustomerPhone);

      const currentDate = new Date();

      // Channel guard: the District channel always binds to the seeded District
      // Specialized workflow. Fail loudly if it is missing/misconfigured rather
      // than silently routing the case down the wrong pipeline.
      const districtWorkflowVersion = await tx.workflowVersion.findFirst({
        where: {
          workflowDefinition: { id: DISTRICT_WORKFLOW_ID },
          isActive: true,
        },
        include: {
          workflowDefinition: true,
          stages: {
            orderBy: { order: 'asc' },
            include: { responsibleDepartment: true },
          },
        },
      });

      if (
        !districtWorkflowVersion ||
        districtWorkflowVersion.workflowDefinitionId !== DISTRICT_WORKFLOW_ID ||
        districtWorkflowVersion.stages.length === 0
      ) {
        throw new Error('District Specialized Workflow not found or has no stages. Please run the seed script.');
      }

      // 2. Start at the Manager Assignment stage (index 1) since Secretary submission is what triggers creation
      const targetStageIndex = districtWorkflowVersion.stages.length > 1 ? 1 : 0;
      const activeStage = districtWorkflowVersion.stages[targetStageIndex];
      const initialDepartment = activeStage.responsibleDepartment;
      resolvedDepartmentId = initialDepartment.id;

      // Exact-duplicate guard: same customer + amount + sector + type + purpose = reject.
      // Any change in those fields = create a new loan request.
      const guard = await guardAgainstDuplicateSubmission(tx, loanData, customer.id);
      if ('id' in guard) {
        console.info('[PrismaService:addType2LoanRequest] Returning existing submission:', guard.id);
        return { id: guard.id, isDuplicate: true };
      }

      const stageDeadlineDate = addDays(currentDate, activeStage.defaultTimelineDays);

      const availableStatusesObj = safeJsonParse<Record<string, string[]>>(activeStage.availableStatuses, {});
      const availableStatusesForDept = availableStatusesObj[initialDepartment.name] || [];
      const initialStatus = availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';

      const initialHistoryNote = `District loan submitted by ${user.fullName} (Secretary). ` +
        `Workflow: ${districtWorkflowVersion.workflowDefinition.name} (V${districtWorkflowVersion.versionNumber}). ` +
        `Stage 0 (Submission) completed. Current stage: ${activeStage.name}. Awaiting Manager assignment.`;

      const newLoan = await tx.loanRequest.create({
        data: {
          loanNumber: generateUniqueLoanNumber('LN-T2'),
          customer: { connect: { id: customer.id } },
          loanAmount: loanData.loanAmount,
          sector: { connect: { id: selectedChildSector.id } },
          requestType: { connect: { id: loanData.requestTypeId } },
          loanPurpose: normalizeSubmissionText(loanData.loanPurpose),
          submittedDate: currentDate,
          lastUpdatedDate: currentDate,
          stageEntryDate: currentDate,
          stageDeadline: stageDeadlineDate,
          submissionType: 'TYPE2',
          lafStatus: "PENDING",
          isReadyForManagerReview: true,
          workflowVersion: { connect: { id: districtWorkflowVersion.id } },
          currentWorkflowStage: { connect: { id: activeStage.id } },
          assignedDepartment: { connect: { id: initialDepartment.id } },
          currentStageStatus: initialStatus,
          createdBy: { connect: { id: user.id } },
          assignedToUsers: { connect: { id: user.id } },
          history: {
            create: [
              {
                stageName: activeStage.name,
                timestamp: currentDate,
                notes: initialHistoryNote,
                user: { connect: { id: user.id } }
              }
            ]
          }
        },
        select: { id: true },
      });
      await finalizeSubmissionDedup(tx, guard.dedupKey, newLoan.id);
      return { id: newLoan.id, isDuplicate: false };
    });

    return { id: result.id, isDuplicate: result.isDuplicate };
  } catch (e: any) {
    return createErrorResult(`Failed to add Type 2 loan request. ${e.message}`, "addType2LoanRequest", e);
  }
}

export async function submitType2ToValuation(loanRequestId: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "submitType2ToValuation");

    const result = await prisma.$transaction(async (tx) => {
      const existingLoan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: { workflowVersion: { include: { stages: { include: { responsibleDepartment: true } } } } }
      });

      if (!existingLoan) throw new Error("Loan not found");

      // Find the target stage in the current workflow version
      const valuationStage = existingLoan.workflowVersion?.stages.find(s => s.name === "HO Valuation Review");
      if (!valuationStage) throw new Error("HO Valuation Review stage not found in current workflow version.");

      const now = new Date();
      
      // 1. Update Loan Status and Stage
      const updatedLoan = await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          isReadyForValuation: true,
          isValuationCompleted: false,
          currentWorkflowStage: { connect: { id: valuationStage.id } },
          assignedDepartment: { connect: { id: valuationStage.responsibleDepartmentId } },
          stageEntryDate: now,
          stageDeadline: addDays(now, valuationStage.defaultTimelineDays),
          currentStageStatus: 'Initiated',
          assignedToUsers: { set: [] }, // Clear CRM assignment as it's now with Valuation
          lastUpdatedDate: now,
          history: {
            // The "Forward to Valuation" entry records the sending CRM so the case returns
            // to them (not the loan creator) when valuation completes.
            create: [
              {
                userId: user.id,
                stageName: "HO Valuation Review",
                notes: `Case forwarded to Property Valuation Department. CRM finalized PVR.`,
              },
              {
                userId: user.id,
                stageName: "Forward to Valuation",
                notes: `Case forwarded to the Valuation Department by ${user.fullName}.`,
              },
            ]
          }
        }
      });

      // 2. Create or reset valuation queue entry
      await tx.valuationQueue.upsert({
        where: { loanRequestId: loanRequestId },
        create: {
          loanRequestId: loanRequestId,
          status: "PENDING",
          isCheckedByChecker: false,
        },
        update: {
          status: "PENDING",
          routingOption: null,
          assignedToId: null,
          makerId: null,
          isCheckedByChecker: false,
        },
      });

      return updatedLoan;
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to submit Type 2 loan to valuation. ${e.message}`, "submitType2ToValuation", e);
  }
}

export async function skipPVRAndValuation(loanRequestId: string, reason?: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.SKIP_PVR_AND_VALUATION)) {
      return createErrorResult("Unauthorized", "skipPVRAndValuation");
    }

    const updatedLoan = await prisma.$transaction(async (tx) => {
      const existingLoan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: { workflowVersion: { include: { stages: true } } },
      });

      if (!existingLoan) throw new Error("Loan not found");
      if (existingLoan.submissionType !== 'TYPE2') {
        throw new Error("Skip PVR is only available for TYPE2 district workflow cases.");
      }

      const currentStage = existingLoan.workflowVersion?.stages.find(
        (s) => s.id === existingLoan.currentStageId
      );
      if (!currentStage) throw new Error("Current workflow stage not found.");
      if (![2, 3].includes(currentStage.order)) {
        throw new Error(
          "Skip PVR and Valuation can only be performed from the CRM PVR Preparation or HO Valuation Review stage."
        );
      }

      const nextStage = existingLoan.workflowVersion?.stages.find((s) => s.order === 4);
      if (!nextStage) throw new Error("Next stage (CRM LAF & Summary Preparation) not found in current workflow version.");

      const initialStageStatus = 'Initiated';
      const now = new Date();

      await tx.valuationQueue.deleteMany({ where: { loanRequestId } });

      const updated = await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          currentWorkflowStage: { connect: { id: nextStage.id } },
          assignedDepartment: { connect: { id: nextStage.responsibleDepartmentId } },
          stageEntryDate: now,
          stageDeadline: addDays(now, nextStage.defaultTimelineDays),
          currentStageStatus: initialStageStatus,
          isReadyForManagerReview: false,
          assignedToUsers: { set: [{ id: user.id }] },
          lafStatus: 'PENDING',
          stageCompletedBy: { set: [] },
          isReadyForValuation: false,
          isValuationCompleted: false,
          lastUpdatedDate: now,
          history: {
            create: {
              userId: user.id,
              stageName: nextStage.name,
              notes: `PVR and Valuation skipped by ${user.fullName}. Case moved directly to ${nextStage.name}.${reason ? ` Reason: ${reason}` : ''}`,
            },
          },
        },
      });

      // record in case review history with optional comment
      await tx.caseReviewHistory.create({
        data: {
          loanRequest: { connect: { id: loanRequestId } },
          performedBy: { connect: { id: user.id } },
          action: 'SKIPPED',
          comment: reason || null,
          createdAt: now,
        },
      });

      return updated;
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to skip PVR and valuation. ${e.message}`, "skipPVRAndValuation", e);
  }
}

export async function updateLAF(loanRequestId: string, lafData: any, status: 'COMPLETED' | 'EXPORTED' = 'COMPLETED') {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "updateLAF");

    await prisma.loanRequest.update({
      where: { id: loanRequestId },
      data: {
        lafData: JSON.stringify(lafData),
        lafStatus: status,
        lastUpdatedDate: new Date()
      }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "updateLAF");
  }
}

export async function updatePVR(loanRequestId: string, pvrData: any) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "updatePVR");

    await prisma.loanRequest.update({
      where: { id: loanRequestId },
      data: {
        pvrData: JSON.stringify(pvrData),
      },
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "updatePVR");
  }
}

export async function updateCustomerSummary(loanRequestId: string, summaryData: any) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "updateCustomerSummary");

    await prisma.loanRequest.update({
      where: { id: loanRequestId },
      data: {
        customerSummaryData: JSON.stringify(summaryData),
        lastUpdatedDate: new Date()
      }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "updateCustomerSummary");
  }
}

export async function submitDistrictLafAndSummary(loanRequestId: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "submitDistrictLafAndSummary");

    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: { workflowVersion: { include: { stages: true } } }
      });

      if (!loan) throw new Error("Loan not found");

      // Find the stage with order 5 (District Operation Manager Check)
      const nextStage = loan.workflowVersion?.stages.find(s => s.order === 5);
      if (!nextStage) throw new Error("Next stage (District Manager Check) not found in workflow version.");

      const now = new Date();
      const updatedLoan = await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          currentWorkflowStage: { connect: { id: nextStage.id } },
          assignedDepartment: { connect: { id: nextStage.responsibleDepartmentId } },
          stageEntryDate: now,
          currentStageStatus: 'Initiated',
          assignedToUsers: { set: [] }, // Clear CRM assignment, goes to Manager queue
          lastUpdatedDate: now,
          isReadyForManagerReview: true,
          history: {
            create: {
              userId: user.id,
              stageName: nextStage.name,
              notes: `LAF and Customer Summary finalized by CRM. Case forwarded for District Operation Manager review.`,
            }
          }
        }
      });

      return updatedLoan;
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "submitDistrictLafAndSummary");
  }
}

export async function approveDistrictManagerCheck(loanRequestId: string, managerComments?: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "approveDistrictManagerCheck");

    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: { workflowVersion: { include: { stages: true } } }
      });

      if (!loan) throw new Error("Loan not found");

      // Find stage with order 6 (District Analyst Review)
      const nextStage = loan.workflowVersion?.stages.find(s => s.order === 6);
      if (!nextStage) throw new Error("Next stage (Analyst Review) not found in workflow version.");

      const now = new Date();
      
      // Update LAF data with manager comments if provided
      let lafData = loan.lafData ? JSON.parse(loan.lafData as string) : {};
      if (managerComments) {
        lafData.managerComments = managerComments;
      }

      const updatedLoan = await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          lafData: JSON.stringify(lafData),
          currentWorkflowStage: { connect: { id: nextStage.id } },
          assignedDepartment: { connect: { id: nextStage.responsibleDepartmentId } },
          stageEntryDate: now,
          currentStageStatus: 'Initiated',
          assignedToUsers: { set: [] }, // Goes to Analyst queue
          lastUpdatedDate: now,
          isReadyForManagerReview: false,
          history: {
            create: {
              userId: user.id,
              stageName: nextStage.name,
              notes: `District Manager reviewed and approved the LAF/Summary. Case forwarded to Analyst Review.`,
            }
          }
        }
      });

      return updatedLoan;
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "approveDistrictManagerCheck");
  }
}

export async function approveDistrictAnalyst(loanRequestId: string, analystRecommendation?: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "approveDistrictAnalyst");

    await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: {
          workflowVersion: { include: { stages: true } },
          assignedToUsers: { select: { id: true } },
        },
      });

      if (!loan) throw new Error("Loan not found");

      const currentStage = loan.workflowVersion?.stages.find((s) => s.id === loan.currentStageId);
      if (currentStage?.order !== 6) {
        throw new Error("Case must be at District Analyst Review to send to the Operation Manager.");
      }

      if (
        loan.currentStageStatus === 'RETURNED_FOR_COMMENT' ||
        loan.currentStageStatus === 'RETURNED_FOR_REWORK'
      ) {
        throw new Error(
          "This case was returned by the Operation Manager. Add your response and use Distribute for District Approval instead of sending back to the manager."
        );
      }

      // Find stage with order 7 (Final Operation Manager Review)
      const nextStage = loan.workflowVersion?.stages.find(s => s.order === 7);
      if (!nextStage) throw new Error("Next stage (Final Manager Review) not found in workflow version.");

      const now = new Date();
      
      // Update LAF data with analyst recommendation and previous analyst tracking
      let lafData = loan.lafData ? JSON.parse(loan.lafData as string) : {};
      if (analystRecommendation) {
        lafData.analystRecommendation = analystRecommendation;
      }
      lafData.sentToFinalManagerAt = now.toISOString();
      
      // Store current assignees so we can "Reback" to them later
      const currentAssigneeIds = loan.assignedToUsers.map((u) => u.id);
      lafData.previousAnalystIds = currentAssigneeIds;

      await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          lafData: JSON.stringify(lafData),
          currentWorkflowStage: { connect: { id: nextStage.id } },
          assignedDepartment: { connect: { id: nextStage.responsibleDepartmentId } },
          stageEntryDate: now,
          currentStageStatus: 'Initiated',
          assignedToUsers: { set: [] }, // Goes to Final Manager queue
          lastUpdatedDate: now,
          isReadyForManagerReview: true, // Mark as ready for final manager review
          history: {
            create: {
              userId: user.id,
              stageName: nextStage.name,
              notes: `District Analyst completed review and findings. Case forwarded for Final Manager Review.`,
            }
          }
        }
      });
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "approveDistrictAnalyst");
  }
}

/**
 * Stage 7 -> 6: Return for Rework (Reback)
 */
export async function returnToOriginatingCRM(
  loanRequestId: string,
  note: string,
  isCommentOnly?: boolean
) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "returnToOriginatingCRM");

    await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: {
          workflowVersion: {
            include: {
              workflowDefinition: { select: { order: true } },
              stages: { orderBy: { order: 'asc' }, include: { responsibleDepartment: true } }
            }
          },
          customer: { select: { name: true } },
          createdBy: true,
        },
      });

      if (!loan) throw new Error("Loan not found");
      if (!loan.createdById) throw new Error("Originating CRM/RM not found for this loan.");

      // The case currently sits in a specialist workflow (e.g. WF-02 Valuation
      // or WF-05 Appraisal). "Return to Originating CRM" sends it back to the RM
      // handoff point: the immediately preceding RM/CRM workflow, landing on the
      // stage that forwarded the case onward (e.g. WF-01's "Submit to Property
      // Valuation"), so the originating RM resumes from where they handed off —
      // not at the start of the workflow.
      const currentOrder = loan.workflowVersion?.workflowDefinition?.order ?? 0;
      const precedingWorkflow = await tx.workflowDefinition.findFirst({
        where: {
          sectorId: loan.sectorId,
          order: { lt: currentOrder },
          NOT: [
            { name: { contains: "Appeal", mode: "insensitive" } },
            { name: { contains: "Optional", mode: "insensitive" } },
          ],
        },
        orderBy: { order: "desc" }, // the workflow immediately before the current one
        include: {
          versions: {
            where: { isActive: true },
            take: 1,
            include: {
              stages: { orderBy: { order: "asc" }, include: { responsibleDepartment: true } },
            },
          },
        },
      });

      const precedingVersion = precedingWorkflow?.versions[0];
      const precedingStages = precedingVersion?.stages ?? [];
      // The handoff stage is the last stage of that RM workflow — the one whose
      // completion forwarded the case into the specialist workflow.
      const handoffStage = precedingStages.length
        ? precedingStages[precedingStages.length - 1]
        : undefined;
      // Fall back to the current workflow's first stage when there is no
      // preceding workflow (e.g. the single-workflow District flow).
      const targetStage = handoffStage ?? loan.workflowVersion?.stages[0];
      if (!targetStage) throw new Error("Target stage not found for return.");
      const switchesWorkflow = !!precedingVersion && precedingVersion.id !== loan.workflowVersionId;

      const now = new Date();
      const status = isCommentOnly ? 'RETURNED_FOR_COMMENT' : 'RETURNED_FOR_REWORK';
      const historyNotes = isCommentOnly 
        ? `Returned to Originating CRM/RM for comment: ${note}` 
        : `Returned to Originating CRM/RM for rework: ${note}`;
      const action = isCommentOnly ? 'COMMENT_REQUESTED' : 'REWORKED';

      await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          ...(switchesWorkflow
            ? { workflowVersion: { connect: { id: precedingVersion!.id } } }
            : {}),
          currentWorkflowStage: { connect: { id: targetStage.id } },
          assignedDepartment: { connect: { id: targetStage.responsibleDepartmentId } },
          stageEntryDate: now,
          currentStageStatus: status,
          isReadyForManagerReview: false,
          isReadyForValuation: false,
          assignedToUsers: { set: [{ id: loan.createdById }] },
          lastUpdatedDate: now,
          history: {
            create: {
              userId: user.id,
              stageName: targetStage.name,
              notes: historyNotes,
            }
          }
        }
      });

      // Record in reviews table
      await tx.caseReviewHistory.create({
        data: {
          loanRequest: { connect: { id: loanRequestId } },
          performedBy: { connect: { id: user.id } },
          action: action,
          comment: note,
          createdAt: now,
        }
      });

      // Clear from Valuation Queue so it disappears from the valuation dashboard
      await tx.valuationQueue.deleteMany({ where: { loanRequestId } });

      await createCaseAssignedNotifications(tx, {
        loanRequestId,
        loanNumber: loan.loanNumber,
        customerName: loan.customer?.name,
        assigneeIds: [loan.createdById],
        assignedByUserId: user.id,
        assignedByName: user.fullName,
      });
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "returnToOriginatingCRM");
  }
}

/**
 * "Rework — one step back": returns the case to the immediately preceding stage
 * within the SAME workflow version (currentOrder - 1), re-opening it for that
 * stage's responsible department. Sign-offs on the current stage are cleared.
 * When the previous stage is in the same department, the supplied assignees are
 * kept; otherwise the assignment is cleared so the previous department picks it up.
 */
export async function returnToPreviousStage(
  loanRequestId: string,
  note: string,
  assigneeIds: string[] = []
) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "returnToPreviousStage");
    if (!user.permissions.includes(PERMISSIONS.RETURN_LOAN_FOR_REWORK)) {
      return createErrorResult("You do not have permission to return a loan for rework.", "returnToPreviousStage");
    }

    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: {
          workflowVersion: {
            include: {
              stages: { orderBy: { order: 'asc' }, include: { responsibleDepartment: true } },
            },
          },
          customer: { select: { name: true } },
        },
      });

      if (!loan) throw new Error("Loan not found");
      const stages = loan.workflowVersion?.stages ?? [];
      const currentIndex = stages.findIndex((s) => s.id === loan.currentStageId);
      if (currentIndex === -1) throw new Error("Current stage not found in workflow.");
      if (currentIndex === 0) {
        // No earlier stage in this workflow — caller should use Return to Originating CRM.
        return { atFirstStage: true as const };
      }

      const previousStage = stages[currentIndex - 1];
      const sameDepartment = previousStage.responsibleDepartmentId === loan.assignedDepartmentId;
      const keepAssignees = sameDepartment && assigneeIds.length > 0;
      const now = new Date();

      await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          currentWorkflowStage: { connect: { id: previousStage.id } },
          assignedDepartment: { connect: { id: previousStage.responsibleDepartmentId } },
          stageEntryDate: now,
          currentStageStatus: 'RETURNED_FOR_REWORK',
          isReadyForManagerReview: false,
          stageCompletedBy: { set: [] },
          assignedToUsers: keepAssignees
            ? { set: assigneeIds.map((id) => ({ id })) }
            : { set: [] },
          lastUpdatedDate: now,
          history: {
            create: {
              userId: user.id,
              stageName: previousStage.name,
              notes: `Returned one step back to "${previousStage.name}" for rework: ${note}`,
            },
          },
        },
      });

      await tx.caseReviewHistory.create({
        data: {
          loanRequest: { connect: { id: loanRequestId } },
          performedBy: { connect: { id: user.id } },
          action: 'REWORKED',
          comment: note,
          createdAt: now,
        },
      });

      const notifyIds = keepAssignees ? assigneeIds : [];
      if (notifyIds.length > 0) {
        await createCaseAssignedNotifications(tx, {
          loanRequestId,
          loanNumber: loan.loanNumber,
          customerName: loan.customer?.name,
          assigneeIds: notifyIds,
          assignedByUserId: user.id,
          assignedByName: user.fullName,
        });
      }

      return { atFirstStage: false as const, previousStageName: previousStage.name };
    });

    if (result.atFirstStage) {
      return createErrorResult(
        "This case is already at the first stage of its workflow. Use 'Return to Originating CRM' instead.",
        "returnToPreviousStage"
      );
    }

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "returnToPreviousStage");
  }
}

export async function returnToDistrictAnalyst(
  loanRequestId: string,
  note: string,
  assigneeIds: string[],
  isCommentOnly?: boolean
) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "returnToDistrictAnalyst");

    await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: {
          workflowVersion: { include: { stages: true } },
          customer: { select: { name: true } },
        },
      });

      if (!loan) throw new Error("Loan not found");

      // Find stage with order 6 (District Analyst Review)
      const targetStage = loan.workflowVersion?.stages.find(s => s.order === 6);
      if (!targetStage) throw new Error("Target stage (Analyst Review) not found.");

      const now = new Date();
      const status = isCommentOnly ? 'RETURNED_FOR_COMMENT' : 'RETURNED_FOR_REWORK';
      const historyNotes = isCommentOnly 
        ? `Returned to Analyst for comment: ${note}` 
        : `Returned to Analyst for rework: ${note}`;
      const action = isCommentOnly ? 'COMMENT_REQUESTED' : 'REWORKED';

      let returnAssigneeIds = assigneeIds;
      const lafData = loan.lafData ? JSON.parse(loan.lafData as string) : {};
      if (returnAssigneeIds.length === 0 && Array.isArray(lafData.previousAnalystIds) && lafData.previousAnalystIds.length > 0) {
        returnAssigneeIds = lafData.previousAnalystIds;
      }

      await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          currentWorkflowStage: { connect: { id: targetStage.id } },
          assignedDepartment: { connect: { id: targetStage.responsibleDepartmentId } },
          stageEntryDate: now,
          currentStageStatus: status,
          isReadyForManagerReview: false,
          assignedToUsers: { set: returnAssigneeIds.map(id => ({ id })) },
          lastUpdatedDate: now,
          history: {
            create: {
              userId: user.id,
              stageName: targetStage.name,
              notes: historyNotes,
            }
          }
        }
      });

      // Record in reviews table too
      await tx.caseReviewHistory.create({
        data: {
          loanRequest: { connect: { id: loanRequestId } },
          performedBy: { connect: { id: user.id } },
          action: action,
          comment: note,
          createdAt: now,
        }
      });

      if (returnAssigneeIds.length > 0) {
        await createCaseAssignedNotifications(tx, {
          loanRequestId,
          loanNumber: loan.loanNumber,
          customerName: loan.customer?.name,
          assigneeIds: returnAssigneeIds,
          assignedByUserId: user.id,
          assignedByName: user.fullName,
        });
      }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "returnToDistrictAnalyst");
  }
}
export async function approveFinalDistrictManager(loanRequestId: string, managerFinalComments: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "approveFinalDistrictManager");

    await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: { workflowVersion: { include: { stages: true } } }
      });

      if (!loan) throw new Error("Loan not found");

      const nextStage = loan.workflowVersion?.stages.find(s => s.order === 8);
      if (!nextStage) throw new Error("Next stage (Committee Distribution) not found.");

      let lafData = loan.lafData ? JSON.parse(loan.lafData as string) : {};
      lafData.managerFinalComments = managerFinalComments;
      lafData.managerFinalApprovalDate = new Date().toISOString();

      const now = new Date();
      await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          lafData: JSON.stringify(lafData),
          currentWorkflowStage: { connect: { id: nextStage.id } },
          assignedDepartment: { connect: { id: nextStage.responsibleDepartmentId } },
          stageEntryDate: now,
          currentStageStatus: 'Initiated',
          assignedToUsers: { set: [] }, // Goes to Analyst for distribution
          isReadyForManagerReview: false,
          lastUpdatedDate: now,
          history: {
            create: {
              userId: user.id,
              stageName: nextStage.name,
              notes: `Final Operation Manager Review completed. Case forwarded back to Analyst for Committee Distribution.`,
            }
          }
        }
      });
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "approveFinalDistrictManager");
  }
}

/**
 * Stage 8 -> 9: Analyst Distribution -> Committee Approval
 */
export async function distributeToCommittee(loanRequestId: string, distributionNotes: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "distributeToCommittee");

    const canDistribute =
      user.permissions.includes(PERMISSIONS.DISTRIBUTE_TO_DISTRICT_APPROVAL) ||
      user.permissions.includes(PERMISSIONS.MANAGE_USERS);
    if (!canDistribute) {
      return createErrorResult(
        "You do not have permission to distribute cases for district approval.",
        "distributeToCommittee"
      );
    }

    await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: { workflowVersion: { include: { stages: true } } }
      });

      if (!loan) throw new Error("Loan not found");

      const currentStage = loan.workflowVersion?.stages.find((s) => s.id === loan.currentStageId);
      if (!currentStage) throw new Error("Current workflow stage not found.");

      if (
        !canDistributeToDistrictApproval({
          submissionType: loan.submissionType,
          currentStageOrder: currentStage.order,
          currentStageStatus: loan.currentStageStatus,
        })
      ) {
        throw new Error(
          "This case is not ready for district approval distribution. It must be returned to the analyst for comment/rework, or be at the Committee Distribution stage."
        );
      }

      const nextStage = loan.workflowVersion?.stages.find(s => s.order === 9);
      if (!nextStage) throw new Error("Next stage (Committee Approval) not found.");

      let lafData = loan.lafData ? JSON.parse(loan.lafData as string) : {};
      lafData.distributionNotes = distributionNotes;
      lafData.distributedAt = new Date().toISOString();

      const now = new Date();
      await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          lafData: JSON.stringify(lafData),
          currentWorkflowStage: { connect: { id: nextStage.id } },
          assignedDepartment: { connect: { id: nextStage.responsibleDepartmentId } },
          stageEntryDate: now,
          currentStageStatus: 'READY_FOR_COMMITTEE',
          assignedToUsers: { set: [] }, 
          isReadyForManagerReview: false,
          lastUpdatedDate: now,
          history: {
            create: {
              userId: user.id,
              stageName: nextStage.name,
              notes: `Analyst distributed the case to the Committee for final approval. Notes: ${distributionNotes}`,
            }
          }
        }
      });
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "distributeToCommittee");
  }
}

export async function updateValuationReport(loanRequestId: string, reportData: any) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "updateValuationReport");

    await prisma.loanRequest.update({
      where: { id: loanRequestId },
      data: {
        valuationReportData: JSON.stringify(reportData),
        lastUpdatedDate: new Date()
      }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "updateValuationReport");
  }
}

export async function completeValuationWork(loanRequestId: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "completeValuationWork");

    await prisma.$transaction(async (tx) => {
      const queueEntry = await tx.valuationQueue.findUnique({
        where: { loanRequestId },
      });

      if (!queueEntry) throw new Error("Valuation queue entry not found");

      // Officer submissions advance per current status:
      //   ASSIGNED_TO_OFFICER          -> ASSIGNED_TO_CHECKER_MANAGER  (hand to the Checker queue)
      //   ASSIGNED_TO_CHECKER_OFFICER  -> PENDING_CHECKER_REVIEW       (Checker Manager final review)
      let nextStatus: string;
      let nextStageName: string;
      let notes: string;
      if (queueEntry.status === "ASSIGNED_TO_OFFICER") {
        nextStatus = "ASSIGNED_TO_CHECKER_MANAGER";
        nextStageName = "Valuation Checker";
        notes = `Valuation completed by ${user.fullName}. Forwarded to the Checker queue.`;
      } else if (queueEntry.status === "ASSIGNED_TO_CHECKER_OFFICER") {
        nextStatus = "PENDING_CHECKER_REVIEW";
        nextStageName = "Valuation Checker 01-A";
        notes = `Verification completed by ${user.fullName}. Pending Checker Manager review.`;
      } else {
        throw new Error("Case is not in a state that can be submitted by an officer.");
      }

      await tx.valuationQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: nextStatus,
          assignedToId: null, // Clear per-step assignment; case becomes a queue item
        }
      });

      const data: any = {
        lastUpdatedDate: new Date(),
        assignedToUsers: { set: [] }, // Clear officer assignment after completion
        history: {
          create: {
            userId: user.id,
            stageName: "Valuation Completed",
            notes,
          }
        }
      };

      // Keep the Head Office (TYPE1) WF-02 stage in sync with the queue status.
      const loan = await tx.loanRequest.findUnique({
        where: { id: loanRequestId },
        select: {
          submissionType: true,
          workflowVersion: { select: { stages: { include: { responsibleDepartment: true } } } },
        },
      });
      if (loan?.submissionType === 'TYPE1') {
        const stage = loan.workflowVersion?.stages.find((s: any) => s.name === nextStageName);
        if (stage) {
          const now = new Date();
          data.currentWorkflowStage = { connect: { id: stage.id } };
          data.assignedDepartment = { connect: { id: stage.responsibleDepartmentId } };
          data.stageEntryDate = now;
          data.stageDeadline = addDays(now, stage.defaultTimelineDays);
        }
      }

      return await tx.loanRequest.update({
        where: { id: loanRequestId },
        data,
      });
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "completeValuationWork");
  }
}

export async function forwardToAnalyst(loanRequestId: string, analystId: string) {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "forwardToAnalyst");

    await prisma.loanRequest.update({
      where: { id: loanRequestId },
      data: {
        assignedToUsers: {
          set: [{ id: analystId }]
        },
        currentStageStatus: "UNDER_ANALYSIS",
        lastUpdatedDate: new Date(),
        history: {
          create: {
            userId: user.id,
            stageName: "Forward to Analyst",
            notes: `Case forwarded to Analyst (User ID ${analystId}) by ${user.fullName}.`,
          }
        }
      }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "forwardToAnalyst");
  }
}

export async function getDistrictAnalystsForLoan(loanRequestId: string): Promise<{ analysts?: User[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "getDistrictAnalystsForLoan");

    const loan = await prisma.loanRequest.findUnique({
      where: { id: loanRequestId },
      select: {
        id: true,
        assignedDepartmentId: true,
        createdById: true,
        customer: { select: { branch: true } },
        assignedToUsers: { select: { id: true } },
      },
    });

    if (!loan) return createErrorResult("Loan not found", "getDistrictAnalystsForLoan");

    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);
    const isCreator = loan.createdById === user.id;
    const isAssigned = loan.assignedToUsers.some((u) => u.id === user.id);
    if (!isAdmin && !isCreator && !isAssigned) {
      return createErrorResult("Unauthorized", "getDistrictAnalystsForLoan");
    }


    // 1. Determine the district of the loan from its customer's branch
    let loanDistrictId: string | null = null;
    if (loan.customer?.branch) {
      const branch = await prisma.branch.findFirst({
        where: { name: loan.customer.branch },
        select: { districtId: true }
      });
      if (branch) loanDistrictId = branch.districtId;
    }

    const prismaAnalysts = await prisma.user.findMany({
      where: {
        isActive: true,
        department: {
          name: "District"
        },
        // Strict District filter: analyst must be in the same district or mapped to it
        ...(loanDistrictId ? {
          OR: [
            { districtId: loanDistrictId },
            { crmMappings: { some: { branch: { districtId: loanDistrictId } } } }
          ]
        } : {})
      },
      include: { department: true, customRole: true },
      orderBy: { name: "asc" },
    });

    return { analysts: prismaAnalysts.map(mapPrismaUserToAppUser) };
  } catch (e: any) {
    return createErrorResult(e.message, "getDistrictAnalystsForLoan");
  }
}

export async function handoffValuationReturnToAnalyst(
  loanRequestId: string,
  analystId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "handoffValuationReturnToAnalyst");

    const loan = await prisma.loanRequest.findUnique({
      where: { id: loanRequestId },
      select: {
        id: true,
        loanNumber: true,
        assignedDepartmentId: true,
        currentStageStatus: true,
        createdById: true,
        assignedToUsers: { select: { id: true } },
      },
    });
    if (!loan) return createErrorResult("Loan not found", "handoffValuationReturnToAnalyst");

    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);
    const isCreator = loan.createdById === user.id;
    const isAssigned = loan.assignedToUsers.some((u) => u.id === user.id);
    if (!isAdmin && !isCreator && !isAssigned) {
      return createErrorResult("Unauthorized", "handoffValuationReturnToAnalyst");
    }

    if (loan.currentStageStatus !== "RETURNED_FROM_VALUATION") {
      return createErrorResult(
        "This case is not currently in returned-from-valuation status.",
        "handoffValuationReturnToAnalyst"
      );
    }



    const analyst = await prisma.user.findUnique({
      where: { id: analystId },
      select: {
        id: true,
        name: true,
        isActive: true,
        departmentId: true,
        customRole: { select: { name: true } },
      },
    });

    if (!analyst || !analyst.isActive) {
      return createErrorResult("Selected analyst is not active.", "handoffValuationReturnToAnalyst");
    }
    if (loan.assignedDepartmentId && analyst.departmentId !== loan.assignedDepartmentId) {
      return createErrorResult("Selected analyst is in a different department.", "handoffValuationReturnToAnalyst");
    }
    const roleName = analyst.customRole?.name?.toLowerCase() || "";
    if (!roleName.includes("analyst") && !roleName.includes("appraisal") && !roleName.includes("anays")) {
      return createErrorResult("Selected user is not an analyst.", "handoffValuationReturnToAnalyst");
    }

    const loanMeta = await prisma.loanRequest.findUnique({
      where: { id: loanRequestId },
      select: { loanNumber: true, customer: { select: { name: true } } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.loanRequest.update({
        where: { id: loanRequestId },
        data: {
          assignedToUsers: { set: [{ id: analyst.id }] },
          assignedBy: { connect: { id: user.id } },
          currentStageStatus: "UNDER_ANALYSIS",
          lastUpdatedDate: new Date(),
          isReadyForManagerReview: false,
          history: {
            create: {
              userId: user.id,
              stageName: "Forward to Analyst",
              notes: `Case returned from valuation and forwarded to district analyst (${analyst.name || analyst.id}) by ${user.fullName}.`,
            },
          },
        },
      });

      if (loanMeta) {
        await createCaseAssignedNotifications(tx, {
          loanRequestId,
          loanNumber: loanMeta.loanNumber,
          customerName: loanMeta.customer?.name,
          assigneeIds: [analyst.id],
          assignedByUserId: user.id,
          assignedByName: user.fullName,
        });
      }
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult(e.message, "handoffValuationReturnToAnalyst");
  }
}

export async function getLoanRequests() {
  const { user } = await getCurrentUser();
  if (!user) return createErrorResult("Unauthorized", "getLoanRequests");
  return getLoanRequestsInternal(user);
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; workflowDefinitions?: WorkflowDefinition[] }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    const prismaLoan = await prisma.loanRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: {
          include: {
            workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } },
            stages: { orderBy: { order: 'asc' }, include: { responsibleDepartment: true, documentRequirements: true } },
          },
        },
        assignedDepartment: true,
        assignedBy: true,
        valuationQueue: { include: { makerOfficer: { select: { name: true } } } },
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    if (!prismaLoan) {
      return { loan: null, users: [], error: `Loan not found.` };
    }

    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);
    const isCreator = prismaLoan.createdById === user.id;
    const isAssigned = prismaLoan.assignedToUsers.some(u => u.id === user.id);
    const hasHistoryInvolvement = prismaLoan.history.some(h => h.userId === user.id);
    const isInLoanDepartment = Boolean(user.departmentId && prismaLoan.assignedDepartmentId === user.departmentId);
    const hasFullView = user.permissions.includes(PERMISSIONS.VIEW_LOAN_DETAILS);

    if (!isAdmin && !(hasFullView && isInLoanDepartment) && !isCreator && !isAssigned && !hasHistoryInvolvement) {
      return { error: "Unauthorized access to this loan record." };
    }

    const appLoan = mapPrismaLoanToAppLoan(prismaLoan as any);
    const prismaUsers = await prisma.user.findMany({ 
      where: { 
        OR: [
          { departmentId: prismaLoan.assignedDepartmentId || undefined },
          ...(prismaLoan.submissionType === 'TYPE2' ? [{ department: { name: 'District' } }] : [])
        ],
        isActive: true
      },
      include: { 
        department: true, 
        customRole: true,
        crmMappings: {
          include: {
            branch: {
              include: {
                district: true
              }
            }
          }
        }
      } 
    });
    const appUsers = prismaUsers.map(mapPrismaUserToAppUser);

    const wfDefsResult = await getWorkflowDefinitions();

    return { loan: appLoan, users: appUsers, workflowDefinitions: wfDefsResult.workflows };
  } catch (e: any) {
    return createErrorResult(`Failed to fetch loan request.`, "getLoanRequestById", e);
  }
}

export async function updateLoanRequest(
  id: string,
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>> & { respondToInfoRequest?: { entryId: string, response: string, markFulfilled: boolean } }
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return createErrorResult("Unauthorized", "updateLoanRequest");

    const existingLoan = await prisma.loanRequest.findUnique({
      where: { id },
      include: {
        history: true,
        documents: true,
        assignedToUsers: true,
        currentWorkflowStage: true,
        customer: { select: { name: true } },
      }
    });
    if (!existingLoan) throw new Error(`Loan not found.`);

    let selectedUsersForAssignmentAudit: { id: string; name: string }[] = [];

    if (dataToUpdate.hasOwnProperty('assignedToUsers')) {
      const userPermissions = new Set(user.permissions || []);
      const isAdmin = userPermissions.has(PERMISSIONS.MANAGE_USERS);
      const selectedAssigneeIds = (dataToUpdate.assignedToUsers || []).map((u: any) => u.id).filter(Boolean);
      const isAssigningBackToAssigner = selectedAssigneeIds.length === 1 && selectedAssigneeIds[0] === existingLoan.assignedById;

      const canAssign = isAdmin
        || userPermissions.has(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)
        || isAssigningBackToAssigner;

      if (!canAssign) {
        return createErrorResult("Unauthorized: missing assignment permission.", "updateLoanRequest");
      }

      const isInLoanDepartment = Boolean(
        user.departmentId
        && existingLoan.assignedDepartmentId
        && user.departmentId === existingLoan.assignedDepartmentId
      );

      if (!isAdmin && !isInLoanDepartment) {
        return createErrorResult("Unauthorized: you can only assign within the loan's current department.", "updateLoanRequest");
      }

      if (selectedAssigneeIds.length > 0) {
        const selectedUsers = await prisma.user.findMany({
          where: { id: { in: selectedAssigneeIds } },
          select: { id: true, name: true, departmentId: true, isActive: true },
        });

        if (selectedUsers.length !== selectedAssigneeIds.length) {
          return createErrorResult("One or more selected assignees were not found.", "updateLoanRequest");
        }

        selectedUsersForAssignmentAudit = selectedUsers.map(u => ({ id: u.id, name: u.name }));

        if (!isAdmin) {
          const hasOutOfDepartmentAssignee = selectedUsers.some(
            selectedUser => selectedUser.departmentId !== existingLoan.assignedDepartmentId
          );
          if (hasOutOfDepartmentAssignee) {
            return createErrorResult("Assignees must belong to the loan's current department.", "updateLoanRequest");
          }

          const hasInactiveAssignee = selectedUsers.some(selectedUser => !selectedUser.isActive);
          if (hasInactiveAssignee) {
            return createErrorResult("Cannot assign to inactive users.", "updateLoanRequest");
          }
        }
      }
    }

    const updatedPrismaLoan = await prisma.$transaction(async (tx) => {
      const updatePayload: any = { lastUpdatedDate: new Date() };

      const simpleFields: (keyof Pick<LoanRequest, 'loanPurpose' | 'isReadyForManagerReview' | 'currentStageStatus' | 'isTerminalStage' | 'isUrgent' | 'lafStatus'>)[] = ['loanPurpose', 'isReadyForManagerReview', 'currentStageStatus', 'isTerminalStage', 'isUrgent', 'lafStatus'];
      simpleFields.forEach(field => {
        if (dataToUpdate[field] !== undefined) updatePayload[field] = dataToUpdate[field];
      });

      const jsonFields: (keyof Pick<LoanRequest, 'lafData' | 'pvrData' | 'customerSummaryData' | 'valuationReportData'>)[] = ['lafData', 'pvrData', 'customerSummaryData', 'valuationReportData'];
      jsonFields.forEach(field => {
        if (dataToUpdate[field] !== undefined) {
          updatePayload[field] = typeof dataToUpdate[field] === 'string' ? dataToUpdate[field] : JSON.stringify(dataToUpdate[field]);
        }
      });

      if (dataToUpdate.loanAmount !== undefined) {
        updatePayload.loanAmount = dataToUpdate.loanAmount;
      }

      if (dataToUpdate.hasOwnProperty('assignedToUsers')) {
        const userIds = dataToUpdate.assignedToUsers?.map(u => ({ id: u.id })) || [];
        updatePayload.assignedToUsers = { set: userIds };
        updatePayload.assignedBy = { connect: { id: user.id } };
      }

      if (dataToUpdate.hasOwnProperty('stageCompletedBy')) {
        const userIds = dataToUpdate.stageCompletedBy?.map(u => ({ id: u.id })) || [];
        updatePayload.stageCompletedBy = { set: userIds };
      }

      // VITAL: Handle Stage Transition and Department Update
      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== existingLoan.currentStageId) {
        const wfVerId = dataToUpdate.workflowVersionId || existingLoan.workflowVersionId;
        if (!wfVerId) throw new Error("Workflow version ID missing for transition.");

        const newStageDef = await tx.workflowStageDefinition.findUnique({
          where: { id: dataToUpdate.currentStageId },
          include: {
            responsibleDepartment: true,
            workflowVersion: { include: { workflowDefinition: true } },
          }
        });
        if (!newStageDef) throw new Error(`Stage definition not found.`);

        updatePayload.currentWorkflowStage = { connect: { id: newStageDef.id } };
        updatePayload.workflowVersion = { connect: { id: wfVerId } };
        updatePayload.stageEntryDate = new Date();
        updatePayload.stageDeadline = addDays(new Date(), newStageDef.defaultTimelineDays);
        const isDepartmentHandover = existingLoan.assignedDepartmentId !== newStageDef.responsibleDepartmentId;

        updatePayload.isReadyForManagerReview = false;
        updatePayload.stageCompletedBy = { set: [] };
        const explicitAssigneesProvided = dataToUpdate.hasOwnProperty('assignedToUsers');
        if (isDepartmentHandover && !explicitAssigneesProvided) {
          let autoAssignee: { id: string; name: string; customRoleName: string | null } | null = null;

          if (existingLoan.submissionType === 'TYPE1') {
            // Head Office workflow: if this department has been visited before, return to the
            // last handler there; otherwise escalate to the highest authority (Chief > Director > Manager).
            const lastHandler = await findLastHandlerInDepartment(
              tx,
              newStageDef.responsibleDepartmentId,
              existingLoan.history as { userId: string; timestamp: Date }[],
            );
            autoAssignee = lastHandler ?? await findHighestAuthorityInDepartment(tx, newStageDef.responsibleDepartmentId);
          } else {
            // District or other workflows: use existing role-based assignment.
            autoAssignee = await findWorkflowAssignee(tx, {
              departmentId: newStageDef.responsibleDepartmentId,
              departmentName: newStageDef.responsibleDepartment.name,
              stageName: newStageDef.name,
              workflowName: newStageDef.workflowVersion.workflowDefinition.name,
              allowedRoles: newStageDef.allowedRoles,
              preferredUserIds: existingLoan.createdById ? [existingLoan.createdById] : [],
            });
          }

          if (autoAssignee) {
            updatePayload.assignedToUsers = { set: [{ id: autoAssignee.id }] };
            updatePayload.assignedBy = { connect: { id: user.id } };

            await createCaseAssignedNotifications(tx, {
              loanRequestId: id,
              loanNumber: existingLoan.loanNumber,
              customerName: existingLoan.customer?.name,
              assigneeIds: [autoAssignee.id],
              assignedByUserId: user.id,
              assignedByName: user.fullName,
            });
          } else {
            updatePayload.assignedToUsers = { set: [] };
            updatePayload.assignedBy = { disconnect: true };
          }
        }

        updatePayload.assignedDepartment = { connect: { id: newStageDef.responsibleDepartmentId } };

        const availableStatusesObj = safeJsonParse<Record<string, string[]>>(newStageDef.availableStatuses, {});
        const availableStatusesForDept = availableStatusesObj[newStageDef.responsibleDepartment.name] || [];
        updatePayload.currentStageStatus = availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';

        const workflowCode = getWorkflowCodeFromName(newStageDef.workflowVersion.workflowDefinition.name);
        const isValuationWorkflow = workflowCode === 2 || workflowCode === 4 || normalizeRoutingName(newStageDef.responsibleDepartment.name).includes('valuation');
        if (isValuationWorkflow) {
          // The case enters the unified valuation flow at the Director's incoming queue
          // (status PENDING). It is NOT auto-assigned to an officer here — the Director
          // routes it onward via the /valuation workspace. Clear any officer assignment
          // and reset prior routing so re-entry starts clean.
          updatePayload.assignedToUsers = { set: [] };
          updatePayload.isReadyForValuation = true;
          updatePayload.isValuationCompleted = false;
          await tx.valuationQueue.upsert({
            where: { loanRequestId: id },
            update: {
              status: 'PENDING',
              assignedToId: null,
              routingOption: null,
              makerId: null,
              isCheckedByChecker: false,
            },
            create: {
              loanRequestId: id,
              status: 'PENDING',
            },
          });
          // Record the sender so the case returns to them when valuation completes
          // (the completion logic looks up the latest "Forward to Valuation" event).
          await tx.loanHistoryEntry.create({
            data: {
              loanRequestId: id,
              userId: user.id,
              stageName: "Forward to Valuation",
              notes: `Case forwarded to the Valuation Department by ${user.fullName}.`,
            },
          });
        }
      }

      if (dataToUpdate.respondToInfoRequest) {
        const { entryId, response, markFulfilled } = dataToUpdate.respondToInfoRequest;
        await tx.loanHistoryEntry.update({
          where: { id: entryId },
          data: {
            fulfillmentNotes: response,
            isFulfilled: markFulfilled,
            updatedAt: new Date()
          }
        });
      }

      if (dataToUpdate.hasOwnProperty('history')) {
        const existingHistoryIds = new Set((existingLoan.history || []).map(h => h.id));
        const newEntries = (dataToUpdate.history || []).filter(h => !existingHistoryIds.has(h.id));
        for (const entry of newEntries) {
          await tx.loanHistoryEntry.create({
            data: {
              loanRequest: { connect: { id } },
              user: { connect: { id: entry.userId } },
              stageName: entry.stageName,
              timestamp: parseISO(entry.timestamp),
              notes: entry.notes,
              requiredFulfilment: entry.requiredFulfilment,
              fulfillmentNotes: entry.fulfillmentNotes,
              isFulfilled: entry.isFulfilled || false,
            }
          });
        }
      }

      const hasActionHistoryInPayload = Boolean(
        dataToUpdate.history?.some((h) => {
          const notes = (h.notes || '').toLowerCase();
          return (
            notes.includes('marked complete')
            || notes.includes('pending approval')
            || notes.includes('submitted for manager review')
            || notes.includes('approved')
            || notes.includes('promoted')
            || notes.includes('returned for rework')
            || notes.includes('rework')
          );
        })
      );

      const submittedForManagerReview = dataToUpdate.isReadyForManagerReview === true;
      const completedByCurrentUser = Boolean(dataToUpdate.stageCompletedBy?.some((u) => u.id === user.id));

      // HEAD OFFICE WORKFLOW ENHANCEMENT:
      // When a staff member marks a case as ready for manager review,
      // automatically assign it back to the person who assigned it (the Director or Manager).
      if (submittedForManagerReview && !dataToUpdate.hasOwnProperty('assignedToUsers') && existingLoan.assignedById) {
        updatePayload.assignedToUsers = { set: [{ id: existingLoan.assignedById }] };
      }

      // HEAD OFFICE REWORK ENHANCEMENT:
      // When a case is returned for rework on a TYPE1 loan, auto-assign to the last user who
      // touched it in the current department (overriding any explicit assignee selection).
      if (existingLoan.submissionType === 'TYPE1' && existingLoan.assignedDepartmentId) {
        const existingHistoryIdSet = new Set((existingLoan.history || []).map((h) => h.id));
        const isRework = (dataToUpdate.history || [])
          .filter((h) => !existingHistoryIdSet.has(h.id))
          .some((h) => (h.notes || '').toLowerCase().includes('returned for rework'));

        if (isRework) {
          const lastHandler = await findLastHandlerInDepartment(
            tx,
            existingLoan.assignedDepartmentId,
            existingLoan.history as { userId: string; timestamp: Date }[],
            user.id, // exclude the manager performing the rework
          );
          if (lastHandler) {
            updatePayload.assignedToUsers = { set: [{ id: lastHandler.id }] };
            updatePayload.assignedBy = { connect: { id: user.id } };
            await createCaseAssignedNotifications(tx, {
              loanRequestId: id,
              loanNumber: existingLoan.loanNumber,
              customerName: existingLoan.customer?.name,
              assigneeIds: [lastHandler.id],
              assignedByUserId: user.id,
              assignedByName: user.fullName,
            });
          }
        }
      }

      const stageTransitioned = Boolean(
        dataToUpdate.currentStageId
        && existingLoan.currentStageId
        && dataToUpdate.currentStageId !== existingLoan.currentStageId
      );
      const explicitlyCompleted = (dataToUpdate.currentStageStatus || '').toLowerCase() === 'completed';
      const includesStageActionUpdate = Object.prototype.hasOwnProperty.call(dataToUpdate, 'stageCompletedBy')
        || Object.prototype.hasOwnProperty.call(dataToUpdate, 'isReadyForManagerReview')
        || Object.prototype.hasOwnProperty.call(dataToUpdate, 'currentStageId')
        || Object.prototype.hasOwnProperty.call(dataToUpdate, 'currentStageStatus');

      if (includesStageActionUpdate && completedByCurrentUser && !hasActionHistoryInPayload) {
        let fallbackNotes: string | null = null;
        if (submittedForManagerReview) {
          fallbackNotes = `Marked complete and submitted for manager review by ${user.fullName}.`;
        } else if (stageTransitioned) {
          fallbackNotes = `Approved and promoted by ${user.fullName}.`;
        } else if (explicitlyCompleted) {
          fallbackNotes = `Marked complete by ${user.fullName}.`;
        }

        if (fallbackNotes) {
          await tx.loanHistoryEntry.create({
            data: {
              loanRequest: { connect: { id } },
              user: { connect: { id: user.id } },
              stageName: existingLoan.currentWorkflowStage?.name || 'Current Stage',
              timestamp: new Date(),
              notes: fallbackNotes,
            },
          });
        }
      }

      if (dataToUpdate.hasOwnProperty('assignedToUsers')) {
        const previousIds = (existingLoan.assignedToUsers || []).map(u => u.id).sort();
        const nextIds = (dataToUpdate.assignedToUsers || []).map(u => u.id).filter(Boolean).sort();
        const assignmentChanged = previousIds.length !== nextIds.length
          || previousIds.some((idVal, idx) => idVal !== nextIds[idx]);

        if (assignmentChanged) {
          const assignmentNotes = nextIds.length === 0
            ? `Assignment cleared by ${user.fullName}.`
            : `Assigned by ${user.fullName} to ${selectedUsersForAssignmentAudit.map(u => u.name).join(', ')}.`;

          await tx.loanHistoryEntry.create({
            data: {
              loanRequest: { connect: { id } },
              user: { connect: { id: user.id } },
              stageName: existingLoan.currentWorkflowStage?.name || 'Assignment',
              timestamp: new Date(),
              notes: assignmentNotes,
            },
          });

          if (nextIds.length > 0) {
            const newlyAssigned = selectedUsersForAssignmentAudit.filter(
              (u) => !previousIds.includes(u.id)
            );
            for (const assignedUser of newlyAssigned) {
              await tx.loanHistoryEntry.create({
                data: {
                  loanRequest: { connect: { id } },
                  user: { connect: { id: assignedUser.id } },
                  stageName: existingLoan.currentWorkflowStage?.name || 'Assignment',
                  timestamp: new Date(),
                  notes: `Case assigned to you by ${user.fullName}.`,
                },
              });
            }
            if (newlyAssigned.length > 0) {
              await createCaseAssignedNotifications(tx, {
                loanRequestId: id,
                loanNumber: existingLoan.loanNumber,
                customerName: existingLoan.customer?.name,
                assigneeIds: newlyAssigned.map((u) => u.id),
                assignedByUserId: user.id,
                assignedByName: user.fullName,
              });
            }
          }
        }
      }

      if (dataToUpdate.documents !== undefined) {
        const currentDocIds = new Set(existingLoan.documents.map(d => d.id));
        const updatedDocIds = new Set(dataToUpdate.documents.map(d => d.id));
        const docsToAdd = dataToUpdate.documents.filter(d => !currentDocIds.has(d.id));
        const docsToDelete = existingLoan.documents.filter(d => !updatedDocIds.has(d.id));
        const docsToUpdate = dataToUpdate.documents.filter(d => currentDocIds.has(d.id));

        if (docsToDelete.length > 0) {
          await tx.loanDocument.deleteMany({ where: { id: { in: docsToDelete.map(d => d.id) } } });
        }
        for (const doc of docsToAdd) {
          await tx.loanDocument.create({
            data: {
              loanRequest: { connect: { id } },
              requirement: doc.requirementId ? { connect: { id: doc.requirementId } } : undefined,
              name: doc.name,
              status: doc.status,
              filePath: doc.filePath,
              notes: doc.notes,
              uploadedAt: doc.uploadedAt ? parseISO(doc.uploadedAt) : undefined,
            },
          });
        }
        for (const doc of docsToUpdate) {
          await tx.loanDocument.update({
            where: { id: doc.id },
            data: { status: doc.status, notes: doc.notes, filePath: doc.filePath },
          });
        }
      }

      const updated = await tx.loanRequest.update({
        where: { id },
        data: updatePayload,
        include: {
          customer: true,
          sector: { include: { parent: true } },
          requestType: true,
          assignedToUsers: { include: { department: true, customRole: true } },
          stageCompletedBy: { include: { department: true, customRole: true } },
          currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
          workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
          assignedDepartment: true,
          assignedBy: true,
          history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
          documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
        },
      });
      if (updated.isTerminalStage) {
        await releaseSubmissionDedupForLoan(tx, id);
      }
      return updated;
    });
    const appLoan = mapPrismaLoanToAppLoan(updatedPrismaLoan as any);
    return { success: true, updatedLoan: appLoan };
  } catch (e: any) {
    return createErrorResult(`Failed to update loan request: ${e.message}`, "updateLoanRequest", e);
  }
}

export async function moveLoanToStage(loanRequestId: string, nextStageId: string): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.PROMOTE_LOAN_STAGE)) {
      return createErrorResult("Unauthorized", "moveLoanToStage");
    }

    const [existingLoan, nextStage] = await Promise.all([
      prisma.loanRequest.findUnique({
        where: { id: loanRequestId },
        include: { assignedToUsers: true },
      }),
      prisma.workflowStageDefinition.findUnique({
        where: { id: nextStageId },
        include: {
          responsibleDepartment: true,
          workflowVersion: { include: { workflowDefinition: true } },
        },
      }),
    ]);

    if (!existingLoan) {
      return createErrorResult("Loan request not found.", "moveLoanToStage");
    }
    if (!nextStage) {
      return createErrorResult("Next stage not found.", "moveLoanToStage");
    }

    const availableStatusesObj = safeJsonParse<Record<string, string[]>>(nextStage.availableStatuses, {});
    const availableStatusesForDept = availableStatusesObj[nextStage.responsibleDepartment.name] || [];
    const initialStageStatus = availableStatusesForDept.length > 0 ? availableStatusesForDept[0] : 'Initiated';
    const now = new Date();
    const isDepartmentHandover = existingLoan.assignedDepartmentId !== nextStage.responsibleDepartmentId;

    const updateData: any = {
      currentWorkflowStage: { connect: { id: nextStage.id } },
      assignedDepartment: { connect: { id: nextStage.responsibleDepartmentId } },
      stageEntryDate: now,
      stageDeadline: addDays(now, nextStage.defaultTimelineDays),
      currentStageStatus: initialStageStatus,
      isReadyForManagerReview: false,
      stageCompletedBy: { set: [] },
      lastUpdatedDate: now,
      history: {
        create: {
          user: { connect: { id: user.id } },
          stageName: nextStage.name,
          timestamp: now,
          notes: `Moved to ${nextStage.name}`,
        },
      },
    };

    if (isDepartmentHandover) {
      const autoAssignee = await findWorkflowAssignee(prisma, {
        departmentId: nextStage.responsibleDepartmentId,
        departmentName: nextStage.responsibleDepartment.name,
        stageName: nextStage.name,
        workflowName: nextStage.workflowVersion.workflowDefinition.name,
        allowedRoles: nextStage.allowedRoles,
        preferredUserIds: existingLoan.createdById ? [existingLoan.createdById] : [],
      });

      if (autoAssignee) {
        updateData.assignedToUsers = { set: [{ id: autoAssignee.id }] };
        updateData.assignedBy = { connect: { id: user.id } };
      } else {
        updateData.assignedToUsers = { set: [] };
        updateData.assignedBy = { disconnect: true };
      }
    }

    const workflowCode = getWorkflowCodeFromName(nextStage.workflowVersion.workflowDefinition.name);
    const isValuationWorkflow = workflowCode === 2 || workflowCode === 4 || normalizeRoutingName(nextStage.responsibleDepartment.name).includes('valuation');
    if (isValuationWorkflow) {
      // Enter the unified valuation flow at the Director's incoming queue (PENDING).
      // Not auto-assigned to an officer — the Director routes it via the /valuation workspace.
      updateData.assignedToUsers = { set: [] };
      updateData.isReadyForValuation = true;
      updateData.isValuationCompleted = false;
      updateData.valuationQueue = {
        upsert: {
          update: {
            status: 'PENDING',
            assignedToId: null,
            routingOption: null,
            makerId: null,
            isCheckedByChecker: false,
          },
          create: {
            status: 'PENDING',
          },
        },
      };
      // Record the sender so the case returns to them when valuation completes
      // (the completion logic looks up the latest "Forward to Valuation" event).
      updateData.history = {
        create: [
          { user: { connect: { id: user.id } }, stageName: nextStage.name, timestamp: now, notes: `Moved to ${nextStage.name}` },
          { user: { connect: { id: user.id } }, stageName: "Forward to Valuation", timestamp: now, notes: `Case forwarded to the Valuation Department by ${user.fullName}.` },
        ],
      };
    }

    const updatedLoan = await prisma.loanRequest.update({
      where: { id: loanRequestId },
      data: updateData,
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
        assignedDepartment: true,
        assignedBy: true,
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    return { success: true, updatedLoan: mapPrismaLoanToAppLoan(updatedLoan as any) };
  } catch (e: any) {
    return createErrorResult(`Failed to move loan to next stage: ${e.message}`, "moveLoanToStage", e);
  }
}

export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    const prismaWorkflowDefs = await prisma.workflowDefinition.findMany({
      orderBy: { order: 'asc' },
      include: {
        sector: { include: { parent: true } },
        department: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            stages: {
              orderBy: { order: 'asc' },
              include: { responsibleDepartment: true, documentRequirements: true }
            },
          },
        },
      },
    });

    const appWorkflowDefs: WorkflowDefinition[] = prismaWorkflowDefs.map(def => ({
      id: def.id,
      name: def.name,
      sectorId: def.sectorId,
      sectorName: def.sector.name,
      parentSectorId: def.sector.parentId ?? undefined,
      parentSectorName: def.sector.parent?.name,
      departmentId: def.departmentId,
      departmentName: def.department.name,
      description: def.description || undefined,
      order: def.order,
      createdAt: formatISO(new Date(def.createdAt)),
      updatedAt: formatISO(new Date(def.updatedAt)),
      versions: def.versions.map(v => ({
        id: v.id,
        workflowDefinitionId: v.workflowDefinitionId,
        versionNumber: v.versionNumber,
        isActive: v.isActive,
        createdAt: formatISO(new Date(v.createdAt)),
        updatedAt: v.updatedAt ? formatISO(new Date(v.updatedAt)) : undefined,
        stages: v.stages.map(s => ({
          id: s.id,
          name: s.name,
          responsibleDepartment: s.responsibleDepartment.name as Department,
          defaultTimelineDays: s.defaultTimelineDays,
          documentRequirements: s.documentRequirements.map(dr => ({
            id: dr.id,
            name: dr.name,
            isMandatory: dr.isMandatory,
            type: dr.type as AppDocumentRequirementType,
          })),
          percentageWeight: s.percentageWeight,
          order: s.order,
          availableStatuses: safeJsonParse(s.availableStatuses, {}),
          allowedRoles: safeJsonParse(s.allowedRoles, []),
          requiresApproval: s.requiresApproval,
          createdAt: s.createdAt ? formatISO(new Date(s.createdAt)) : undefined,
          updatedAt: s.updatedAt ? formatISO(new Date(s.updatedAt)) : undefined,
        })),
      })),
    }));

    return { workflows: appWorkflowDefs };
  } catch (e: any) {
    return createErrorResult("Failed to fetch workflow definitions.", "getWorkflowDefinitions", e);
  }
}

export async function saveWorkflowDefinitions(definitions: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_WORKFLOWS)) {
      return createErrorResult("Unauthorized", "saveWorkflowDefinitions");
    }
    await prisma.$transaction(async (tx) => {
      for (const definition of definitions) {
        const { versions, ...defData } = definition;
        const upsertedDef = await tx.workflowDefinition.upsert({
          where: { id: definition.id || `_non_existent_def_id_${Date.now()}` },
          create: {
            id: definition.id || undefined,
            name: defData.name,
            description: defData.description,
            order: defData.order,
            department: { connect: { id: defData.departmentId } },
            sector: { connect: { id: defData.sectorId } },
          },
          update: {
            name: defData.name,
            description: defData.description,
            order: defData.order,
            department: { connect: { id: defData.departmentId } },
            sector: { connect: { id: defData.sectorId } },
            updatedAt: new Date(),
          },
        });
        const definitionId = upsertedDef.id;

        for (const version of versions) {
          const { stages, workflowDefinitionId, ...versionData } = version;
          const upsertedVersion = await tx.workflowVersion.upsert({
            where: { id: version.id || `_non_existent_ver_id_${Date.now()}` },
            create: { ...versionData, id: version.id || undefined, workflowDefinition: { connect: { id: definitionId } } },
            update: { ...versionData, id: undefined, updatedAt: new Date() },
          });
          const versionId = upsertedVersion.id;

          for (const stage of stages) {
            const department = await tx.department.findUnique({ where: { nameLowercase: stage.responsibleDepartment.toLowerCase() } });
            if (!department) throw new Error(`Department "${stage.responsibleDepartment}" not found.`);
            const { documentRequirements, responsibleDepartment: _rd, workflowVersionId: _wvid, ...stageData } = stage as any;
            const upsertedStage = await tx.workflowStageDefinition.upsert({
              where: { id: stage.id || `_non_existent_stage_id_${Date.now()}` },
              create: { ...stageData, id: stage.id || undefined, availableStatuses: JSON.stringify(stage.availableStatuses || {}), allowedRoles: JSON.stringify(stage.allowedRoles || []), requiresApproval: stage.requiresApproval, workflowVersion: { connect: { id: versionId } }, responsibleDepartment: { connect: { id: department.id } } },
              update: { ...stageData, id: undefined, availableStatuses: JSON.stringify(stage.availableStatuses || {}), allowedRoles: JSON.stringify(stage.allowedRoles || []), requiresApproval: stage.requiresApproval, updatedAt: new Date(), responsibleDepartment: { connect: { id: department.id } } },
            });

            for (const req of documentRequirements) {
              await tx.documentRequirement.upsert({
                where: { id: req.id || `_non_existent_req_id_${Date.now()}` },
                create: { id: req.id || undefined, name: req.name, isMandatory: req.isMandatory, type: req.type, workflowStage: { connect: { id: upsertedStage.id } } },
                update: { name: req.name, isMandatory: req.isMandatory, type: req.type },
              });
            }
          }
        }
      }
    });
    return { success: true };
  } catch (e: any) {
    return createErrorResult("Failed to save workflow definitions.", "saveWorkflowDefinitions", e);
  }
}

export async function getDepartments(): Promise<{ departments?: { id: string, name: Department }[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };
    const prismaDepartments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    return { departments: prismaDepartments.map(d => ({ id: d.id, name: d.name as Department })) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch departments.", "getDepartments", e);
  }
}

export async function getDepartmentUsers(departmentName?: string): Promise<{ users?: User[]; error?: string }> {
  try {
    const { user: currentUser } = await getCurrentUser();
    if (!currentUser) return { error: "Unauthorized" };

    const whereClause: any = { isActive: true };
    if (departmentName) {
      whereClause.department = { name: departmentName };
    } else if (!currentUser.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
      // If no department specified and not an admin, default to user's own department
      whereClause.departmentId = currentUser.departmentId;
    }

    // Geographic Hardening: If current user is tied to a district, only show users in the same district.
    // Include users who either have `districtId` set OR have CRM mappings pointing to a branch in the district.
    let finalWhere: any = whereClause;
    if (currentUser.districtId) {
      const geoFilter = {
        OR: [
          { districtId: currentUser.districtId },
          { crmMappings: { some: { branch: { districtId: currentUser.districtId } } } }
        ]
      };
      finalWhere = { AND: [whereClause, geoFilter] };
    }

    const prismaUsers = await prisma.user.findMany({
      where: finalWhere,
      include: {
        department: true,
        district: true,
        customRole: true,
        crmMappings: { include: { branch: true } }
      },
      orderBy: { name: 'asc' }
    });

    return { users: prismaUsers.map(u => mapPrismaUserToAppUser(u as any)) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch users.", "getDepartmentUsers", e);
  }
}

export async function addDepartment(departmentName: string): Promise<{ id?: string; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS)) return createErrorResult("Unauthorized", "addDepartment");
    const nameLower = departmentName.trim().toLowerCase();
    const existing = await prisma.department.findUnique({ where: { nameLowercase: nameLower } });
    if (existing) return createErrorResult(`Department already exists.`, "addDepartment");
    const newDepartment = await prisma.department.create({ data: { name: departmentName.trim(), nameLowercase: nameLower } });
    return { id: newDepartment.id };
  } catch (e: any) {
    return createErrorResult("Failed to add department.", "addDepartment", e);
  }
}

export async function deleteDepartment(departmentId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.MANAGE_SETTINGS_DEPARTMENTS)) return createErrorResult("Unauthorized", "deleteDepartment");
    await prisma.department.delete({ where: { id: departmentId } });
    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to delete department.`, "deleteDepartment", e);
  }
}

export async function getCustomers(): Promise<{ customers?: CustomerWithDepartment[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_CUSTOMERS)) return { error: "Unauthorized" };
    const prismaCustomers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: { loanRequests: { include: { currentWorkflowStage: true, assignedDepartment: true }, orderBy: { submittedDate: 'desc' } } }
    });
    const appCustomers: CustomerWithDepartment[] = prismaCustomers.map(pc => {
      const uniqueLoans = dedupeOrderedLoanRows(pc.id, pc.loanRequests);
      const mostRecentLoan = uniqueLoans[0];
      return {
        id: pc.id, name: pc.name, email: pc.email, phone: pc.phone || undefined, branch: pc.branch || undefined,
        mostRecentDepartment: mostRecentLoan?.assignedDepartment?.name as Department | undefined,
        mostRecentStageName: mostRecentLoan?.currentWorkflowStage?.name,
        loanRequests: uniqueLoans.map(lr => ({ id: lr.id, loanNumber: lr.loanNumber, loanAmount: Number(lr.loanAmount), submittedDate: formatISO(lr.submittedDate), currentStageName: lr.currentWorkflowStage?.name || 'Unknown' })),
      };
    });
    return { customers: appCustomers };
  } catch (e: any) {
    return createErrorResult("Failed to fetch customers.", "getCustomers", e);
  }
}

export async function getCustomerById(id: string): Promise<{ customer?: Customer | null; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_CUSTOMERS)) return { error: "Unauthorized" };
    const prismaCustomer = await prisma.customer.findUnique({
      where: { id },
      include: { loanRequests: { include: { currentWorkflowStage: true }, orderBy: { submittedDate: 'desc' } } },
    });
    if (!prismaCustomer) return { error: 'Customer not found.' };
    const uniqueLoans = dedupeOrderedLoanRows(prismaCustomer.id, prismaCustomer.loanRequests);
    const appCustomer: Customer = {
      id: prismaCustomer.id, name: prismaCustomer.name, email: prismaCustomer.email, phone: prismaCustomer.phone || undefined, branch: prismaCustomer.branch || undefined,
      loanRequests: uniqueLoans.map(lr => ({ id: lr.id, loanNumber: lr.loanNumber, loanAmount: Number(lr.loanAmount), submittedDate: formatISO(lr.submittedDate), currentStageName: lr.currentWorkflowStage?.name || 'Unknown' })),
    };
    return { customer: appCustomer };
  } catch (e: any) {
    return createErrorResult(`Failed to fetch customer.`, 'getCustomerById', e);
  }
}

export async function searchLoanRequests(searchTerm: string, searchType: string): Promise<{ loans?: { id: string, loanNumber: string, customerName: string, submittedDate: string, currentStageId: string | null, currentStageStatus: string | null, isTerminalStage: boolean }[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_LOAN_STATUS_LOOKUP)) return { error: "Unauthorized" };
    let whereClause: any = {};
    if (searchType === 'loanNumber') whereClause = { loanNumber: { contains: searchTerm } };
    else if (searchType === 'customerName') whereClause = { customer: { name: { contains: searchTerm } } };
    else whereClause = { customer: { id: { contains: searchTerm } } };

    const prismaLoans = await prisma.loanRequest.findMany({
      where: whereClause,
      select: {
        id: true,
        loanNumber: true,
        customerId: true,
        loanAmount: true,
        sectorId: true,
        requestTypeId: true,
        loanPurpose: true,
        submissionType: true,
        lastUpdatedDate: true,
        submittedDate: true,
        currentStageId: true,
        currentStageStatus: true,
        isTerminalStage: true,
        customer: { select: { name: true } },
      },
      orderBy: { lastUpdatedDate: 'desc' },
      take: 50,
    });
    const uniqueLoans = dedupeLoanRowsBySubmission(prismaLoans);
    return {
      loans: uniqueLoans.map((loan) => ({
        id: loan.id,
        loanNumber: loan.loanNumber,
        customerName: loan.customer.name,
        submittedDate: formatISO(loan.submittedDate),
        currentStageId: loan.currentStageId,
        currentStageStatus: loan.currentStageStatus,
        isTerminalStage: loan.isTerminalStage,
      })),
    };
  } catch (e: any) {
    return createErrorResult(`Search failed.`, "searchLoanRequests", e);
  }
}

export async function getSubmittedLoanRequests(): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_OWN_SUBMITTED_CASES)) return { error: "Unauthorized" };
    const prismaLoans = await prisma.loanRequest.findMany({
      where: { 
        createdBy: { id: user.id },
        submissionType: 'TYPE1' // Only Head Office submissions
      },
      orderBy: { submittedDate: 'desc' },
      include: { customer: true, sector: { include: { parent: true } }, requestType: true, assignedToUsers: { include: { department: true, customRole: true } }, stageCompletedBy: { include: { department: true, customRole: true } }, currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } }, workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } }, assignedDepartment: true, assignedBy: true, history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } }, documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } } },
    });
    return { loans: mapAndDedupePrismaLoans(prismaLoans) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch submitted loans.", "getSubmittedLoanRequests", e);
  }
}

export async function getDistrictDashboardAnalytics(): Promise<{ loans?: LoanRequest[], branches?: string[], crms?: User[], error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    const districtBranchNames = await getDistrictBranchNames(user.districtId);
    if (!user.districtId || (districtBranchNames && districtBranchNames.length === 0)) {
      return { error: "No district assigned to your profile." };
    }

    const districtFilter = { customer: { branch: { in: districtBranchNames } } };

    const prismaLoans = await prisma.loanRequest.findMany({
      where: districtFilter,
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
        assignedDepartment: true,
        assignedBy: true,
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } }
      }
    });

    const districtSettings = await getDistrictSettings();

    const crms = await prisma.user.findMany({
      where: {
        isActive: true,
        crmMappings: { some: { branch: { districtId: user.districtId } } }
      },
      include: { department: true, customRole: true }
    });

    return { 
      loans: mapAndDedupePrismaLoans(prismaLoans, { districtOverdueHours: districtSettings.overdueHours }),
      branches: districtBranchNames || [], 
      crms: crms.map(mapPrismaUserToAppUser) 
    };
  } catch (e: any) {
    return createErrorResult(e.message, "getDistrictDashboardAnalytics");
  }
}

export async function getDistrictSubmittedLoanRequests(): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_OWN_SUBMITTED_CASES)) return { error: "Unauthorized" };
    
    const districtBranchNames = await getDistrictBranchNames(user.districtId);
    
    // We want to show cases in the user's district OR cases created by the user themselves.
    // MUST be TYPE2 (District Specialized) only.
    const whereClause: any = {
      submissionType: 'TYPE2',
      OR: [{ createdBy: { id: user.id } }],
    };

    if (districtBranchNames && districtBranchNames.length > 0) {
      whereClause.OR.push({
        customer: { branch: { in: districtBranchNames } },
      });
    }

    const prismaLoans = await prisma.loanRequest.findMany({
      where: whereClause,
      orderBy: { submittedDate: 'desc' },
      include: { customer: true, sector: { include: { parent: true } }, requestType: true, assignedToUsers: { include: { department: true, customRole: true } }, stageCompletedBy: { include: { department: true, customRole: true } }, currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } }, workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } }, assignedDepartment: true, assignedBy: true, history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } }, documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } } },
    });
    return { loans: mapAndDedupePrismaLoans(prismaLoans) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch district submitted loans.", "getDistrictSubmittedLoanRequests", e);
  }
}

export async function getPublicLoanStatusByLoanNumber(loanNumber: string) {
  try {
    const prismaLoan = await prisma.loanRequest.findUnique({
      where: { loanNumber },
      include: {
        customer: { select: { name: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { select: { parentId: true } } } } } },
        history: { select: { stageName: true, timestamp: true }, orderBy: { timestamp: 'asc' } }
      }
    });
    if (!prismaLoan) return { error: 'Loan not found or path invalid.' };
    const allDefs = await prisma.workflowDefinition.findMany({ where: { sectorId: prismaLoan.sectorId }, orderBy: { order: 'asc' }, include: { versions: { where: { isActive: true }, include: { stages: { orderBy: { order: 'asc' }, include: { responsibleDepartment: true } } } } } });
    const stageEntryDates = new Map<string, string>();
    for (const entry of prismaLoan.history) if (!stageEntryDates.has(entry.stageName)) stageEntryDates.set(entry.stageName, formatISO(entry.timestamp));
    const workflowSequence = allDefs.flatMap(def => def.versions.flatMap(v => v.stages.map(s => ({ stageId: s.id, stageName: s.name, stageOrder: s.order, stageTimelineDays: s.defaultTimelineDays, departmentName: s.responsibleDepartment.name, workflowDefinitionName: def.name, workflowOrder: def.order, entryDate: stageEntryDates.get(s.name) })))).sort((a, b) => a.workflowOrder !== b.workflowOrder ? a.workflowOrder - b.workflowOrder : a.stageOrder - b.stageOrder);
    return { data: { id: prismaLoan.id, loanNumber: prismaLoan.loanNumber, customerName: prismaLoan.customer.name, submittedDate: formatISO(prismaLoan.submittedDate), currentStageId: prismaLoan.currentStageId, currentStageStatus: prismaLoan.currentStageStatus, isTerminalStage: prismaLoan.isTerminalStage, workflowSequence } };
  } catch (e: any) {
    return createErrorResult("Failed to fetch public loan status.", 'getPublicLoanStatusByLoanNumber', e);
  }
}

// ==================== ASSIGNED CASES (FIXED QUERY) ====================

export async function getAssignedLoanRequests(): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_OWN_ASSIGNED_CASES)) {
      return createErrorResult("Unauthorized", "getAssignedLoanRequests");
    }

    console.log("Current User:", user.id);

    const districtBranchNames = await getDistrictBranchNames(user.districtId);
    if (user.districtId && districtBranchNames && districtBranchNames.length === 0) {
      return { loans: [] };
    }
    const districtFilter = districtBranchNames
      ? { customer: { branch: { in: districtBranchNames } } }
      : null;

    const baseWhere: any = {
      assignedToUsers: { some: { id: user.id } },
    };

    // Requirement Fix: For District submissions (TYPE2), when moved to Valuation, 
    // it should be visible ONLY to users with District Valuation access or permissions.
    // Head Office cases (TYPE1) remain visible in My Assignments as normal.
    const hasDistrictValuationAccess = user.permissions.includes(PERMISSIONS.VIEW_DISTRICT_VALUATION);
    if (!hasDistrictValuationAccess) {
      baseWhere.NOT = {
        AND: [
          { submissionType: 'TYPE2' },
          { assignedDepartment: { name: 'Property Valuation Department' } }
        ]
      };
    }

    const prismaLoans = await prisma.loanRequest.findMany({
      where: districtFilter ? { AND: [baseWhere, districtFilter] } : baseWhere,
      orderBy: [{ isUrgent: 'desc' }, { lastUpdatedDate: 'desc' }],
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
        assignedDepartment: true,
        assignedBy: true,
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const loans = mapAndDedupePrismaLoans(prismaLoans);
    console.log("Assigned Cases:", loans.length);
    return { loans };
  } catch (e: any) {
    return createErrorResult("Failed to fetch assigned loan requests.", "getAssignedLoanRequests", e);
  }
}

export async function getIncomingLoanRequests(): Promise<{ loans?: LoanRequest[], error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_INCOMING_CASES)) {
      return createErrorResult("Unauthorized", "getIncomingLoanRequests");
    }
    if (!user.departmentId) {
      return { loans: [] };
    }

    // DEPARTMENT ROUTING RULE:
    // If a Chief/Deputy Chief exists, they see incoming cases.
    // If no Chief exists, the Director sees them.
    // Managers/Staff only see them if no Chief or Director exists in the department.
    const deptUsers = await prisma.user.findMany({
      where: { departmentId: user.departmentId, isActive: true },
      select: { customRole: { select: { name: true } } }
    });

    const hasChief = deptUsers.some(u => roleMatches(u.customRole?.name, ['Chief', 'Deputy Chief']));
    const hasDirector = deptUsers.some(u => roleMatches(u.customRole?.name, ['Director']));

    const isChief = roleMatches(user.customRoleName, ['Chief', 'Deputy Chief']);
    const isDirector = roleMatches(user.customRoleName, ['Director']);
    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);

    if (!isAdmin) {
      if (hasChief && !isChief) {
        return { loans: [] };
      }
      if (!hasChief && hasDirector && !isDirector) {
        return { loans: [] };
      }
    }

    const districtBranchNames = await getDistrictBranchNames(user.districtId);
    if (user.districtId && districtBranchNames && districtBranchNames.length === 0) {
      return { loans: [] };
    }
    const districtFilter = districtBranchNames
      ? { customer: { branch: { in: districtBranchNames } } }
      : null;

    const baseWhere: any = {
      assignedDepartmentId: user.departmentId,
      isReadyForManagerReview: false,
      isTerminalStage: false,
      // Valuation cases are managed exclusively through the /valuation workspace.
      // Exclude them here so they don't appear in the general incoming queue.
      isReadyForValuation: { not: true },
    };

    // Logic Fix: If the current user has assignment permissions (Director/Chief/Manager),
    // they should see both unassigned cases AND cases assigned specifically to them
    // that still need delegation. This handles cases that were auto-assigned to them
    // by the system hierarchy logic.
    if (user.permissions.includes(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)) {
      baseWhere.OR = [
        { assignedToUsers: { none: {} } },
        { assignedToUsers: { some: { id: user.id } } }
      ];
    } else {
      baseWhere.assignedToUsers = { none: {} };
    }

    // Logic Fix: Scope incoming cases by submission type to avoid Head Office users
    // seeing District (Type 2) unassigned cases that might be incorrectly routed
    // or awaiting district-level assignment.
    if (user.districtId) {
      baseWhere.submissionType = 'TYPE2';
    } else {
      baseWhere.submissionType = 'TYPE1';
    }

    const prismaLoans = await prisma.loanRequest.findMany({
      where: districtFilter ? { AND: [baseWhere, districtFilter] } : baseWhere,
      orderBy: [{ isUrgent: 'desc' }, { lastUpdatedDate: 'desc' }],
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
        assignedDepartment: true,
        assignedBy: true,
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    return { loans: mapAndDedupePrismaLoans(prismaLoans) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch incoming loan requests.", "getIncomingLoanRequests", e);
  }
}

export async function getIncomingCasesCount(): Promise<{ count?: number, error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_INCOMING_CASES)) {
      return createErrorResult("Unauthorized", "getIncomingCasesCount");
    }
    if (!user.departmentId) {
      return { count: 0 };
    }

    const deptUsers = await prisma.user.findMany({
      where: { departmentId: user.departmentId, isActive: true },
      select: { customRole: { select: { name: true } } }
    });

    const hasChief = deptUsers.some(u => roleMatches(u.customRole?.name, ['Chief', 'Deputy Chief']));
    const hasDirector = deptUsers.some(u => roleMatches(u.customRole?.name, ['Director']));

    const isChief = roleMatches(user.customRoleName, ['Chief', 'Deputy Chief']);
    const isDirector = roleMatches(user.customRoleName, ['Director']);
    const isAdmin = user.permissions.includes(PERMISSIONS.MANAGE_USERS);

    if (!isAdmin) {
      if (hasChief && !isChief) return { count: 0 };
      if (!hasChief && hasDirector && !isDirector) return { count: 0 };
    }

    const districtBranchNames = await getDistrictBranchNames(user.districtId);
    if (user.districtId && districtBranchNames && districtBranchNames.length === 0) {
      return { count: 0 };
    }
    const districtFilter = districtBranchNames
      ? { customer: { branch: { in: districtBranchNames } } }
      : null;

    const baseWhere: any = {
      assignedDepartmentId: user.departmentId,
      isReadyForManagerReview: false,
      isTerminalStage: false,
      isReadyForValuation: { not: true },
    };

    if (user.permissions.includes(PERMISSIONS.ASSIGN_LOAN_TO_STAFF)) {
      baseWhere.OR = [
        { assignedToUsers: { none: {} } },
        { assignedToUsers: { some: { id: user.id } } }
      ];
    } else {
      baseWhere.assignedToUsers = { none: {} };
    }

    if (user.districtId) {
      baseWhere.submissionType = 'TYPE2';
    } else {
      baseWhere.submissionType = 'TYPE1';
    }

    const prismaLoans = await prisma.loanRequest.findMany({
      where: districtFilter ? { AND: [baseWhere, districtFilter] } : baseWhere,
      select: { id: true },
    });

    return { count: prismaLoans.length };
  } catch (e: any) {
    return createErrorResult("Failed to fetch incoming cases count.", "getIncomingCasesCount", e);
  }
}

export async function getAssignedByMePortfolio(): Promise<{ loans?: LoanRequest[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_INCOMING_CASES)) {
      return createErrorResult("Unauthorized", "getAssignedByMePortfolio");
    }

    const prismaLoans = await prisma.loanRequest.findMany({
      where: {
        OR: [
          { assignedById: user.id },
          {
            history: {
              some: {
                userId: user.id,
                OR: [
                  { notes: { contains: 'assigned', mode: 'insensitive' } },
                  { notes: { contains: 'reassign', mode: 'insensitive' } },
                  { notes: { contains: 'approved', mode: 'insensitive' } },
                  { notes: { contains: 'review', mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
      orderBy: [{ isUrgent: 'desc' }, { lastUpdatedDate: 'desc' }],
      include: {
        customer: true,
        sector: { include: { parent: true } },
        requestType: true,
        assignedToUsers: { include: { department: true, customRole: true } },
        stageCompletedBy: { include: { department: true, customRole: true } },
        currentWorkflowStage: { include: { responsibleDepartment: true, documentRequirements: true } },
        workflowVersion: { include: { workflowDefinition: { include: { sector: { include: { parent: true } }, department: true } } } },
        assignedDepartment: true,
        assignedBy: true,
        history: { include: { user: { include: { department: true, customRole: true } } }, orderBy: { timestamp: 'desc' } },
        documents: { include: { requirement: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    return { loans: mapAndDedupePrismaLoans(prismaLoans) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch assigned-by-me portfolio.", "getAssignedByMePortfolio", e);
  }
}

// ==================== CASE REVIEW HISTORY ====================

export async function recordCaseReview(data: {
  loanRequestId: string;
  action: 'APPROVED' | 'REWORKED';
  comment?: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.PROMOTE_LOAN_STAGE)) {
      return createErrorResult("Unauthorized", "recordCaseReview");
    }

    await prisma.$transaction(async (tx) => {
      const loan = await tx.loanRequest.findUnique({
        where: { id: data.loanRequestId },
        include: { currentWorkflowStage: true },
      });
      if (!loan) {
        throw new Error("Loan request not found for review logging.");
      }

      await tx.caseReviewHistory.create({
        data: {
          loanRequest: { connect: { id: data.loanRequestId } },
          performedBy: { connect: { id: user.id } },
          action: data.action,
          comment: data.comment || null,
        },
      });

      const reviewNotes = data.action === 'APPROVED'
        ? `Approved by ${user.fullName}.${data.comment ? ` ${data.comment}` : ''}`
        : `Returned for rework by ${user.fullName}.${data.comment ? ` ${data.comment}` : ''}`;

      await tx.loanHistoryEntry.create({
        data: {
          loanRequest: { connect: { id: data.loanRequestId } },
          user: { connect: { id: user.id } },
          stageName: loan.currentWorkflowStage?.name || 'Manager Review',
          timestamp: new Date(),
          notes: reviewNotes,
        },
      });
    });

    return { success: true };
  } catch (e: any) {
    return createErrorResult("Failed to record case review.", "recordCaseReview", e);
  }
}

export interface CaseReviewRecord {
  id: string;
  loanRequestId: string;
  loanNumber: string;
  customerName: string;
  action: string;
  performedByName: string;
  performedByDepartment?: string;
  caseDepartment?: string;
  submissionType?: string;
  comment?: string;
  createdAt: string;
  finalStatus?: string;
}

export type CaseReviewHistoryFilter =
  | string
  | {
      departmentFilter?: string;
      performedByUserId?: string;
      /** When set, limits history to district (TYPE2) or head office (non-TYPE2) workflow cases. */
      workflowPath?: 'headoffice' | 'district';
    };

export async function getCaseReviewHistory(
  filter?: CaseReviewHistoryFilter
): Promise<{ reviews?: CaseReviewRecord[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user || !user.permissions.includes(PERMISSIONS.VIEW_MANAGER_REVIEW_HISTORY)) {
      return createErrorResult("Unauthorized", "getCaseReviewHistory");
    }

    let departmentFilter: string | undefined;
    let performedByUserId: string | undefined;
    let workflowPath: 'headoffice' | 'district' | undefined;
    if (typeof filter === 'string') {
      departmentFilter = filter;
    } else if (filter) {
      departmentFilter = filter.departmentFilter;
      performedByUserId = filter.performedByUserId;
      workflowPath = filter.workflowPath;
    }

    const records = await prisma.caseReviewHistory.findMany({
      where: {
        ...(performedByUserId ? { performedById: performedByUserId } : {}),
        ...(workflowPath === 'district'
          ? { loanRequest: { submissionType: 'TYPE2' } }
          : workflowPath === 'headoffice'
            ? { loanRequest: { submissionType: { not: 'TYPE2' } } }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        loanRequest: {
          include: {
            customer: true,
            assignedDepartment: true,
          },
        },
        performedBy: {
          include: {
            department: true,
          },
        },
      },
    });

    let reviews: CaseReviewRecord[] = records.map(r => ({
      id: r.id,
      loanRequestId: r.loanRequestId,
      loanNumber: r.loanRequest.loanNumber,
      customerName: r.loanRequest.customer.name,
      action: r.action,
      performedByName: r.performedBy.name,
      performedByDepartment: r.performedBy.department?.name,
      caseDepartment: r.loanRequest.assignedDepartment?.name,
      submissionType: r.loanRequest.submissionType,
      comment: r.comment || undefined,
      createdAt: formatISO(new Date(r.createdAt)),
      finalStatus: r.loanRequest.currentStageStatus || undefined,
    }));

    if (departmentFilter) {
      reviews = reviews.filter(r => r.caseDepartment === departmentFilter);
    }

    return { reviews };
  } catch (e: any) {
    return createErrorResult("Failed to fetch case review history.", "getCaseReviewHistory", e);
  }
}

// ==================== COMPLETED CASE HISTORY (Personal) ====================

export interface CompletedCaseRecord {
  id: string;
  loanRequestId: string;
  loanNumber: string;
  customerName: string;
  completedByName: string;
  completionDate: string;
  actionType: string;
  nextDestination: string;
  comment: string;
  currentDepartment: string;
  currentStage: string;
  currentStatus: string;
  latestEvent: string;
  latestEventAt: string;
}

export async function getCompletedCaseHistory(): Promise<{ cases?: CompletedCaseRecord[]; error?: string }> {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
      return createErrorResult("Unauthorized", "getCompletedCaseHistory");
    }

    const myReviewEvents = await prisma.caseReviewHistory.findMany({
      where: { performedById: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        loanRequestId: true,
        action: true,
        comment: true,
        createdAt: true,
      },
    });

    const reviewedLoanIds = Array.from(new Set(myReviewEvents.map(r => r.loanRequestId)));

    // Build personal history from interaction relationships and review actions
    // so approved/reviewed cases are captured even if they don't have a direct
    // loan-history entry for this user.
    const interactionLoans = await prisma.loanRequest.findMany({
      where: {
        OR: [
          { assignedToUsers: { some: { id: user.id } } },
          { stageCompletedBy: { some: { id: user.id } } },
          { assignedById: user.id },
          { history: { some: { userId: user.id } } },
          { id: { in: reviewedLoanIds } },
        ],
      },
      orderBy: [{ lastUpdatedDate: 'desc' }],
      include: {
        customer: true,
        assignedDepartment: true,
        currentWorkflowStage: true,
        assignedToUsers: { select: { id: true } },
        history: {
          orderBy: { timestamp: 'desc' },
          include: { user: { include: { department: true, customRole: true } } },
        },
      },
    });

    const reviewByLoan = new Map<string, { action: string; comment: string | null; createdAt: Date }>();
    for (const review of myReviewEvents) {
      if (!reviewByLoan.has(review.loanRequestId)) {
        reviewByLoan.set(review.loanRequestId, {
          action: review.action,
          comment: review.comment,
          createdAt: review.createdAt,
        });
      }
    }

    const cases: CompletedCaseRecord[] = interactionLoans.map((loan) => {
      const allHistory = loan.history || [];
      const myHistoryEvents = allHistory.filter((h) => h.userId === user.id);
      const latestMyEvent = myHistoryEvents[0];
      const latestReview = reviewByLoan.get(loan.id);

      const latestEvent = allHistory[0];
      const latestEventText = latestEvent?.notes || (latestEvent?.stageName ? `Moved to ${latestEvent.stageName}` : 'No recent update');
      const latestEventAt = latestEvent
        ? formatISO(new Date(latestEvent.timestamp))
        : formatISO(new Date(loan.lastUpdatedDate));

      const eventNotes = (latestMyEvent?.notes || '').toLowerCase();
      let actionType = 'Activity';
      if (latestReview?.action === 'APPROVED' || eventNotes.includes('approved') || eventNotes.includes('promoted')) {
        actionType = 'Approved';
      } else if (eventNotes.includes('assigned') || eventNotes.includes('reassign') || loan.assignedById === user.id) {
        actionType = 'Assigned';
      } else if (eventNotes.includes('completed') || eventNotes.includes('marked complete')) {
        actionType = 'Marked Complete';
      } else if (eventNotes.includes('manager review')) {
        actionType = 'Sent to Review';
      } else if (loan.assignedToUsers.some((u) => u.id === user.id)) {
        actionType = 'Assigned To Me';
      }

      const activityTimestamp = latestReview?.createdAt
        ? formatISO(new Date(latestReview.createdAt))
        : latestMyEvent
          ? formatISO(new Date(latestMyEvent.timestamp))
          : formatISO(new Date(loan.lastUpdatedDate));

      const nextDestination = `${loan.assignedDepartment?.name || 'N/A'} - ${loan.currentWorkflowStage?.name || 'Unknown Stage'}`;

      return {
        id: latestMyEvent?.id || `activity-${loan.id}`,
        loanRequestId: loan.id,
        loanNumber: loan.loanNumber,
        customerName: loan.customer.name,
        completedByName: user.fullName,
        completionDate: activityTimestamp,
        actionType,
        nextDestination,
        comment: latestMyEvent?.notes || latestReview?.comment || '',
        currentDepartment: loan.assignedDepartment?.name || 'N/A',
        currentStage: loan.currentWorkflowStage?.name || 'Unknown Stage',
        currentStatus: loan.currentStageStatus || 'Unknown',
        latestEvent: latestEventText,
        latestEventAt,
      };
    }).sort((a, b) => new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime());

    return { cases };
  } catch (e: any) {
    return createErrorResult("Failed to fetch completed case history.", "getCompletedCaseHistory", e);
  }
}
