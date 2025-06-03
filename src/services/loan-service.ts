
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

console.log("--- loan-service.ts loaded ---"); // Top-level log to confirm file execution

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    const errorDetails = (typeof originalError === 'object' && originalError !== null && typeof originalError.message === 'string') ? originalError.message : String(originalError);
    detailedMessage += ` Raw: ${errorDetails}`;
  }
  console.error(`[Service:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

const convertTimestampsToISO = (data: any, depth = 0, maxDepth = 20, seen = new Set()): any => { // Increased maxDepth slightly as a precaution
  if (depth > maxDepth) {
    console.warn(`[Service:convertTimestampsToISO] Max recursion depth (${maxDepth}) reached. Returning placeholder. Path might be too deep or circular.`);
    return "[Max Depth Exceeded]";
  }

  if (data === null || typeof data !== 'object') {
    return data; // Primitives, null
  }

  if (seen.has(data)) {
    // console.warn(`[Service:convertTimestampsToISO] Circular reference detected at depth ${depth}.`);
    return "[Circular Reference]";
  }

  if (data instanceof Timestamp) {
    return formatISO(data.toDate());
  }
  // Handle Firestore-like Timestamp objects if not direct instance (less common with modern SDK but good fallback)
  if (typeof data.toDate === 'function' && !(data instanceof Date)) {
    try {
      return formatISO(data.toDate());
    } catch (e) {
      console.warn('[Service:convertTimestampsToISO] Error calling toDate on a Timestamp-like object:', e);
      return "[Invalid Timestamp-like Object]";
    }
  }
  
  // Check for DocumentReference-like objects (duck-typing) BEFORE adding to 'seen' or iterating
  // Common properties: 'path' (string), 'id' (string). Also check for specific methods if possible or constructor name.
  if (typeof data.path === 'string' && typeof data.id === 'string') {
      // console.log(`[Service:convertTimestampsToISO] Duck-typed DocumentReference at depth ${depth}, path: ${data.path}. Returning as is.`);
      return data; // Return DocumentReference-like objects as they are
  }


  seen.add(data); // Add current object/array to seen set for its processing scope

  let res: any;
  if (Array.isArray(data)) {
    res = data.map(item => convertTimestampsToISO(item, depth + 1, maxDepth, seen));
  } else { // General object iteration
    res = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        res[key] = convertTimestampsToISO(data[key], depth + 1, maxDepth, seen);
      }
    }
  }

  seen.delete(data); // Remove current object/array from seen set after its scope is processed
  return res;
};


const getActiveWorkflowVersionForLoanType = async (loanType: string): Promise<{ workflowDef: WorkflowDefinition, activeVersion: WorkflowVersion, stages: WorkflowStageDefinition[] } | null> => {
  console.log(`--- GET ACTIVE WORKFLOW VERSION FOR LOAN TYPE ---`);
  console.log(`[Service:getActiveWfVer] Querying for loanType: "${loanType}"`);
  try {
    const wfDefQuery = query(collection(db, "workflowDefinitions"), where("loanType", "==", loanType));
    const wfDefSnapshot = await getDocs(wfDefQuery);

    console.log(`[Service:getActiveWfVer] FIRESTORE DEBUG: Workflow definition snapshot for "${loanType}" is empty: ${wfDefSnapshot.empty}`);
    if (wfDefSnapshot.empty) {
      console.warn(`[Service:getActiveWfVer] No workflow definition found for loan type: "${loanType}"`);
      return null;
    }
    const wfDefDoc = wfDefSnapshot.docs[0];
    const wfDefData = convertTimestampsToISO(wfDefDoc.data()) as Omit<WorkflowDefinition, 'id' | 'versions'>;
    console.log(`[Service:getActiveWfVer] Found Definition ID: ${wfDefDoc.id}, Name: "${wfDefData.name}" for loanType: "${loanType}"`);

    const workflowDefinition: WorkflowDefinition = { id: wfDefDoc.id, ...wfDefData, versions: [] };

    console.log(`[Service:getActiveWfVer] FIRESTORE DEBUG: Querying STRICTLY ACTIVE versions (isActive:true) for workflowDefinitions/${wfDefDoc.id}/versions.`);
    const activeVersionsQuery = query(
      collection(db, `workflowDefinitions/${wfDefDoc.id}/versions`),
      where("isActive", "==", true),
      limit(1) // There should only be one active version
    );
    const versionsSnapshot = await getDocs(activeVersionsQuery);
    
    let activeVersionDoc: any; // Firestore QueryDocumentSnapshot

    if (versionsSnapshot.empty) {
      console.warn(`[Service:getActiveWfVer] No version explicitly marked 'isActive: true' found for Definition ID: ${wfDefDoc.id} (Loan Type: "${loanType}"). THIS LOAN TYPE CANNOT BE USED FOR NEW REQUESTS.`);
      return null; // Strict: only proceed if an explicitly active version is found
    } else {
      activeVersionDoc = versionsSnapshot.docs[0];
      console.log(`[Service:getActiveWfVer] Found EXPLICITLY ACTIVE Version ID: ${activeVersionDoc.id}, Number: V${activeVersionDoc.data().versionNumber}, IsActiveInDB: ${activeVersionDoc.data().isActive}`);
    }
    
    const activeVersionData = convertTimestampsToISO(activeVersionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages' | 'workflowDefinitionId'>;
    const activeVersion: WorkflowVersion = {
        id: activeVersionDoc.id,
        workflowDefinitionId: wfDefDoc.id,
        ...activeVersionData,
        stages: [], 
        isActive: true // We queried for isActive: true
    };
    console.log(`[Service:getActiveWfVer] Chosen Version for processing: ID ${activeVersion.id}, V${activeVersion.versionNumber}, IsActiveInDB: ${activeVersion.isActive}`);

    const stagesPath = `workflowDefinitions/${wfDefDoc.id}/versions/${activeVersion.id}/stages`;
    console.log(`[Service:getActiveWfVer] FIRESTORE DEBUG: Querying stages from path: "${stagesPath}"`);
    const stagesQuery = query(
        collection(db, stagesPath),
        orderBy("order", "asc")
    );
    const stagesSnapshot = await getDocs(stagesQuery);
    console.log(`[Service:getActiveWfVer] Stages snapshot for Version ID ${activeVersion.id} is empty: ${stagesSnapshot.empty}`);
    console.log(`[Service:getActiveWfVer] Found ${stagesSnapshot.docs.length} stage documents for Version ID: ${activeVersion.id}`);

    if (stagesSnapshot.empty) {
        console.warn(`[Service:getActiveWfVer] FIRESTORE WARNING: The stages query for path "${stagesPath}" (Active Version ID: ${activeVersion.id}) returned an EMPTY snapshot. This active version has no stages.`);
        activeVersion.stages = []; // Ensure stages is an empty array
    } else {
      activeVersion.stages = stagesSnapshot.docs.map(stageDoc => {
          const stageData = { id: stageDoc.id, ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>) };
          console.log(`[Service:getActiveWfVer]   Mapping stage: ID ${stageData.id}, Name: "${stageData.name}", Order: ${stageData.order}`);
          return stageData;
      });
    }


    if (activeVersion.stages.length === 0) {
        console.warn(`[Service:getActiveWfVer] CRITICAL: Active Version ID ${activeVersion.id} (V${activeVersion.versionNumber}) for loan type "${loanType}" (Def: ${workflowDefinition.name}) resolved to 0 stages after query. This version is unusable for new loans.`);
        return null; 
    }

    return { workflowDef: workflowDefinition, activeVersion, stages: activeVersion.stages };

  } catch (error: any) {
    console.error(`[Service:getActiveWfVer] FIRESTORE ERROR during operation for loan type "${loanType}":`, error.message, error.code, error.stack);
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      console.error(`[Service:getActiveWfVer] Firestore connection error: ${error.message}. The backend might be unreachable.`);
    } else if (error.code === 'permission-denied') {
      console.error(`[Service:getActiveWfVer] Firestore permission denied: ${error.message}. Check security rules.`);
    } else if (error.message?.toLowerCase().includes("query requires an index")) {
       console.error(`[Service:getActiveWfVer] Firestore index missing: ${error.message}. Check Firestore console for index creation link.`);
    }
    return null; 
  }
};


const getStageDefinitionByRef = async (stageRefPath: string): Promise<WorkflowStageDefinition | null> => {
  if (!stageRefPath || typeof stageRefPath !== 'string') {
      console.warn(`[Service:getStageDefinitionByRef] Invalid stageRefPath provided: ${stageRefPath}`);
      return null;
  }
  try {
    // Assuming stageRefPath is a full path like "workflowDefinitions/defId/versions/verId/stages/stageId"
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
  // Ensure we are getting the string path from the DocumentReference object
  const stageRefPath = loanData.currentStageRef?.path;

  if (typeof stageRefPath === 'string' && stageRefPath) {
    const stageDef = await getStageDefinitionByRef(stageRefPath);
    if (stageDef) {
      resolvedData.currentStageId = stageDef.id;
      resolvedData.currentStageName = stageDef.name;
      resolvedData.assignedDepartment = stageDef.responsibleDepartment;

      const pathSegments = stageRefPath.split('/');
      if (pathSegments.length >= 5) { // e.g. workflowDefinitions/DEF_ID/versions/VER_ID/stages/STAGE_ID
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
        // Ensure stageDeadline is converted from Timestamp if necessary before parsing
        const deadlineInput = loanData.stageDeadline instanceof Timestamp ? loanData.stageDeadline.toDate().toISOString() : loanData.stageDeadline;
        try {
            const deadlineDate = parseISO(deadlineInput);
            resolvedData.isOverdue = isBefore(deadlineDate, new Date()) && !isTerminal;
        } catch (e) {
            console.warn(`[Service:resolveLoanStageData] Invalid stageDeadline format: ${deadlineInput}`, e);
            resolvedData.isOverdue = false;
        }

      } else {
        resolvedData.isOverdue = false;
      }
    } else {
        console.warn(`[Service:resolveLoanStageData] Could not resolve stage definition for path: ${stageRefPath}`);
        resolvedData.currentStageName = 'Unknown Stage (Ref Invalid)';
        resolvedData.isOverdue = false;
        resolvedData.isTerminalStage = false;
    }
  } else {
    console.warn(`[Service:resolveLoanStageData] No valid stageRefPath (loanData.currentStageRef.path) found in loanData:`, loanData);
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
    const errorMessage = `Cannot create loan for type "${loanData.loanType}". No properly configured active workflow version (with stages) found. Please ensure an active version exists with stages defined in Settings, and save all settings.`;
    console.error(`ADDLOANREQUEST_ERROR_DEBUG: activeWorkflowInfo was null for loan type "${loanData.loanType}". getActiveWorkflowVersionForLoanType determined no usable active version.`);
    return createErrorResult(errorMessage, "addLoanRequest");
  }
  
  const { workflowDef, activeVersion, stages } = activeWorkflowInfo;

  // This check is now technically redundant due to changes in getActiveWorkflowVersionForLoanType,
  // but kept as a safeguard.
  if (!stages || stages.length === 0) { 
    const errorMessage = `Cannot create loan (Internal Error). Loan Type: "${loanData.loanType}", Definition: "${workflowDef.name}" (ID: ${workflowDef.id}), Active Version: V${activeVersion.versionNumber} (ID: ${activeVersion.id}). The active workflow version has no stages. This should have been caught by getActiveWorkflowVersionForLoanType.`;
    console.error(`ADDLOANREQUEST_ERROR_DEBUG: activeWorkflowInfo.stages was empty or null. Definition: ${workflowDef.name}, Active Version: V${activeVersion.versionNumber}`);
    return createErrorResult(errorMessage, "addLoanRequest");
  }

  const firstStage = stages.find(s => s.order === 0);

  if (!firstStage) {
     const errorMessage = `First stage (order 0) not found for active workflow. Loan Type: "${loanData.loanType}", Definition: "${workflowDef.name}" (ID: ${workflowDef.id}), Active Version: V${activeVersion.versionNumber} (ID: ${activeVersion.id}). It has ${stages.length} stages. Ensure the active version has stages with sequential 'order' starting from 0 and is saved.`;
     console.error(`ADDLOANREQUEST_ERROR_DEBUG: First stage not found. Definition: ${workflowDef.name}, Active Version: V${activeVersion.versionNumber}, Stages found: ${stages.length}`);
     return createErrorResult(errorMessage, "addLoanRequest");
  }

  let assignedManagerId: string | undefined = undefined;
  let assignedManagerName: string | undefined = undefined;
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
        console.log(`[Service:addLoanRequest] No suitable manager found in department: ${firstStageDepartment}. Loan will be unassigned to a specific user in this department.`);
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
      assignedToUserId: assignedManagerId || null, 
      submittedDate: Timestamp.fromDate(currentDate),
      lastUpdatedDate: serverTimestamp(),
      stageEntryDate: Timestamp.fromDate(currentDate), 
      stageDeadline: Timestamp.fromDate(stageDeadlineDate),
      history: [{
          id: `hist-fs-${Date.now()}`,
          stageName: firstStage.name,
          timestamp: formatISO(currentDate),
          userId: assignedManagerId || 'system-fs-auto',
          userName: assignedManagerName || 'System Automation',
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
      const stageRelatedData = await resolveLoanStageData(rawData); // This involves more Firestore reads
      const loan: LoanRequest = {
        id: loanDoc.id,
        ...convertTimestampsToISO(rawData), // Call 1
        ...stageRelatedData,
        history: Array.isArray(rawData.history) ? convertTimestampsToISO(rawData.history) : [], // Call 2
        documents: Array.isArray(rawData.documents) ? convertTimestampsToISO(rawData.documents) : [], // Call 3
        assignedTo: rawData.assignedToUserId || undefined, 
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
        assignedTo: rawData.assignedToUserId || undefined,
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
  console.log(`[Service:updateLoanRequest] Called for ID ${id} with data:`, JSON.stringify(dataToUpdate, null, 2));

  const loanDocRef = doc(db, "loanRequests", id);
  try {
    await runTransaction(db, async (transaction) => {
      const loanDoc = await transaction.get(loanDocRef);
      if (!loanDoc.exists()) {
        throw new Error(`Loan with ID "${id}" not found for update.`);
      }

      const currentLoanData = loanDoc.data();
      const updatePayload: { [key: string]: any } = { ...dataToUpdate, lastUpdatedDate: serverTimestamp(), updatedAt: serverTimestamp() };

      const resolvedCurrentStageId = (await resolveLoanStageData(currentLoanData)).currentStageId;

      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== resolvedCurrentStageId) {
          console.log(`[Service:updateLoanRequest] Stage change detected. New stage ID: ${dataToUpdate.currentStageId}`);
          const wfDefId = dataToUpdate.workflowDefinitionId || currentLoanData.workflowDefinitionId_mirror || (await resolveLoanStageData(currentLoanData)).workflowDefinitionId;
          
          let wfVerId = dataToUpdate.workflowVersionId;
          if (!wfVerId) {
            const currentWfVersionRefPath = currentLoanData.workflowVersionRef?.path;
            if (currentWfVersionRefPath && typeof currentWfVersionRefPath === 'string') {
              wfVerId = currentWfVersionRefPath.split('/')[3];
            } else {
                const resolvedWfVerId = (await resolveLoanStageData(currentLoanData)).workflowVersionId;
                if(resolvedWfVerId) wfVerId = resolvedWfVerId;
            }
          }
          
          if(!wfDefId || !wfVerId) {
            console.error("[Service:updateLoanRequest] CRITICAL: Cannot determine workflowDefinitionId or workflowVersionId for stage transition.", {wfDefId, wfVerId, dataToUpdate});
            throw new Error("Workflow context (DefinitionId or VersionId) missing for stage transition.");
          }

          updatePayload.workflowDefinitionId_mirror = wfDefId; 
          updatePayload.workflowVersionRef = doc(db, `workflowDefinitions/${wfDefId}/versions/${wfVerId}`);
          
          const newStageRefPath = `workflowDefinitions/${wfDefId}/versions/${wfVerId}/stages/${dataToUpdate.currentStageId}`;
          const newStageDef = await getStageDefinitionByRef(newStageRefPath);
          if (!newStageDef) {
            console.error(`[Service:updateLoanRequest] New stage definition not found for path: ${newStageRefPath}`);
            throw new Error(`New stage definition not found for path: ${newStageRefPath}. Ensure stage ID "${dataToUpdate.currentStageId}" exists in version "${wfVerId}".`);
          }
          console.log(`[Service:updateLoanRequest] New stage def resolved: ${newStageDef.name}, Dept: ${newStageDef.responsibleDepartment}, Timeline: ${newStageDef.defaultTimelineDays}d`);

          updatePayload.currentStageRef = doc(db, newStageRefPath);
          updatePayload.assignedDepartment = newStageDef.responsibleDepartment;
          updatePayload.assignedToUserId = dataToUpdate.hasOwnProperty('assignedTo') ? (dataToUpdate.assignedTo === undefined || dataToUpdate.assignedTo === null ? null : dataToUpdate.assignedTo) : currentLoanData.assignedToUserId;
          updatePayload.stageEntryDate = serverTimestamp();
          updatePayload.stageDeadline = Timestamp.fromDate(addDays(new Date(), newStageDef.defaultTimelineDays));
          updatePayload.isReadyForManagerReview = false; 

          delete updatePayload.currentStageId;
          delete updatePayload.workflowDefinitionId; 
          delete updatePayload.workflowVersionId;
          delete updatePayload.currentStageName; 

      } else if (dataToUpdate.hasOwnProperty('assignedTo')) {
          updatePayload.assignedToUserId = dataToUpdate.assignedTo === undefined || dataToUpdate.assignedTo === null ? null : dataToUpdate.assignedTo;
          delete updatePayload.assignedTo; 
      }

      if (updatePayload.history && Array.isArray(updatePayload.history)) {
        updatePayload.history = updatePayload.history.map(entry => ({
          ...entry,
          timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : (entry.timestamp instanceof Date ? formatISO(entry.timestamp) : formatISO(new Date()))
        }));
      }
      if (updatePayload.documents && Array.isArray(updatePayload.documents)) {
        updatePayload.documents = updatePayload.documents.map(docEntry => ({
          ...docEntry,
          uploadedAt: typeof docEntry.uploadedAt === 'string' ? docEntry.uploadedAt : (docEntry.uploadedAt ? formatISO(new Date(docEntry.uploadedAt)) : undefined)
        }));
      }
      
      const protectedFields = ['id', 'loanNumber', 'customerNumber', 'submittedDate', 'createdAt'];
      protectedFields.forEach(field => delete updatePayload[field]);
      
      console.log(`[Service:updateLoanRequest] Final update payload for transaction for ID ${id}:`, JSON.stringify(updatePayload, null, 2));
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
            assignedTo: rawData.assignedToUserId || undefined, 
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
        const isActiveBool = versionData.isActive === true; 
        const version: WorkflowVersion = { 
            id: versionDoc.id, 
            workflowDefinitionId: wfDoc.id, 
            ...versionData, 
            isActive: isActiveBool, 
            stages: [] 
        };

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
      if (e.message.toLowerCase().includes("query requires an index") || e.message.toLowerCase().includes("index not found")) {
        errorMessage += " This often means a composite index is required in Firestore. Please check the Firebase console for a link to create the missing index, usually involving fields used in 'orderBy' or 'where' clauses in queries on subcollections.";
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
    const existingQuery = query(collection(db, "workflowDefinitions"), where("loanType", "==", definitionData.loanType));
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      const existingDef = existingSnapshot.docs[0].data();
      return createErrorResult(`A workflow definition for loan type "${definitionData.loanType}" already exists (Name: "${existingDef.name}"). Each loan type can only have one definition container. Add versions to it instead.`, "addWorkflowDefinitionToFirestore");
    }

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
        console.error("[Service:saveWorkflowDefinitions] CRITICAL ERROR: Workflow definition is missing an ID. Definition:", JSON.stringify(definition));
        return createErrorResult(`Workflow definition "${definition.name}" is missing an ID. Cannot save.`);
      }
      console.log(`[Service:saveWorkflowDefinitions] Processing Definition for save: ID ${definitionId}, Name: "${definition.name}", LoanType: "${definition.loanType}"`);

      const defRef = doc(db, "workflowDefinitions", definitionId);
      const { versions, id: _defIdToExclude, createdAt: defCreatedAtFromUI, updatedAt: _defUpdatedAtFromUI, ...defDataFromUI } = definition;
      
      const defPayload: any = { ...defDataFromUI, updatedAt: serverTimestamp() };
      if (defCreatedAtFromUI && typeof defCreatedAtFromUI === 'string') {
        try {
            defPayload.createdAt = Timestamp.fromDate(parseISO(defCreatedAtFromUI));
        } catch (dateParseError) {
            console.warn(`[Service:saveWorkflowDefinitions] Invalid date string for definition ${definitionId} createdAt: ${defCreatedAtFromUI}. Using serverTimestamp instead.`);
            defPayload.createdAt = serverTimestamp(); // Fallback
        }
      } else if(!defPayload.createdAt) { 
        defPayload.createdAt = serverTimestamp(); // Ensure createdAt is set if not provided or invalid
      }


      console.log(`[Service:saveWorkflowDefinitions]   BATCH.SET (Definition) Path: ${defRef.path}, Payload:`, JSON.stringify(defPayload));
      batch.set(defRef, defPayload, { merge: true }); 

      let existingVersionIdsInFirestore = new Set<string>();
      try {
        const versionsSnapshot = await getDocs(collection(defRef, "versions"));
        existingVersionIdsInFirestore = new Set<string>(versionsSnapshot.docs.map(d => d.id));
        console.log(`[Service:saveWorkflowDefinitions]   Found ${existingVersionIdsInFirestore.size} existing versions in Firestore for Def ID ${definitionId}:`, Array.from(existingVersionIdsInFirestore));
      } catch (versionsFetchError: any) {
        console.error(`[Service:saveWorkflowDefinitions]   ERROR fetching existing versions for Def ID ${definitionId}:`, versionsFetchError);
        return createErrorResult(`Failed to fetch existing versions for definition ${definition.name}. Save aborted to prevent data loss. Raw: ${versionsFetchError.message}`, "saveWorkflowDefinitions_fetchVersions", versionsFetchError);
      }
      
      const incomingVersionIdsFromUI = new Set<string>();

      for (const version of versions) {
        const versionId = version.id; 
        if (!versionId) {
          console.error("[Service:saveWorkflowDefinitions]   CRITICAL ERROR: Version is missing an ID. Version:", JSON.stringify(version), "Parent Def:", definition.name);
          return createErrorResult(`Version number "${version.versionNumber}" for definition "${definition.name}" is missing an ID. Cannot save.`);
        }
        incomingVersionIdsFromUI.add(versionId);
        console.log(`[Service:saveWorkflowDefinitions]     Processing Version for save: ID ${versionId}, V${version.versionNumber}, IsActive: ${version.isActive}, Stages: ${version.stages.length}`);

        const versionRef = doc(collection(defRef, "versions"), versionId);
        const { stages, id: _verIdToExclude, workflowDefinitionId: _wfDefIdToExclude, createdAt: verCreatedAtFromUI, updatedAt: _verUpdatedAtFromUI, ...versionDataFromUI } = version;
        
        const versionPayload: any = {...versionDataFromUI, workflowDefinitionId: definitionId, isActive: versionDataFromUI.isActive === true, updatedAt: serverTimestamp() };
        if (verCreatedAtFromUI && typeof verCreatedAtFromUI === 'string') {
             try {
                versionPayload.createdAt = Timestamp.fromDate(parseISO(verCreatedAtFromUI));
            } catch (dateParseError) {
                console.warn(`[Service:saveWorkflowDefinitions] Invalid date string for version ${versionId} createdAt: ${verCreatedAtFromUI}. Using serverTimestamp instead.`);
                versionPayload.createdAt = serverTimestamp(); // Fallback
            }
        } else if (!versionPayload.createdAt) { // Ensure createdAt is set if not provided or invalid
          versionPayload.createdAt = serverTimestamp();
        }
        console.log(`[Service:saveWorkflowDefinitions]       BATCH.SET (Version) Path: ${versionRef.path}, Payload:`, JSON.stringify(versionPayload));
        batch.set(versionRef, versionPayload, { merge: true });

        let existingStageIdsInFirestore = new Set<string>();
        try {
            const stagesSnapshot = await getDocs(collection(versionRef, "stages"));
            existingStageIdsInFirestore = new Set<string>(stagesSnapshot.docs.map(d => d.id));
            console.log(`[Service:saveWorkflowDefinitions]       Found ${existingStageIdsInFirestore.size} existing stages in Firestore for Version ID ${versionId}:`, Array.from(existingStageIdsInFirestore));
        } catch (stagesFetchError: any) {
            console.error(`[Service:saveWorkflowDefinitions]       ERROR fetching existing stages for Version ID ${versionId}:`, stagesFetchError);
            return createErrorResult(`Failed to fetch existing stages for version ${version.versionNumber}. Save aborted. Raw: ${stagesFetchError.message}`, "saveWorkflowDefinitions_fetchStages", stagesFetchError);
        }

        const incomingStageIdsFromUI = new Set<string>();
        for (const stage of stages) {
          const stageId = stage.id; 
          if (!stageId) {
            console.error("[Service:saveWorkflowDefinitions]       CRITICAL ERROR: Stage is missing an ID. Stage:", JSON.stringify(stage), "Parent Version:", version.versionNumber);
            return createErrorResult(`Stage "${stage.name}" for version "${version.versionNumber}" is missing an ID. Cannot save.`);
          }
          incomingStageIdsFromUI.add(stageId);
          console.log(`[Service:saveWorkflowDefinitions]         Processing Stage for save: ID ${stageId}, Name: "${stage.name}", Order: ${stage.order}`);
          
          const stageRef = doc(collection(versionRef, "stages"), stageId);
          const { id: _stageIdToExclude, createdAt: stageCreatedAtFromUI, updatedAt: _stageUpdatedAtFromUI, ...stageDataFromUI } = stage;
          const stagePayload: any = {...stageDataFromUI, updatedAt: serverTimestamp() };
          if(stageCreatedAtFromUI && typeof stageCreatedAtFromUI === 'string') {
             try {
                stagePayload.createdAt = Timestamp.fromDate(parseISO(stageCreatedAtFromUI));
            } catch (dateParseError) {
                console.warn(`[Service:saveWorkflowDefinitions] Invalid date string for stage ${stageId} createdAt: ${stageCreatedAtFromUI}. Using serverTimestamp instead.`);
                stagePayload.createdAt = serverTimestamp(); // Fallback
            }
          } else if (!stagePayload.createdAt) { // Ensure createdAt is set if not provided or invalid
            stagePayload.createdAt = serverTimestamp();
          }
          console.log(`[Service:saveWorkflowDefinitions]           BATCH.SET (Stage) Path: ${stageRef.path}, Payload:`, JSON.stringify(stagePayload));
          batch.set(stageRef, stagePayload, { merge: true });
        }
        
        existingStageIdsInFirestore.forEach(idInFirestore => {
          if (!incomingStageIdsFromUI.has(idInFirestore)) {
            console.log(`[Service:saveWorkflowDefinitions]       BATCH.DELETE (Stage) Path: workflowDefinitions/${definitionId}/versions/${versionId}/stages/${idInFirestore}`);
            batch.delete(doc(collection(versionRef, "stages"), idInFirestore));
          }
        });
      }
      
       existingVersionIdsInFirestore.forEach(idInFirestore => {
        if (!incomingVersionIdsFromUI.has(idInFirestore)) {
          console.log(`[Service:saveWorkflowDefinitions]   BATCH.DELETE (Version) Path: workflowDefinitions/${definitionId}/versions/${idInFirestore}`);
          console.warn(`[Service:saveWorkflowDefinitions]   Note: Deleting version ${idInFirestore}. Its 'stages' subcollection documents will NOT be automatically deleted by this operation alone. Manual cleanup or a Firebase Function would be needed for full subcollection deletion if stages are not empty.`);
          batch.delete(doc(collection(defRef, "versions"), idInFirestore));
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
      const deptName = docSnap.data().name;
      if (typeof deptName === 'string' && deptName.trim() !== '') {
        departments.push({ id: docSnap.id, name: deptName as DepartmentType });
      } else {
        console.warn(`[Service:getDepartments] Document ID ${docSnap.id} in 'departments' collection is missing a valid 'name' field or it's not a string. Data:`, docSnap.data());
      }
    });

    if(departments.length === 0 && !querySnapshot.empty){
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
    const q = query(collection(db, "departments"), where("name_lowercase", "==", departmentName.trim().toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return createErrorResult(`Department "${departmentName.trim()}" already exists.`, "addDepartment");
    }

    const departmentsCollectionRef = collection(db, "departments");
    const newDepartmentDoc = {
      name: departmentName.trim(),
      name_lowercase: departmentName.trim().toLowerCase(), 
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(departmentsCollectionRef, newDepartmentDoc);
    console.log(`[Service:addDepartment] Department "${departmentName.trim()}" added with ID: ${docRef.id}`);
    return { id: docRef.id };
  } catch (e: any) {
    return createErrorResult(`Failed to add department "${departmentName.trim()}".`, "addDepartment", e);
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
  console.log('--- GET AVAILABLE LOAN TYPES FOR WORKFLOW ---');
  const availableTypes = new Set<string>();
  try {
    console.log('[Service:getAvailLoanTypes] FIRESTORE DEBUG: Querying all workflowDefinitions.');
    const wfDefsQuery = query(collection(db, "workflowDefinitions"));
    const wfDefsSnapshot = await getDocs(wfDefsQuery);

    if (wfDefsSnapshot.empty) {
        console.warn("[Service:getAvailLoanTypes] No workflow definitions found in Firestore at all.");
        return { loanTypes: [] };
    }
    console.log(`[Service:getAvailLoanTypes] Found ${wfDefsSnapshot.docs.length} workflow definitions in total.`);

    for (const defDoc of wfDefsSnapshot.docs) {
      const definitionId = defDoc.id;
      const loanType = defDoc.data().loanType as string;
      const defName = defDoc.data().name as string;
      console.log(`[Service:getAvailLoanTypes] Processing Definition: Name "${defName}", ID "${definitionId}", LoanType: "${loanType}"`);

      if (!loanType || typeof loanType !== 'string' || loanType.trim() === '') {
        console.warn(`[Service:getAvailLoanTypes] Workflow definition ${definitionId} ("${defName}") has an invalid or missing loanType field. Skipping.`);
        continue;
      }

      console.log(`[Service:getAvailLoanTypes] FIRESTORE DEBUG: Querying for versions with isActive:true for workflowDefinitions/${definitionId}/versions`);
      const activeVersionsQuery = query(
        collection(db, `workflowDefinitions/${definitionId}/versions`),
        where("isActive", "==", true),
        limit(1) 
      );
      const activeVersionsSnapshot = await getDocs(activeVersionsQuery);

      if (activeVersionsSnapshot.empty) {
        console.log(`[Service:getAvailLoanTypes] No version marked 'isActive:true' found for "${loanType}" (Def ID: ${definitionId}). This loan type will not be available.`);
        continue;
      }
      
      const activeVersionDoc = activeVersionsSnapshot.docs[0];
      const activeVersionId = activeVersionDoc.id;
      const activeVersionNumber = activeVersionDoc.data().versionNumber;
      console.log(`[Service:getAvailLoanTypes] Found ACTIVE version for "${loanType}" (Def ID: ${definitionId}): Version ID ${activeVersionId}, V${activeVersionNumber}. Now checking if it has stages.`);
        
      console.log(`[Service:getAvailLoanTypes] FIRESTORE DEBUG: Querying stages for workflowDefinitions/${definitionId}/versions/${activeVersionId}/stages`);
      const stagesQuery = query(
        collection(db, `workflowDefinitions/${definitionId}/versions/${activeVersionId}/stages`),
        limit(1) 
      );
      const stagesSnapshot = await getDocs(stagesQuery);
      
      if (!stagesSnapshot.empty) {
        console.log(`[Service:getAvailLoanTypes] Loan type "${loanType}" (Def ID: ${definitionId}, Active Version ID: ${activeVersionId}) HAS AN ACTIVE VERSION WITH STAGES. Adding to available list.`);
        availableTypes.add(loanType);
      } else {
        console.warn(`[Service:getAvailLoanTypes] Loan type "${loanType}" (Def ID: ${definitionId}, Active Version ID: ${activeVersionId}) has an active version but NO STAGES defined for it. This loan type will not be available.`);
      }
    }

    const loanTypesArray = Array.from(availableTypes).sort();
    if (loanTypesArray.length === 0) {
        console.warn("[Service:getAvailLoanTypes] FINAL: No loan types with active workflows that also have stages found in Firestore.");
    } else {
        console.log(`[Service:getAvailLoanTypes] FINAL: Returning available types with active workflows (that have stages) from Firestore: ${loanTypesArray.join(', ')}`);
    }
    return { loanTypes: loanTypesArray };
  } catch (e: any) {
    console.error(`[Service:getAvailLoanTypes] FIRESTORE ERROR during operation:`, e);
    let errorMessage = "Failed to fetch available loan types from Firestore.";
    if (e instanceof Error && e.message?.toLowerCase().includes("query requires an index")) {
        errorMessage += " A Firestore index might be missing. Check server logs and Firestore console.";
    }
    return createErrorResult(errorMessage, "getAvailableLoanTypesForWorkflow", e);
  }
}

// --- END OF FILE ---
