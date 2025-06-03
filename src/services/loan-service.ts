
'use server';
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
// Department type still needed from types/loan
import type { Department as DepartmentType } from '@/types/loan';

import { UserRole } from '@/types/loan';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, addDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, runTransaction, limit, deleteDoc } from 'firebase/firestore';

import { formatISO, parseISO, addDays, isBefore, subDays } from 'date-fns';

// Mock data imports for users are still present as user management is not yet Firestore-backed
import { mockUsers } from '@/lib/mock-data';


const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    const errorDetails = (typeof originalError === 'object' && originalError !== null) ? JSON.stringify(originalError, Object.getOwnPropertyNames(originalError)) : String(originalError);
    detailedMessage += ` Raw: ${errorDetails}`;
  }
  console.error(`[Service:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

const convertTimestampsToISO = (data: any): any => {
  if (data instanceof Timestamp) {
    return formatISO(data.toDate());
  }
  if (Array.isArray(data)) {
    return data.map(convertTimestampsToISO);
  }
  if (typeof data === 'object' && data !== null) {
    const res: { [key: string]: any } = {};
    for (const key in data) {
      res[key] = convertTimestampsToISO(data[key]);
    }
    return res;
  }
  return data;
};

const getActiveWorkflowVersionForLoanType = async (loanType: string): Promise<{ workflowDef: WorkflowDefinition, activeVersion: WorkflowVersion, stages: WorkflowStageDefinition[] } | null> => {
  console.log(`[Service:getActiveWfVer] TOP LEVEL: Function called for loanType: "${loanType}"`);
  try {
    console.log(`[Service:getActiveWfVer] FIRESTORE DEBUG: Querying workflowDefinitions for loanType: ${loanType}`);
    const wfDefQuery = query(collection(db, "workflowDefinitions"), where("loanType", "==", loanType));
    const wfDefSnapshot = await getDocs(wfDefQuery);

    console.log(`[Service:getActiveWfVer] Workflow definition snapshot for "${loanType}" is empty: ${wfDefSnapshot.empty}`);
    if (wfDefSnapshot.empty) {
      console.warn(`[Service:getActiveWfVer] No workflow definition found for loan type: "${loanType}"`);
      return null;
    }
    const wfDefDoc = wfDefSnapshot.docs[0];
    const wfDefData = convertTimestampsToISO(wfDefDoc.data()) as Omit<WorkflowDefinition, 'id' | 'versions'>;
    console.log(`[Service:getActiveWfVer] Found Definition ID: ${wfDefDoc.id}, Name: "${wfDefData.name}"`);

    const workflowDefinition: WorkflowDefinition = { id: wfDefDoc.id, ...wfDefData, versions: [] };

    console.log(`[Service:getActiveWfVer] FIRESTORE DEBUG: Querying active versions for workflowDefinitions/${wfDefDoc.id}/versions`);
    const activeVersionsQuery = query(
      collection(db, `workflowDefinitions/${wfDefDoc.id}/versions`),
      where("isActive", "==", true),
      orderBy("versionNumber", "desc"),
      limit(1)
    );
    let versionsSnapshot = await getDocs(activeVersionsQuery);
    let activeVersionDoc;
    console.log(`[Service:getActiveWfVer] Active versions snapshot for ${wfDefDoc.id} is empty: ${versionsSnapshot.empty}`);

    if (!versionsSnapshot.empty) {
      activeVersionDoc = versionsSnapshot.docs[0];
      console.log(`[Service:getActiveWfVer] Found explicitly ACTIVE Version ID: ${activeVersionDoc.id}, Number: V${activeVersionDoc.data().versionNumber}`);
    } else {
      console.warn(`[Service:getActiveWfVer] No explicitly active version for "${loanType}" (Def ID: ${wfDefDoc.id}). Falling back to LATEST version.`);
      console.log(`[Service:getActiveWfVer] FIRESTORE DEBUG: Querying LATEST version for workflowDefinitions/${wfDefDoc.id}/versions`);
      const latestVersionQuery = query(
        collection(db, `workflowDefinitions/${wfDefDoc.id}/versions`),
        orderBy("versionNumber", "desc"),
        limit(1)
      );
      const latestVersionsSnapshot = await getDocs(latestVersionQuery);
      console.log(`[Service:getActiveWfVer] Latest versions snapshot for ${wfDefDoc.id} is empty: ${latestVersionsSnapshot.empty}`);
      if (latestVersionsSnapshot.empty) {
        console.warn(`[Service:getActiveWfVer] No versions AT ALL found for Definition ID: ${wfDefDoc.id}. Cannot proceed for loan type "${loanType}".`);
        return null;
      }
      activeVersionDoc = latestVersionsSnapshot.docs[0];
      console.log(`[Service:getActiveWfVer] Fallback to LATEST Version ID: ${activeVersionDoc.id}, Number: V${activeVersionDoc.data().versionNumber}. IMPORTANT: This version's isActive flag in Firestore is ${activeVersionDoc.data().isActive}`);
    }

    const activeVersionData = convertTimestampsToISO(activeVersionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages' | 'workflowDefinitionId'>;
    const activeVersion: WorkflowVersion = {
        id: activeVersionDoc.id,
        workflowDefinitionId: wfDefDoc.id,
        ...activeVersionData,
        stages: [],
        isActive: activeVersionData.isActive === true // Ensure boolean
    };
    console.log(`[Service:getActiveWfVer] Chosen Version for processing: ID ${activeVersion.id}, V${activeVersion.versionNumber}, IsActiveInDB: ${activeVersion.isActive}`);

    const stagesPath = `workflowDefinitions/${wfDefDoc.id}/versions/${activeVersion.id}/stages`;
    console.log(`[Service:getActiveWfVer] FIRESTORE DEBUG: Querying stages from path: "${stagesPath}"`);
    const stagesQuery = query(
        collection(db, stagesPath),
        orderBy("order", "asc")
    );
    const stagesSnapshot = await getDocs(stagesQuery);
    console.log(`[Service:getActiveWfVer] Stages snapshot for ${activeVersion.id} is empty: ${stagesSnapshot.empty}`);
    console.log(`[Service:getActiveWfVer] Found ${stagesSnapshot.docs.length} stage documents for Version ID: ${activeVersion.id}`);

    if (stagesSnapshot.empty) {
        console.warn(`[Service:getActiveWfVer] FIRESTORE WARNING: The stages query for path "${stagesPath}" returned an EMPTY snapshot.`);
    }

    activeVersion.stages = stagesSnapshot.docs.map(stageDoc => {
        const stageData = { id: stageDoc.id, ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>) };
        console.log(`[Service:getActiveWfVer]   Mapping stage: ID ${stageData.id}, Name: "${stageData.name}", Order: ${stageData.order}`);
        return stageData;
    });

    if (activeVersion.stages.length === 0) {
        console.warn(`[Service:getActiveWfVer] CRITICAL: Version ID ${activeVersion.id} (V${activeVersion.versionNumber}) for loan type "${loanType}" (Def: ${workflowDefinition.name}) resolved to 0 stages after query. This version will be considered unusable for new loans.`);
    }

    return { workflowDef: workflowDefinition, activeVersion, stages: activeVersion.stages };

  } catch (error: any) {
    // Log the specific error during Firestore operation
    console.error(`[Service:getActiveWfVer] FIRESTORE ERROR during operation for loan type "${loanType}":`, error.message, error.code, error.stack);
    // Check for common Firestore error codes indicating connectivity or permission issues
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      console.error(`[Service:getActiveWfVer] Firestore connection error: ${error.message}. The backend might be unreachable.`);
    } else if (error.code === 'permission-denied') {
      console.error(`[Service:getActiveWfVer] Firestore permission denied: ${error.message}. Check security rules.`);
    }
    return null; // Return null on any error to be handled by the caller
  }
};


