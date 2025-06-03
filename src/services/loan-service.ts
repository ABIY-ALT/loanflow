
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
  console.log(`[Service:getActiveWorkflowVersionForLoanType] Searching for active workflow for loan type: ${loanType}`);
  try {
    const wfDefQuery = query(collection(db, "workflowDefinitions"), where("loanType", "==", loanType));
    const wfDefSnapshot = await getDocs(wfDefQuery);

    if (wfDefSnapshot.empty) {
      console.warn(`[Service:getActiveWorkflowVersionForLoanType] No workflow definition found for loan type: ${loanType}`);
      return null;
    }
    const wfDefDoc = wfDefSnapshot.docs[0];
    const wfDefData = convertTimestampsToISO(wfDefDoc.data()) as Omit<WorkflowDefinition, 'id' | 'versions'>;
    
    const workflowDefinition: WorkflowDefinition = { id: wfDefDoc.id, ...wfDefData, versions: [] };

    const versionsQuery = query(
      collection(db, `workflowDefinitions/${wfDefDoc.id}/versions`),
      where("isActive", "==", true),
      orderBy("versionNumber", "desc"),
      limit(1)
    );
    const versionsSnapshot = await getDocs(versionsQuery);

    let activeVersionDoc;
    if (versionsSnapshot.empty) {
      console.warn(`[Service:getActiveWorkflowVersionForLoanType] No active version explicitly found for workflow: ${workflowDefinition.name} (Loan Type: ${loanType}). Checking for latest version as fallback.`);
      const latestVersionQuery = query(
        collection(db, `workflowDefinitions/${wfDefDoc.id}/versions`),
        orderBy("versionNumber", "desc"),
        limit(1)
      );
      const latestVersionsSnapshot = await getDocs(latestVersionQuery);
      if (latestVersionsSnapshot.empty) {
        console.warn(`[Service:getActiveWorkflowVersionForLoanType] No versions at all found for workflow: ${workflowDefinition.name}`);
        return null;
      }
      activeVersionDoc = latestVersionsSnapshot.docs[0];
      console.warn(`[Service:getActiveWorkflowVersionForLoanType] Fallback: Using latest version V${activeVersionDoc.data().versionNumber} as active for ${loanType}. Consider explicitly activating a version.`);
    } else {
      activeVersionDoc = versionsSnapshot.docs[0];
      console.log(`[Service:getActiveWorkflowVersionForLoanType] Active version V${activeVersionDoc.data().versionNumber} found for ${loanType}.`);
    }
    
    const activeVersionData = convertTimestampsToISO(activeVersionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages' | 'workflowDefinitionId'>;
    const activeVersion: WorkflowVersion = { 
        id: activeVersionDoc.id, 
        workflowDefinitionId: wfDefDoc.id, 
        ...activeVersionData, 
        stages: [],
        isActive: activeVersionData.isActive // Ensure this is carried over, might be true from query or false from fallback
    };

    const stagesQuery = query(
        collection(db, `workflowDefinitions/${wfDefDoc.id}/versions/${activeVersion.id}/stages`),
        orderBy("order", "asc")
    );
    const stagesSnapshot = await getDocs(stagesQuery);
    activeVersion.stages = stagesSnapshot.docs.map(stageDoc => ({
        id: stageDoc.id, ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>)
    }));
    
    if (activeVersion.stages.length === 0) {
        console.warn(`[Service:getActiveWorkflowVersionForLoanType] Version ${activeVersion.id} (V${activeVersion.versionNumber}) for ${loanType} has no stages defined.`);
    }

    return { workflowDef: workflowDefinition, activeVersion, stages: activeVersion.stages };

  } catch (error) {
    console.error(`[Service:getActiveWorkflowVersionForLoanType] Error fetching active workflow for loan type ${loanType}:`, error);
    return null;
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
  const stageRefPath = loanData.currentStageRef?.path || loanData.currentStageRef; // Handle both actual Reference type and string path

  if (typeof stageRefPath === 'string' && stageRefPath) {
    const stageDef = await getStageDefinitionByRef(stageRefPath);
    if (stageDef) {
      resolvedData.currentStageId = stageDef.id;
      resolvedData.currentStageName = stageDef.name;
      resolvedData.assignedDepartment = stageDef.responsibleDepartment;

      const pathSegments = stageRefPath.split('/');
      if (pathSegments.length >= 5) { // Format: workflowDefinitions/DEF_ID/versions/VER_ID/stages/STAGE_ID
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
        console.warn("[Service:resolveLoanStageData] Stage definition not found for ref:", stageRefPath);
    }
  } else {
    resolvedData.currentStageName = 'Unknown Stage (No Valid Ref)';
    resolvedData.isOverdue = false;
    resolvedData.isTerminalStage = false;
    console.warn("[Service:resolveLoanStageData] loanData.currentStageRef is not a valid path string, is not a Reference, or is missing:", loanData.currentStageRef);
  }
  return resolvedData;
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'stageDeadline' | 'assignedTo' | 'isReadyForManagerReview' | 'workflowDefinitionId' | 'workflowVersionId' | 'currentStageId' | 'assignedDepartment' | 'currentStageName' | 'isTerminalStage'>
): Promise<{ id?: string; error?: string }> {
  console.log('[Service:addLoanRequest] Called with data:', loanData);
  
  const activeWorkflowInfo = await getActiveWorkflowVersionForLoanType(loanData.loanType);
  if (!activeWorkflowInfo || activeWorkflowInfo.stages.length === 0) {
    return createErrorResult(`No active workflow version or version has no stages for loan type: ${loanData.loanType}. Configure in settings.`, "addLoanRequest");
  }
  const { workflowDef, activeVersion, stages } = activeWorkflowInfo;
  const firstStage = stages.find(s => s.order === 0); 

  if (!firstStage) {
    return createErrorResult(`First stage (order 0) not found for workflow: ${workflowDef.name} V${activeVersion.versionNumber}.`, "addLoanRequest");
  }

  // Determine manager assignment
  let assignedManagerId: string | null = null;
  let assignedManagerName: string | null = null;
  const firstStageDepartment = firstStage.responsibleDepartment;

  if (firstStageDepartment) {
    const potentialManagersInDept = mockUsers.filter(u => u.department === firstStageDepartment);
    
    let managerToAssign = potentialManagersInDept.find(u => 
        u.name.toLowerCase().includes("manager") && 
        (u.role === UserRole.UNDERWRITER || u.role === UserRole.RELATIONSHIP_MANAGER)
    );

    if (!managerToAssign) {
        managerToAssign = potentialManagersInDept.find(u => u.role === UserRole.UNDERWRITER);
    }
    if (!managerToAssign) {
        managerToAssign = potentialManagersInDept.find(u => u.role === UserRole.RELATIONSHIP_MANAGER);
    }

    if (managerToAssign) {
        assignedManagerId = managerToAssign.id;
        assignedManagerName = managerToAssign.name;
        console.log(`[Service:addLoanRequest] Assigning new loan to: ${assignedManagerName} (ID: ${assignedManagerId}) in department: ${firstStageDepartment}`);
    } else {
        console.log(`[Service:addLoanRequest] No suitable manager found in department: ${firstStageDepartment} based on heuristics. Loan will be initially unassigned to a specific user.`);
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
      ...loanData, // Includes customerBranch if passed
      loanNumber: `LN-FS-${String(Date.now()).slice(-6)}`, 
      customerNumber: `CUST-FS-${String(Date.now()).slice(-5)}`,
      
      workflowDefinitionId_mirror: workflowDef.id, 
      workflowVersionRef: doc(db, `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}`), 
      currentStageRef: doc(db, `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}/stages/${firstStage.id}`), 
      
      assignedDepartment: firstStage.responsibleDepartment, // Set department from stage
      assignedToUserId: assignedManagerId, // Set assigned user ID

      submittedDate: Timestamp.fromDate(currentDate), 
      lastUpdatedDate: serverTimestamp(), 
      stageEntryDate: Timestamp.fromDate(currentDate), 
      stageDeadline: Timestamp.fromDate(stageDeadlineDate), 
      
      history: [
        {
          id: `hist-fs-${Date.now()}`, 
          stageName: firstStage.name,
          timestamp: formatISO(currentDate), 
          userId: assignedManagerId || 'system-fs-user', // Use manager ID if assigned, else system
          userName: assignedManagerName || 'System/User (Firestore)', // Use manager name if assigned
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
        assignedTo: rawData.assignedToUserId,
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
        assignedTo: rawData.assignedToUserId,
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

      // Handle stage transitions specifically
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
          updatePayload.assignedToUserId = dataToUpdate.assignedTo === undefined ? null : dataToUpdate.assignedTo;
          updatePayload.stageEntryDate = serverTimestamp();
          updatePayload.stageDeadline = Timestamp.fromDate(addDays(new Date(), newStageDef.defaultTimelineDays));
          updatePayload.isReadyForManagerReview = false; 
          
          delete updatePayload.currentStageId;
          delete updatePayload.workflowDefinitionId; 
          delete updatePayload.workflowVersionId;
          delete updatePayload.currentStageName; 
       
      } else { // Not a stage change, but other fields might be updated
        if(dataToUpdate.hasOwnProperty('assignedTo')){
            updatePayload.assignedToUserId = dataToUpdate.assignedTo === undefined ? null : dataToUpdate.assignedTo;
            delete updatePayload.assignedTo;
        }
      }
      
      if (dataToUpdate.history && Array.isArray(dataToUpdate.history)) {
        updatePayload.history = dataToUpdate.history;
      }
      if (dataToUpdate.documents && Array.isArray(dataToUpdate.documents)) {
        updatePayload.documents = dataToUpdate.documents;
      }

      const protectedFields = ['id', 'loanNumber', 'customerNumber', 'submittedDate', 'createdAt', 'workflowDefinitionId_mirror', 'workflowVersionRef', 'currentStageRef'];
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
            assignedTo: rawData.assignedToUserId,
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
    const q = query(workflowDefsCollectionRef, orderBy("loanType") /*, orderBy("name") */); 
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        console.warn("[Service:getWorkflowDefinitions] No workflow definitions found in Firestore. This is okay if none are configured yet.");
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
        errorMessage += " Please check Firestore console for index creation link (likely on workflowDefinitions collection, for loanType field).";
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
      console.log("[Service:saveWorkflowDefinitions] Processing Definition for save:", { id: definition.id, name: definition.name, loanType: definition.loanType, createdAt: definition.createdAt });
      if (!definition.id) { 
        console.error("[Service:saveWorkflowDefinitions] Workflow definition missing ID during save all:", definition);
        continue; 
      }
      const defRef = doc(db, "workflowDefinitions", definition.id);
      const { versions, id: defIdToExclude, ...defDataFromUI } = definition; 
      
      const defData = { ...defDataFromUI };
      if (defData.createdAt && typeof defData.createdAt === 'string') {
        // Convert ISO string to Firestore Timestamp if it's an existing date string
        // This scenario might not be common if createdAt is only set by server initially
        // but good for robustness if client somehow holds onto it.
        // For truly new items, definitionData.createdAt would be undefined.
      }


      const dataToSetForDef: any = { ...defData, updatedAt: serverTimestamp() };
      if (!defData.createdAt) { // Only set createdAt if it's not already there (i.e., for new definitions)
        dataToSetForDef.createdAt = serverTimestamp();
      }
      batch.set(defRef, dataToSetForDef, { merge: true }); // merge:true is important

      const existingVersionIdsForDef = new Set<string>();
      const versionsSnapshot = await getDocs(collection(defRef, "versions"));
      versionsSnapshot.forEach(docSnap => existingVersionIdsForDef.add(docSnap.id));
      const incomingVersionIds = new Set<string>();


      for (const version of versions) {
        console.log("[Service:saveWorkflowDefinitions]   Processing Version for save:", { id: version.id, verNum: version.versionNumber, defId: definition.id, isActive: version.isActive, createdAt: version.createdAt });
        if (!version.id) {
            console.error("[Service:saveWorkflowDefinitions] Workflow version missing ID for definition:", definition.id, version);
            continue;
        }
        incomingVersionIds.add(version.id);
        const versionRef = doc(collection(defRef, "versions"), version.id);
        const { stages, id: verIdToExclude, ...versionDataFromUI } = version; 
        
        const versionData = {...versionDataFromUI, workflowDefinitionId: definition.id };
        
        const dataToSetForVersion: any = { ...versionData, updatedAt: serverTimestamp() };
        if(!versionData.createdAt) { // Only set createdAt if not already present
            dataToSetForVersion.createdAt = serverTimestamp();
        }
        batch.set(versionRef, dataToSetForVersion, { merge: true });
        
        const existingStageIdsForVersion = new Set<string>();
        const stagesSnapshot = await getDocs(collection(versionRef, "stages"));
        stagesSnapshot.forEach(docSnap => existingStageIdsForVersion.add(docSnap.id));
        const incomingStageIds = new Set<string>();

        for (const stage of stages) {
          console.log("[Service:saveWorkflowDefinitions]     Processing Stage for save:", { id: stage.id, name: stage.name, order: stage.order, verId: version.id, createdAt: stage.createdAt });
          if (!stage.id) {
            console.error("[Service:saveWorkflowDefinitions] Workflow stage missing ID for version:", version.id, stage);
            continue;
          }
          incomingStageIds.add(stage.id);
          const stageRef = doc(collection(versionRef, "stages"), stage.id);
          const { id: stageIdToExclude, ...stageDataFromUI } = stage; 
          const stageData = {...stageDataFromUI};

          const dataToSetForStage: any = { ...stageData, updatedAt: serverTimestamp() };
           if(!stageData.createdAt){ 
              dataToSetForStage.createdAt = serverTimestamp();
           }
          batch.set(stageRef, dataToSetForStage, { merge: true });
        }
        // Delete stages that were in Firestore but not in the incoming UI data for this version
        existingStageIdsForVersion.forEach(stageId => {
          if (!incomingStageIds.has(stageId)) {
            console.log(`[Service:saveWorkflowDefinitions] DELETING stage ${stageId} from version ${version.id}`);
            batch.delete(doc(collection(versionRef, "stages"), stageId));
          }
        });
      }
       // Delete versions that were in Firestore but not in the incoming UI data for this definition
       existingVersionIdsForDef.forEach(versionId => {
        if (!incomingVersionIds.has(versionId)) {
          console.log(`[Service:saveWorkflowDefinitions] DELETING version ${versionId} and its stages from definition ${definition.id}`);
          // Need to delete stages within this version first if Firestore doesn't do it automatically for subcollections
          // For simplicity here, we'll assume direct version delete also handles subcollections or they are orphaned.
          // Proper way is to recursively delete subcollections.
          batch.delete(doc(collection(defRef, "versions"), versionId));
        }
      });
    }
    
    await batch.commit();
    console.log("[Service:saveWorkflowDefinitions] Workflow definitions batch written to Firestore.");
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
    // Check if department already exists (case-insensitive for robustness)
    const q = query(collection(db, "departments"), where("name_lowercase", "==", departmentName.toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return createErrorResult(`Department "${departmentName}" already exists.`, "addDepartment");
    }

    const departmentsCollectionRef = collection(db, "departments");
    const newDepartmentDoc = {
      name: departmentName,
      name_lowercase: departmentName.toLowerCase(), // For case-insensitive unique checks
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
    // Future check: Query workflowDefinitions to see if this department is used in any WorkflowStageDefinition.
    // If used, either prevent deletion or handle cascading updates/warnings.
    // For now, direct deletion:
    const departmentDocRef = doc(db, "departments", departmentId);
    await deleteDoc(departmentDocRef);
    console.log(`[Service:deleteDepartment] Department ID: ${departmentId} deleted successfully.`);
    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to delete department ID: ${departmentId}.`, "deleteDepartment", e);
  }
}


export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  console.log('[Service:getAvailableLoanTypesForWorkflow] Attempting to fetch from Firestore.');
  try {
    const availableTypes = new Set<string>();
    const q = query(collection(db, "workflowDefinitions")); // No specific ordering needed here
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.warn("[Service:getAvailableLoanTypesForWorkflow] No workflow definitions found at all.");
        return { loanTypes: [] };
    }

    for (const defDoc of querySnapshot.docs) {
      const definitionId = defDoc.id;
      const loanType = defDoc.data().loanType as string;

      if (!loanType) {
        console.warn(`[Service:getAvailableLoanTypesForWorkflow] Workflow definition ${definitionId} is missing loanType field.`);
        continue;
      }

      // Check if this loanType definition has at least one active version
      const versionsQuery = query(
        collection(db, `workflowDefinitions/${definitionId}/versions`),
        where("isActive", "==", true),
        limit(1) // We only need to know if at least one active version exists
      );
      const versionsSnapshot = await getDocs(versionsQuery);

      if (!versionsSnapshot.empty) {
        // This loan type has at least one active version, so it's available
        availableTypes.add(loanType);
      } else {
        console.log(`[Service:getAvailableLoanTypesForWorkflow] Loan type "${loanType}" (Def ID: ${definitionId}) has no active versions. Not including in available list.`);
      }
    }
    
    const loanTypesArray = Array.from(availableTypes).sort();
    if (loanTypesArray.length === 0) {
        console.warn("[Service:getAvailableLoanTypesForWorkflow] No loan types with *active* workflows found in Firestore after checking versions.");
    } else {
        console.log(`[Service:getAvailableLoanTypesForWorkflow] Returning available types with active workflows from Firestore: ${loanTypesArray.join(', ')}`);
    }
    return { loanTypes: loanTypesArray };
  } catch (e: any)
{
    return createErrorResult("Failed to fetch available loan types for workflow from Firestore.", "getAvailableLoanTypesForWorkflow", e);
  }
}