const getStageDefinitionByRef = async (stageRefPath: string): Promise<WorkflowStageDefinition | null> => {
  if (!stageRefPath || typeof stageRefPath !== 'string') {
      console.warn(`[Service:getStageDefinitionByRef] Invalid stageRefPath provided: ${stageRefPath}`);
      return null;
  }
  try {
    const stageDocRef = doc(db, stageRefPath);
    const stageDocSnap = await getDoc(stageDocRef);
    if (stageDocSnap.exists()) {
      return { id: stageDocSnap.id, ...convertTimestampsToISO(stageDocSnap.data()) } as WorkflowStageDefinition;
    }
    console.warn(`[Service:getStageDefinitionByRef] Stage document not found at path: ${stageRefPath}`);
    return null;
  } catch (error) {
    console.error(`[Service:getStageDefinitionByRef] Error fetching stage by reference ${stageRefPath}:`, error);
    return null;
  }
};

const resolveLoanStageData = async (loanData: any): Promise<Partial<LoanRequest>> => {
  const resolvedData: Partial<LoanRequest> = {};
  const stageRefPath = loanData.currentStageRef?.path || loanData.currentStageRef;

  if (typeof stageRefPath === 'string' && stageRefPath) {
    const stageDef = await getStageDefinitionByRef(stageRefPath);
    if (stageDef) {
      resolvedData.currentStageId = stageDef.id;
      resolvedData.currentStageName = stageDef.name;
      resolvedData.assignedDepartment = stageDef.responsibleDepartment;

      const pathSegments = stageRefPath.split('/');
      if (pathSegments.length >= 5) {
        resolvedData.workflowDefinitionId = pathSegments[1];
        resolvedData.workflowVersionId = pathSegments[3];
      } else {
        console.warn("[Service:resolveLoanStageData] Could not parse workflowDefinitionId/VersionId from stageRefPath:", stageRefPath);
      }
      const isTerminal = stageDef.name.toLowerCase().includes("closed") ||
                         stageDef.name.toLowerCase().includes("rejected") ||
                         stageDef.name.toLowerCase().includes("disbursed") ||
                         stageDef.name.toLowerCase().includes("funded");
      resolvedData.isTerminalStage = isTerminal;

      if (loanData.stageDeadline) {
        const deadlineDate = loanData.stageDeadline instanceof Timestamp ? loanData.stageDeadline.toDate() : parseISO(loanData.stageDeadline);
        resolvedData.isOverdue = isBefore(deadlineDate, new Date()) && !isTerminal;
      } else {
        resolvedData.isOverdue = false;
      }
    } else {
        resolvedData.currentStageName = 'Unknown Stage (Ref Invalid)';
        resolvedData.isOverdue = false;
        resolvedData.isTerminalStage = false;
    }
  } else {
    resolvedData.currentStageName = 'Unknown Stage (No Valid Ref)';
    resolvedData.isOverdue = false;
    resolvedData.isTerminalStage = false;
  }
  return resolvedData;
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview' | 'workflowDefinitionId' | 'workflowVersionId' | 'currentStageId' | 'assignedDepartment' | 'currentStageName' | 'isTerminalStage'>
): Promise<{ id?: string; error?: string }> {
  console.log('--- ADD LOAN REQUEST SERVICE FUNCTION CALLED ---');
  console.log('[Service:addLoanRequest] Called with data:', JSON.stringify(loanData, null, 2));

  const activeWorkflowInfo = await getActiveWorkflowVersionForLoanType(loanData.loanType);

  if (!activeWorkflowInfo) {
    const errorMessage = `Cannot create loan. No usable active workflow (definition or version) found for loan type "${loanData.loanType}". Please check Settings: ensure a workflow definition exists for this loan type, it has at least one version, that version is marked 'active', and it has stages defined. Then save all settings to Firestore.`;
    console.error(`ADDLOANREQUEST_ERROR_DEBUG: activeWorkflowInfo was null for loan type "${loanData.loanType}".`);
    return createErrorResult(errorMessage, "addLoanRequest");
  }
  
  const { workflowDef, activeVersion, stages } = activeWorkflowInfo;

  if (!stages || stages.length === 0) {
    const errorMessage = `Cannot create loan. Loan Type: "${loanData.loanType}", Definition: "${workflowDef.name}" (ID: ${workflowDef.id}), Active Version: V${activeVersion.versionNumber} (ID: ${activeVersion.id}, IsActiveInDB: ${activeVersion.isActive}). The active workflow version has no stages defined. Please add stages to this version in Settings and save all settings to Firestore.`;
    console.error(`ADDLOANREQUEST_ERROR_DEBUG: activeWorkflowInfo.stages was empty. Definition: ${workflowDef.name} (ID: ${workflowDef.id}), Active Version: V${activeVersion.versionNumber} (ID: ${activeVersion.id}, IsActiveInDB: ${activeVersion.isActive})`);
    return createErrorResult(errorMessage, "addLoanRequest");
  }

  const firstStage = stages.find(s => s.order === 0);

  if (!firstStage) {
     const errorMessage = `First stage (order 0) not found for active workflow. Loan Type: "${loanData.loanType}", Definition: "${workflowDef.name}" (ID: ${workflowDef.id}), Active Version: V${activeVersion.versionNumber} (ID: ${activeVersion.id}). It has ${stages.length} stages. Ensure the active version has stages with sequential 'order' starting from 0 and is saved.`;
     console.error(`ADDLOANREQUEST_ERROR_DEBUG: First stage not found. Definition: ${workflowDef.name}, Active Version: V${activeVersion.versionNumber}, Stages found: ${stages.length}`);
     return createErrorResult(errorMessage, "addLoanRequest");
  }

  let assignedManagerId: string | null = null;
  let assignedManagerName: string | null = null;
  const firstStageDepartment = firstStage.responsibleDepartment;

  if (firstStageDepartment) {
    const potentialManagersInDept = mockUsers.filter(u => u.department === firstStageDepartment);
    let managerToAssign = potentialManagersInDept.find(u =>
        u.name.toLowerCase().includes("manager") &&
        (u.role === UserRole.UNDERWRITER || u.role === UserRole.RELATIONSHIP_MANAGER)
    );
    if (!managerToAssign) managerToAssign = potentialManagersInDept.find(u => u.role === UserRole.UNDERWRITER);
    if (!managerToAssign) managerToAssign = potentialManagersInDept.find(u => u.role === UserRole.RELATIONSHIP_MANAGER);

    if (managerToAssign) {
        assignedManagerId = managerToAssign.id;
        assignedManagerName = managerToAssign.name;
        console.log(`[Service:addLoanRequest] Assigning new loan to: ${assignedManagerName} (ID: ${assignedManagerId}) in department: ${firstStageDepartment}`);
    } else {
        console.log(`[Service:addLoanRequest] No suitable manager found in department: ${firstStageDepartment}. Loan will be unassigned to a specific user.`);
    }
  } else {
    console.log(`[Service:addLoanRequest] First stage department for workflow ${workflowDef.name} V${activeVersion.versionNumber} is not defined. Loan will be unassigned.`);
  }

  try {
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);

    let initialHistoryNote = `Loan application submitted. Workflow: ${workflowDef.name} (V${activeVersion.versionNumber}). Initial stage: ${firstStage.name}. Branch: ${loanData.customerBranch || 'N/A'}.`;
    if (assignedManagerName && firstStageDepartment) {
        initialHistoryNote += ` Assigned to ${assignedManagerName} in ${firstStageDepartment} department.`;
    } else if (firstStageDepartment) {
        initialHistoryNote += ` Awaiting staff assignment in ${firstStageDepartment} department.`;
    } else {
        initialHistoryNote += ` Awaiting assignment.`;
    }

    const newLoanDocData = {
      ...loanData,
      loanNumber: `LN-FS-${String(Date.now()).slice(-6)}`,
      customerNumber: `CUST-FS-${String(Date.now()).slice(-5)}`,
      workflowDefinitionId_mirror: workflowDef.id,
      workflowVersionRef: doc(db, `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}`),
      currentStageRef: doc(db, `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}/stages/${firstStage.id}`),
      assignedDepartment: firstStage.responsibleDepartment,
      assignedToUserId: assignedManagerId, // Storing as assignedToUserId
      submittedDate: Timestamp.fromDate(currentDate),
      lastUpdatedDate: serverTimestamp(),
      stageEntryDate: Timestamp.fromDate(currentDate),
      stageDeadline: Timestamp.fromDate(stageDeadlineDate),
      history: [{
          id: `hist-fs-${Date.now()}`,
          stageName: firstStage.name,
          timestamp: formatISO(currentDate),
          userId: assignedManagerId || 'system-fs-user', // Use assignedManagerId if available
          userName: assignedManagerName || 'System/User (Firestore)', // Use assignedManagerName if available
          notes: initialHistoryNote,
        },
      ],
      documents: [],
      isReadyForManagerReview: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const loanCollectionRef = collection(db, "loanRequests");
    const docRef = await addDoc(loanCollectionRef, newLoanDocData);

    console.log(`[Service:addLoanRequest] Loan added to Firestore with ID: ${docRef.id}.`);
    return { id: docRef.id };

  } catch (e: any) {
    return createErrorResult(`Failed to add loan request to Firestore.`, "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  console.log('[Service:getLoanRequests] Attempting to fetch from Firestore.');
  try {
    const loanCollectionRef = collection(db, "loanRequests");
    const q = query(loanCollectionRef, orderBy("lastUpdatedDate", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.log("[Service:getLoanRequests] No loan requests found in Firestore.");
        return { loans: [], users: mockUsers };
    }

    const loansFromFirestore: LoanRequest[] = [];
    for (const loanDoc of querySnapshot.docs) {
      const rawData = loanDoc.data();
      const stageRelatedData = await resolveLoanStageData(rawData);
      const loan: LoanRequest = {
        id: loanDoc.id,
        ...convertTimestampsToISO(rawData),
        ...stageRelatedData,
        history: Array.isArray(rawData.history) ? convertTimestampsToISO(rawData.history) : [],
        documents: Array.isArray(rawData.documents) ? convertTimestampsToISO(rawData.documents) : [],
        assignedTo: rawData.assignedToUserId, // Map from assignedToUserId
      } as LoanRequest;
      loansFromFirestore.push(loan);
    }

    console.log(`[Service:getLoanRequests] Fetched ${loansFromFirestore.length} loans from Firestore.`);
    return { loans: loansFromFirestore, users: mockUsers };
  } catch (e: any) {
    return createErrorResult("Failed to fetch loans from Firestore.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; workflowDefinitions?: WorkflowDefinition[] }> {
  console.log(`[Service:getLoanRequestById] Attempting to fetch ID ${id} from Firestore.`);
  try {
    const loanDocRef = doc(db, "loanRequests", id);
    const loanDocSnap = await getDoc(loanDocRef);

    if (loanDocSnap.exists()) {
      const rawData = loanDocSnap.data();
      const stageRelatedData = await resolveLoanStageData(rawData);

      const loan: LoanRequest = {
        id: loanDocSnap.id,
        ...convertTimestampsToISO(rawData),
        ...stageRelatedData,
        history: Array.isArray(rawData.history) ? convertTimestampsToISO(rawData.history) : [],
        documents: Array.isArray(rawData.documents) ? convertTimestampsToISO(rawData.documents) : [],
        assignedTo: rawData.assignedToUserId, // Map from assignedToUserId
      } as LoanRequest;

      const workflowsResult = await getWorkflowDefinitions();
      return { loan, users: mockUsers, workflowDefinitions: workflowsResult.workflows };
    } else {
      console.warn(`[Service:getLoanRequestById] Loan with ID "${id}" not found in Firestore.`);
      return { loan: null, users: mockUsers, error: `Loan with ID "${id}" not found.` };
    }
  } catch (e: any) {
    return createErrorResult(`Failed to fetch loan request for ID ${id} from Firestore.`, `getLoanRequestById-${id}`, e);
  }
}


export async function updateLoanRequest(
  id: string,
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>>
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
  console.log(`[Service:updateLoanRequest] Called for ID ${id} with data:`, dataToUpdate);

  const loanDocRef = doc(db, "loanRequests", id);
  try {
    await runTransaction(db, async (transaction) => {
      const loanDoc = await transaction.get(loanDocRef);
      if (!loanDoc.exists()) {
        throw new Error(`Loan with ID "${id}" not found.`);
      }

      const currentLoanData = loanDoc.data();
      const updatePayload: { [key: string]: any } = { ...dataToUpdate, lastUpdatedDate: serverTimestamp(), updatedAt: serverTimestamp() };

      const resolvedCurrentStageId = (await resolveLoanStageData(currentLoanData)).currentStageId;
      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== resolvedCurrentStageId) {

          const wfDefId = dataToUpdate.workflowDefinitionId || currentLoanData.workflowDefinitionId_mirror || (await resolveLoanStageData(currentLoanData)).workflowDefinitionId;
          const wfVersionRefPath = currentLoanData.workflowVersionRef?.path || currentLoanData.workflowVersionRef;
          const wfVerId = dataToUpdate.workflowVersionId || (wfVersionRefPath ? wfVersionRefPath.split('/')[3] : (await resolveLoanStageData(currentLoanData)).workflowVersionId);

          if(!wfDefId || !wfVerId) {
            throw new Error("Cannot determine workflowDefinitionId and workflowVersionId for stage transition.");
          }
          updatePayload.workflowDefinitionId_mirror = wfDefId;
          updatePayload.workflowVersionRef = doc(db, `workflowDefinitions/${wfDefId}/versions/${wfVerId}`);

          const newStageRefPath = `workflowDefinitions/${wfDefId}/versions/${wfVerId}/stages/${dataToUpdate.currentStageId}`;
          const newStageDef = await getStageDefinitionByRef(newStageRefPath);
          if (!newStageDef) {
            throw new Error(`New stage definition not found for path: ${newStageRefPath}`);
          }
          updatePayload.currentStageRef = doc(db, newStageRefPath);
          updatePayload.assignedDepartment = newStageDef.responsibleDepartment;
          updatePayload.assignedToUserId = dataToUpdate.assignedTo === undefined ? null : dataToUpdate.assignedTo; // Map to assignedToUserId
          updatePayload.stageEntryDate = serverTimestamp();
          updatePayload.stageDeadline = Timestamp.fromDate(addDays(new Date(), newStageDef.defaultTimelineDays));
          updatePayload.isReadyForManagerReview = false;

          delete updatePayload.currentStageId;
          delete updatePayload.workflowDefinitionId;
          delete updatePayload.workflowVersionId;
          delete updatePayload.currentStageName;

      } else {
        if(dataToUpdate.hasOwnProperty('assignedTo')){
            updatePayload.assignedToUserId = dataToUpdate.assignedTo === undefined ? null : dataToUpdate.assignedTo; // Map to assignedToUserId
            delete updatePayload.assignedTo;
        }
      }

      if (dataToUpdate.history && Array.isArray(dataToUpdate.history)) {
        updatePayload.history = dataToUpdate.history.map(entry => ({
          ...entry,
          timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : formatISO(new Date()) // Ensure ISO string
        }));
      }
      if (dataToUpdate.documents && Array.isArray(dataToUpdate.documents)) {
        updatePayload.documents = dataToUpdate.documents.map(docEntry => ({ // Renamed 'doc' to 'docEntry' to avoid conflict
          ...docEntry,
          uploadedAt: typeof docEntry.uploadedAt === 'string' ? docEntry.uploadedAt : (docEntry.uploadedAt ? formatISO(new Date(docEntry.uploadedAt)) : undefined)
        }));
      }
      
      const protectedFields = ['id', 'loanNumber', 'customerNumber', 'submittedDate', 'createdAt'];
      protectedFields.forEach(field => delete updatePayload[field]);


      transaction.update(loanDocRef, updatePayload);
    });

    const updatedDocSnap = await getDoc(loanDocRef);
    if (updatedDocSnap.exists()) {
        const rawData = updatedDocSnap.data();
        const stageRelatedData = await resolveLoanStageData(rawData);
        const updatedLoanObject: LoanRequest = {
            id: updatedDocSnap.id,
            ...convertTimestampsToISO(rawData),
            ...stageRelatedData,
            history: Array.isArray(rawData.history) ? convertTimestampsToISO(rawData.history) : [],
            documents: Array.isArray(rawData.documents) ? convertTimestampsToISO(rawData.documents) : [],
            assignedTo: rawData.assignedToUserId, // Map from assignedToUserId
        } as LoanRequest;
        console.log(`[Service:updateLoanRequest] Successfully updated loan ID: ${id} in Firestore.`);
        return { success: true, updatedLoan: updatedLoanObject };
    } else {
        return createErrorResult("Failed to retrieve updated loan after transaction.", `updateLoanRequest-${id}`);
    }

  } catch (e: any) {
    return createErrorResult(`Failed to update loan request for ID ${id} in Firestore.`, `updateLoanRequest-${id}`, e);
  }
}

export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  console.log('[Service:getWorkflowDefinitions] Attempting to fetch from Firestore.');
  try {
    const workflowDefsCollectionRef = collection(db, "workflowDefinitions");
    const q = query(workflowDefsCollectionRef, orderBy("loanType"));

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.warn("[Service:getWorkflowDefinitions] No workflow definitions found in Firestore.");
        return { workflows: [] };
    }

    const workflows: WorkflowDefinition[] = [];

    for (const wfDoc of querySnapshot.docs) {
      const wfData = convertTimestampsToISO(wfDoc.data()) as Omit<WorkflowDefinition, 'id' | 'versions'>;
      const definition: WorkflowDefinition = { id: wfDoc.id, ...wfData, versions: [] };

      const versionsCollectionRef = collection(db, `workflowDefinitions/${wfDoc.id}/versions`);
      const versionsQuery = query(versionsCollectionRef, orderBy("versionNumber", "desc"));
      const versionsSnapshot = await getDocs(versionsQuery);

      for (const versionDoc of versionsSnapshot.docs) {
        const versionData = convertTimestampsToISO(versionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages' | 'workflowDefinitionId'>;
        const version: WorkflowVersion = { id: versionDoc.id, workflowDefinitionId: wfDoc.id, ...versionData, stages: [] };

        const stagesCollectionRef = collection(db, `workflowDefinitions/${wfDoc.id}/versions/${versionDoc.id}/stages`);
        const stagesQuery = query(stagesCollectionRef, orderBy("order", "asc"));
        const stagesSnapshot = await getDocs(stagesQuery);

        version.stages = stagesSnapshot.docs.map(stageDoc => ({
          id: stageDoc.id, ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>)
        }));
        definition.versions.push(version);
      }
      workflows.push(definition);
    }

    console.log(`[Service:getWorkflowDefinitions] Fetched ${workflows.length} workflow definitions from Firestore.`);
    return { workflows };
  } catch (e: any) {
    let errorMessage = "Failed to fetch workflow definitions from Firestore.";
    if (e instanceof Error && 'message' in e) {
      errorMessage += ` Raw: ${e.message}`;
      if (e.message.includes("query requires an index")) {
        errorMessage += " Please check Firestore console for index creation link.";
      }
    }
    console.error("[Service:getWorkflowDefinitions] Firestore error:", e);
    return { error: errorMessage };
  }
}

export async function addWorkflowDefinitionToFirestore(
  definitionData: Omit<WorkflowDefinition, 'id' | 'versions' | 'createdAt' | 'updatedAt'>
): Promise<{ id?: string; error?: string }> {
  console.log('[Service:addWorkflowDefinitionToFirestore] Called with data:', definitionData);
  try {
    const workflowDefsCollectionRef = collection(db, "workflowDefinitions");
    const newDefDocData = {
      ...definitionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(workflowDefsCollectionRef, newDefDocData);
    console.log(`[Service:addWorkflowDefinitionToFirestore] Workflow definition added to Firestore with ID: ${docRef.id}.`);
    return { id: docRef.id };
  } catch (e: any) {
    return createErrorResult(`Failed to add workflow definition to Firestore.`, "addWorkflowDefinitionToFirestore", e);
  }
}


export async function saveWorkflowDefinitions(definitions: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  console.log("[Service:saveWorkflowDefinitions] Attempting to save to Firestore:", definitions.length, "definitions");
  const batch = writeBatch(db);
  try {
    for (const definition of definitions) {
      const definitionId = definition.id;
      if (!definitionId) {
        console.error("[Service:saveWorkflowDefinitions] CRITICAL ERROR: Workflow definition is missing an ID. Definition:", definition);
        throw new Error(`Workflow definition "${definition.name}" is missing an ID.`);
      }
      console.log(`[Service:saveWorkflowDefinitions] Processing Definition for save: ID ${definitionId}, Name: "${definition.name}", LoanType: "${definition.loanType}"`);

      const defRef = doc(db, "workflowDefinitions", definitionId);
      const { versions, id: _defId, createdAt: defCreatedAtFromUI, updatedAt: _defUpdatedAtFromUI, ...defDataFromUI } = definition;
      const defPayload: any = { ...defDataFromUI, updatedAt: serverTimestamp() };
      if (defCreatedAtFromUI && typeof defCreatedAtFromUI === 'string') {
        defPayload.createdAt = Timestamp.fromDate(parseISO(defCreatedAtFromUI));
      } else if (!defPayload.createdAt) { // Only set if not already set (e.g., by Firestore on creation)
        defPayload.createdAt = serverTimestamp();
      }
      console.log(`[Service:saveWorkflowDefinitions]   BATCH.SET (Definition) Path: ${defRef.path}, Payload:`, JSON.stringify(defPayload));
      batch.set(defRef, defPayload, { merge: true });

      let existingVersionIds = new Set<string>();
      try {
        const versionsSnapshot = await getDocs(collection(defRef, "versions"));
        existingVersionIds = new Set<string>(versionsSnapshot.docs.map(d => d.id));
        console.log(`[Service:saveWorkflowDefinitions]   Found ${existingVersionIds.size} existing versions in Firestore for Def ID ${definitionId}:`, Array.from(existingVersionIds));
      } catch (versionsFetchError: any) {
        console.error(`[Service:saveWorkflowDefinitions]   ERROR fetching existing versions for Def ID ${definitionId}:`, versionsFetchError);
        // Decide if this is a critical error or if we can proceed (e.g., assume no existing versions)
        // For now, log and continue, which means deletion logic for versions might not run if this fails.
      }
      
      const incomingVersionIds = new Set<string>();

      for (const version of versions) {
        const versionId = version.id;
        if (!versionId) {
          console.error("[Service:saveWorkflowDefinitions]   CRITICAL ERROR: Version is missing an ID. Version:", version, "Parent Def:", definition.name);
          throw new Error(`Version number "${version.versionNumber}" for definition "${definition.name}" is missing an ID.`);
        }
        incomingVersionIds.add(versionId);
        console.log(`[Service:saveWorkflowDefinitions]     Processing Version for save: ID ${versionId}, V${version.versionNumber}, IsActive: ${version.isActive}, Stages: ${version.stages.length}`);

        const versionRef = doc(collection(defRef, "versions"), versionId);
        const { stages, id: _verId, workflowDefinitionId: _wfDefId, createdAt: verCreatedAtFromUI, updatedAt: _verUpdatedAtFromUI, ...versionDataFromUI } = version;
        const versionPayload: any = {...versionDataFromUI, workflowDefinitionId: definitionId, updatedAt: serverTimestamp() };
        if (verCreatedAtFromUI && typeof verCreatedAtFromUI === 'string') {
          versionPayload.createdAt = Timestamp.fromDate(parseISO(verCreatedAtFromUI));
        } else if (!versionPayload.createdAt) {
          versionPayload.createdAt = serverTimestamp();
        }
        console.log(`[Service:saveWorkflowDefinitions]       BATCH.SET (Version) Path: ${versionRef.path}, Payload:`, JSON.stringify(versionPayload));
        batch.set(versionRef, versionPayload, { merge: true });

        let existingStageIds = new Set<string>();
        try {
            const stagesSnapshot = await getDocs(collection(versionRef, "stages"));
            existingStageIds = new Set<string>(stagesSnapshot.docs.map(d => d.id));
            console.log(`[Service:saveWorkflowDefinitions]       Found ${existingStageIds.size} existing stages in Firestore for Version ID ${versionId}:`, Array.from(existingStageIds));
        } catch (stagesFetchError: any) {
            console.error(`[Service:saveWorkflowDefinitions]       ERROR fetching existing stages for Version ID ${versionId}:`, stagesFetchError);
        }

        const incomingStageIds = new Set<string>();
        for (const stage of stages) {
          const stageId = stage.id;
          if (!stageId) {
            console.error("[Service:saveWorkflowDefinitions]       CRITICAL ERROR: Stage is missing an ID. Stage:", stage, "Parent Version:", version.versionNumber);
            throw new Error(`Stage "${stage.name}" for version "${version.versionNumber}" is missing an ID.`);
          }
          incomingStageIds.add(stageId);
          console.log(`[Service:saveWorkflowDefinitions]         Processing Stage for save: ID ${stageId}, Name: "${stage.name}", Order: ${stage.order}`);
          
          const stageRef = doc(collection(versionRef, "stages"), stageId);
          const { id: _stageId, createdAt: stageCreatedAtFromUI, updatedAt: _stageUpdatedAtFromUI, ...stageDataFromUI } = stage;
          const stagePayload: any = {...stageDataFromUI, updatedAt: serverTimestamp() };
          if(stageCreatedAtFromUI && typeof stageCreatedAtFromUI === 'string') {
            stagePayload.createdAt = Timestamp.fromDate(parseISO(stageCreatedAtFromUI));
          } else if (!stagePayload.createdAt) {
            stagePayload.createdAt = serverTimestamp();
          }
          console.log(`[Service:saveWorkflowDefinitions]           BATCH.SET (Stage) Path: ${stageRef.path}, Payload:`, JSON.stringify(stagePayload));
          batch.set(stageRef, stagePayload, { merge: true });
        }
        
        existingStageIds.forEach(id => {
          if (!incomingStageIds.has(id)) {
            console.log(`[Service:saveWorkflowDefinitions]       BATCH.DELETE (Stage) Path: workflowDefinitions/${definitionId}/versions/${versionId}/stages/${id}`);
            batch.delete(doc(collection(versionRef, "stages"), id));
          }
        });
      }
      
       existingVersionIds.forEach(id => {
        if (!incomingVersionIds.has(id)) {
          console.log(`[Service:saveWorkflowDefinitions]   BATCH.DELETE (Version) Path: workflowDefinitions/${definitionId}/versions/${id}`);
          batch.delete(doc(collection(defRef, "versions"), id));
        }
      });
    }

    await batch.commit();
    console.log("[Service:saveWorkflowDefinitions] Workflow definitions batch written to Firestore successfully.");
    return { success: true };
  } catch (e: any) {
    console.error("[Service:saveWorkflowDefinitions] Firestore error during batch write:", e);
    return createErrorResult("Failed to save workflow definitions to Firestore.", "saveWorkflowDefinitions", e);
  }
}

export async function getDepartments(): Promise<{ departments?: {id: string, name: DepartmentType}[]; error?: string }> {
  console.log('[Service:getDepartments] Attempting to fetch from Firestore.');
  try {
    const departmentsCollectionRef = collection(db, "departments");
    const q = query(departmentsCollectionRef, orderBy("name"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.warn("[Service:getDepartments] No departments found in Firestore 'departments' collection.");
        return { departments: [] };
    }

    const departments: {id: string, name: DepartmentType}[] = [];
    querySnapshot.forEach((docSnap) => {
      const deptName = docSnap.data().name as string;
      if (deptName) {
        departments.push({ id: docSnap.id, name: deptName });
      } else {
        console.warn(`[Service:getDepartments] Document ID ${docSnap.id} in 'departments' collection is missing a 'name' field.`);
      }
    });

    if(departments.length === 0){
        console.warn("[Service:getDepartments] No valid department documents (with a 'name' field) found, though collection was not empty.");
    } else {
        console.log(`[Service:getDepartments] Fetched ${departments.length} departments from Firestore.`);
    }
    return { departments };
  } catch (e: any) {
    return createErrorResult("Failed to fetch departments from Firestore.", "getDepartments", e);
  }
}

export async function addDepartment(departmentName: string): Promise<{ id?: string; error?: string }> {
  console.log(`[Service:addDepartment] Adding department: ${departmentName}`);
  try {
    const q = query(collection(db, "departments"), where("name_lowercase", "==", departmentName.toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return createErrorResult(`Department "${departmentName}" already exists.`, "addDepartment");
    }

    const departmentsCollectionRef = collection(db, "departments");
    const newDepartmentDoc = {
      name: departmentName,
      name_lowercase: departmentName.toLowerCase(), // For case-insensitive checks
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(departmentsCollectionRef, newDepartmentDoc);
    console.log(`[Service:addDepartment] Department "${departmentName}" added with ID: ${docRef.id}`);
    return { id: docRef.id };
  } catch (e: any) {
    return createErrorResult(`Failed to add department "${departmentName}".`, "addDepartment", e);
  }
}

export async function deleteDepartment(departmentId: string): Promise<{ success?: boolean; error?: string }> {
  console.log(`[Service:deleteDepartment] Deleting department ID: ${departmentId}`);
  try {
    const departmentDocRef = doc(db, "departments", departmentId);
    await deleteDoc(departmentDocRef);
    console.log(`[Service:deleteDepartment] Department ID: ${departmentId} deleted successfully.`);
    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to delete department ID: ${departmentId}.`, "deleteDepartment", e);
  }
}


export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  console.log('--- GET AVAILABLE LOAN TYPES FOR WORKFLOW SERVICE FUNCTION CALLED ---');
  try {
    const availableTypes = new Set<string>();
    console.log('[Service:getAvailableLoanTypesForWorkflow] FIRESTORE DEBUG: Querying all workflowDefinitions.');
    const q = query(collection(db, "workflowDefinitions"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.warn("[Service:getAvailableLoanTypesForWorkflow] No workflow definitions found at all in Firestore.");
        return { loanTypes: [] };
    }
    console.log(`[Service:getAvailableLoanTypesForWorkflow] Found ${querySnapshot.docs.length} workflow definitions in total.`);

    for (const defDoc of querySnapshot.docs) {
      const definitionId = defDoc.id;
      const loanType = defDoc.data().loanType as string;
      const defName = defDoc.data().name as string;
      console.log(`[Service:getAvailableLoanTypesForWorkflow] Processing Definition: Name "${defName}", ID "${definitionId}", LoanType: "${loanType}"`);

      if (!loanType) {
        console.warn(`[Service:getAvailableLoanTypesForWorkflow] Workflow definition ${definitionId} is missing loanType field.`);
        continue;
      }

      console.log(`[Service:getAvailableLoanTypesForWorkflow] FIRESTORE DEBUG: Querying active versions for workflowDefinitions/${definitionId}/versions`);
      const versionsQuery = query(
        collection(db, `workflowDefinitions/${definitionId}/versions`),
        where("isActive", "==", true), // Explicitly look for active versions
        limit(1)
      );
      let versionsSnapshot = await getDocs(versionsQuery);
      let activeVersionDoc;
      let activeVersionId;
      let activeVersionNumber;

      if (!versionsSnapshot.empty) {
        activeVersionDoc = versionsSnapshot.docs[0];
        activeVersionId = activeVersionDoc.id;
        activeVersionNumber = activeVersionDoc.data().versionNumber;
         console.log(`[Service:getAvailableLoanTypesForWorkflow] Found EXPLICITLY ACTIVE version for "${loanType}" (Def ID: ${definitionId}): Version ID ${activeVersionId}, V${activeVersionNumber}. Checking for stages.`);
      } else {
        // Fallback: if no explicitly active version, check the latest version and see if it's implicitly active (or if we should consider it)
        console.warn(`[Service:getAvailableLoanTypesForWorkflow] No explicitly 'isActive:true' version for "${loanType}" (Def ID: ${definitionId}). Checking latest version as fallback.`);
        const latestVersionQuery = query(
            collection(db, `workflowDefinitions/${definitionId}/versions`),
            orderBy("versionNumber", "desc"),
            limit(1)
        );
        const latestVersionSnapshot = await getDocs(latestVersionQuery);
        if (!latestVersionSnapshot.empty) {
            activeVersionDoc = latestVersionSnapshot.docs[0];
            activeVersionId = activeVersionDoc.id;
            activeVersionNumber = activeVersionDoc.data().versionNumber;
            // We still need to ensure this latest version should be considered "active" for new loans
            // For this function's purpose, if a version has isActive:false, it shouldn't be used for new loans.
            // So, if the latest has isActive:false, we skip it.
            if(activeVersionDoc.data().isActive !== true) {
                 console.warn(`[Service:getAvailableLoanTypesForWorkflow] Latest version V${activeVersionNumber} (ID: ${activeVersionId}) for "${loanType}" is NOT marked isActive:true. Skipping.`);
                 continue; 
            }
            console.log(`[Service:getAvailableLoanTypesForWorkflow] Fallback to LATEST version for "${loanType}" (Def ID: ${definitionId}): Version ID ${activeVersionId}, V${activeVersionNumber} (isActive in DB: ${activeVersionDoc.data().isActive}). Checking for stages.`);
        } else {
            console.warn(`[Service:getAvailableLoanTypesForWorkflow] No versions found AT ALL for "${loanType}" (Def ID: ${definitionId}). Skipping.`);
            continue; // No versions at all for this definition
        }
      }
        
      console.log(`[Service:getAvailableLoanTypesForWorkflow] FIRESTORE DEBUG: Querying stages for workflowDefinitions/${definitionId}/versions/${activeVersionId}/stages`);
      const stagesQuery = query(
        collection(db, `workflowDefinitions/${definitionId}/versions/${activeVersionId}/stages`),
        limit(1) // We only need to know if at least one stage exists
      );
      const stagesSnapshot = await getDocs(stagesQuery);
      console.log(`[Service:getAvailableLoanTypesForWorkflow] Stages snapshot for active/latest version ${activeVersionId} is empty: ${stagesSnapshot.empty}`);

      if (!stagesSnapshot.empty) {
        console.log(`[Service:getAvailableLoanTypesForWorkflow] Loan type "${loanType}" (Def ID: ${definitionId}, Active/Latest Version ID: ${activeVersionId}) HAS STAGES. Adding to available list.`);
        availableTypes.add(loanType);
      } else {
        console.warn(`[Service:getAvailableLoanTypesForWorkflow] Loan type "${loanType}" (Def ID: ${definitionId}, Active/Latest Version ID: ${activeVersionId}) has an active/latest version but NO STAGES. Not including in available list.`);
      }
    }

    const loanTypesArray = Array.from(availableTypes).sort();
    if (loanTypesArray.length === 0) {
        console.warn("[Service:getAvailableLoanTypesForWorkflow] FINAL: No loan types with *active* workflows that also have stages found in Firestore.");
    } else {
        console.log(`[Service:getAvailableLoanTypesForWorkflow] FINAL: Returning available types with active workflows (that have stages) from Firestore: ${loanTypesArray.join(', ')}`);
    }
    return { loanTypes: loanTypesArray };
  } catch (e: any) {
    console.error(`[Service:getAvailableLoanTypesForWorkflow] FIRESTORE ERROR during operation:`, e);
    if (e.code === 'unavailable' || e.code === 'deadline-exceeded') {
      console.error(`[Service:getAvailableLoanTypesForWorkflow] Firestore connection error: ${e.message}. The backend might be unreachable.`);
    }
    return createErrorResult("Failed to fetch available loan types for workflow from Firestore.", "getAvailableLoanTypesForWorkflow", e);
  }
}
