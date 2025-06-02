
'use server';
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department } from '@/types/loan';
import { UserRole } from '@/types/loan';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, query, where, orderBy, doc, getDoc, addDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, runTransaction } from 'firebase/firestore';

import { formatISO, parseISO, addDays, isBefore, subDays } from 'date-fns';

// Mock data imports for users are still present as user management is not yet Firestore-backed
import { mockUsers } from '@/lib/mock-data'; 
// No more mock data for loans, workflows, or departments for read operations if Firestore is used.

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    const errorDetails = (typeof originalError === 'object' && originalError !== null) ? JSON.stringify(originalError, Object.getOwnPropertyNames(originalError)) : String(originalError);
    detailedMessage += ` Raw: ${errorDetails}`;
  }
  console.error(`[Service:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      orderBy("versionNumber", "desc")
    );
    const versionsSnapshot = await getDocs(versionsQuery);

    if (versionsSnapshot.empty) {
      console.warn(`[Service:getActiveWorkflowVersionForLoanType] No active version found for workflow: ${workflowDefinition.name} (Loan Type: ${loanType})`);
      // Attempt to get the latest version if no active one is found
      const latestVersionQuery = query(
        collection(db, `workflowDefinitions/${wfDefDoc.id}/versions`),
        orderBy("versionNumber", "desc"),
        // limit(1) // If you use limit, ensure you handle the snapshot correctly
      );
      const latestVersionsSnapshot = await getDocs(latestVersionQuery);
      if (latestVersionsSnapshot.empty) {
        console.warn(`[Service:getActiveWorkflowVersionForLoanType] No versions at all found for workflow: ${workflowDefinition.name}`);
        return null;
      }
      // If you use limit(1), it would be latestVersionsSnapshot.docs[0]
      // Without limit, you might need to sort client-side if not already sorted by versionNumber or pick the first one after sorting
      const latestVersionDoc = latestVersionsSnapshot.docs[0]; // Assuming latest by descending order
      if(!latestVersionDoc) {
        console.warn(`[Service:getActiveWorkflowVersionForLoanType] Could not determine latest version for ${loanType}`);
        return null;
      }
      console.warn(`[Service:getActiveWorkflowVersionForLoanType] No active version, falling back to latest version for ${loanType}: V${latestVersionDoc.data().versionNumber}`);
      const latestVersionData = convertTimestampsToISO(latestVersionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages'>;
      const latestVersionAsActive: WorkflowVersion = { id: latestVersionDoc.id, workflowDefinitionId: wfDefDoc.id, ...latestVersionData, stages: [], isActive: true /* Treat as active for this operation */ };
      
      const stagesQueryFallback = query(
          collection(db, `workflowDefinitions/${wfDefDoc.id}/versions/${latestVersionAsActive.id}/stages`),
          orderBy("order", "asc")
      );
      const stagesSnapshotFallback = await getDocs(stagesQueryFallback);
      latestVersionAsActive.stages = stagesSnapshotFallback.docs.map(stageDoc => ({
          id: stageDoc.id, ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>)
      }));

      if (latestVersionAsActive.stages.length === 0) {
          console.warn(`[Service:getActiveWorkflowVersionForLoanType] Fallback latest version ${latestVersionAsActive.id} for ${loanType} has no stages defined.`);
      }
      return { workflowDef: workflowDefinition, activeVersion: latestVersionAsActive, stages: latestVersionAsActive.stages };
    }
    
    const activeVersionDoc = versionsSnapshot.docs[0];
    const activeVersionData = convertTimestampsToISO(activeVersionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages'>;
    const activeVersion: WorkflowVersion = { id: activeVersionDoc.id, workflowDefinitionId: wfDefDoc.id, ...activeVersionData, stages: [] };

    const stagesQuery = query(
        collection(db, `workflowDefinitions/${wfDefDoc.id}/versions/${activeVersion.id}/stages`),
        orderBy("order", "asc")
    );
    const stagesSnapshot = await getDocs(stagesQuery);
    activeVersion.stages = stagesSnapshot.docs.map(stageDoc => ({
        id: stageDoc.id, ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>)
    }));
    
    if (activeVersion.stages.length === 0) {
        console.warn(`[Service:getActiveWorkflowVersionForLoanType] Active version ${activeVersion.id} for ${loanType} has no stages defined.`);
    }

    return { workflowDef: workflowDefinition, activeVersion, stages: activeVersion.stages };

  } catch (error) {
    console.error(`[Service:getActiveWorkflowVersionForLoanType] Error fetching active workflow for loan type ${loanType}:`, error);
    return null;
  }
};

const getStageDefinitionByRef = async (stageRefPath: string): Promise<WorkflowStageDefinition | null> => {
  // stageRefPath will be the full path string e.g. "workflowDefinitions/DEF_ID/versions/VER_ID/stages/STAGE_ID"
  if (!stageRefPath || typeof stageRefPath !== 'string') return null;
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
  // In Firestore, references are stored as objects with a path property, or just the path string.
  // Let's assume loanData.currentStageRef is the *path string* to the stage document.
  const stageRefPath = loanData.currentStageRef; 

  if (typeof stageRefPath === 'string' && stageRefPath) {
    const stageDef = await getStageDefinitionByRef(stageRefPath);
    if (stageDef) {
      resolvedData.currentStageId = stageDef.id;
      resolvedData.currentStageName = stageDef.name;
      resolvedData.assignedDepartment = stageDef.responsibleDepartment;

      const pathSegments = stageRefPath.split('/');
      if (pathSegments.length >= 5) {
        resolvedData.workflowDefinitionId = pathSegments[1]; // e.g., "workflowDefinitions" is 0, ID is 1
        resolvedData.workflowVersionId = pathSegments[3]; // e.g., "versions" is 2, ID is 3
      } else {
        console.warn("[Service:resolveLoanStageData] Could not parse workflowDefinitionId/VersionId from stageRefPath:", stageRefPath);
      }
      const isTerminal = stageDef.name.toLowerCase().includes("closed") || 
                         stageDef.name.toLowerCase().includes("rejected") || 
                         stageDef.name.toLowerCase().includes("disbursed") ||
                         stageDef.name.toLowerCase().includes("funded");
      resolvedData.isTerminalStage = isTerminal;
      if (loanData.stageDeadline) {
        const deadline = loanData.stageDeadline instanceof Timestamp ? loanData.stageDeadline.toDate() : parseISO(loanData.stageDeadline);
        resolvedData.isOverdue = isBefore(deadline, new Date()) && !isTerminal;
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
    console.warn("[Service:resolveLoanStageData] loanData.currentStageRef is not a valid path string:", loanData.currentStageRef);
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

  try {
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);
    const serverTime = serverTimestamp(); 

    const newLoanDocData = {
      ...loanData, // customerName, customerEmail, etc.
      loanNumber: `LN-FS-${String(Date.now()).slice(-6)}`, 
      customerNumber: `CUST-FS-${String(Date.now()).slice(-5)}`,
      
      workflowDefinitionId_mirror: workflowDef.id, 
      // Store full paths for references
      workflowVersionRef: `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}`,
      currentStageRef: `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}/stages/${firstStage.id}`,
      
      assignedDepartment: firstStage.responsibleDepartment,
      assignedToUserId: null, // Firestore typically uses null for empty fields

      submittedDate: Timestamp.fromDate(currentDate), // Use client date for submission, or serverTimestamp()
      lastUpdatedDate: serverTime, 
      stageEntryDate: Timestamp.fromDate(currentDate), 
      stageDeadline: Timestamp.fromDate(stageDeadlineDate), 
      
      history: [
        {
          id: `hist-fs-${Date.now()}`, // Consider UUIDs
          stageName: firstStage.name,
          timestamp: formatISO(currentDate), 
          userId: 'system-fs-user', // Or current authenticated user ID
          userName: 'System/User (Firestore)',
          notes: `Loan application submitted. Workflow: ${workflowDef.name} (V${activeVersion.versionNumber}). Initial stage: ${firstStage.name}. Assigned to ${firstStage.responsibleDepartment} department.`,
        },
      ],
      documents: [],
      isReadyForManagerReview: false,
      createdAt: serverTime,
      updatedAt: serverTime,
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
        ...convertTimestampsToISO(rawData), // Converts Timestamps to ISO strings
        ...stageRelatedData, // Adds currentStageId, currentStageName, etc.
        history: Array.isArray(rawData.history) ? convertTimestampsToISO(rawData.history) : [],
        documents: Array.isArray(rawData.documents) ? convertTimestampsToISO(rawData.documents) : [],
        assignedTo: rawData.assignedToUserId, // Map from assignedToUserId
      } as LoanRequest; // Assert type carefully
      loansFromFirestore.push(loan);
    }
    
    console.log(`[Service:getLoanRequests] Fetched ${loansFromFirestore.length} loans from Firestore.`);
    return { loans: loansFromFirestore, users: mockUsers }; 
  } catch (e: any) {
    console.error("[Service:getLoanRequests] Firestore error:", e);
    // Return an error object, do not fall back to mocks.
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
      // Return error, do not fall back to mocks.
      return { loan: null, users: mockUsers, error: `Loan with ID "${id}" not found.` };
    }
  } catch (e: any) {
    console.error(`[Service:getLoanRequestById] Firestore error for ID ${id}:`, e);
    // Return an error object.
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

      const currentLoanData = loanDoc.data() as LoanRequest; // Assume this matches our type for now
      const updatePayload: { [key: string]: any } = { ...dataToUpdate, lastUpdatedDate: serverTimestamp() };

      // Handle stage transitions specifically
      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== (await resolveLoanStageData(currentLoanData)).currentStageId) {
        if (!dataToUpdate.workflowDefinitionId || !dataToUpdate.workflowVersionId) {
          throw new Error("workflowDefinitionId and workflowVersionId are required when changing stage.");
        }
        const newStageRefPath = `workflowDefinitions/${dataToUpdate.workflowDefinitionId}/versions/${dataToUpdate.workflowVersionId}/stages/${dataToUpdate.currentStageId}`;
        const newStageDef = await getStageDefinitionByRef(newStageRefPath);
        if (!newStageDef) {
          throw new Error(`New stage definition not found for path: ${newStageRefPath}`);
        }
        updatePayload.currentStageRef = newStageRefPath;
        updatePayload.assignedDepartment = newStageDef.responsibleDepartment;
        updatePayload.assignedToUserId = dataToUpdate.assignedTo === undefined ? null : dataToUpdate.assignedTo; // Handle unassignment
        updatePayload.stageEntryDate = serverTimestamp();
        updatePayload.stageDeadline = Timestamp.fromDate(addDays(new Date(), newStageDef.defaultTimelineDays));
        updatePayload.isReadyForManagerReview = false; // Reset review status on stage change
        // Remove fields that should not be directly in dataToUpdate when changing stage
        delete updatePayload.currentStageId;
        delete updatePayload.workflowDefinitionId; 
        delete updatePayload.workflowVersionId;
        delete updatePayload.currentStageName; // This will be resolved on read
      } else {
         // If not changing stage, still handle assignedTo mapping
        if(dataToUpdate.hasOwnProperty('assignedTo')){
            updatePayload.assignedToUserId = dataToUpdate.assignedTo === undefined ? null : dataToUpdate.assignedTo;
            delete updatePayload.assignedTo;
        }
      }
      
      // Ensure history and documents are treated as arrays
      if (dataToUpdate.history && !Array.isArray(dataToUpdate.history)) {
        updatePayload.history = [dataToUpdate.history]; // Ensure it's an array
      }
      if (dataToUpdate.documents && !Array.isArray(dataToUpdate.documents)) {
        updatePayload.documents = [dataToUpdate.documents]; // Ensure it's an array
      }


      transaction.update(loanDocRef, updatePayload);
    });

    // Fetch the updated document to return it
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
        // Should not happen if transaction succeeded
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
    // Temporarily simplify query if index is an issue. Ideal: orderBy("loanType"), orderBy("name")
    const q = query(workflowDefsCollectionRef, orderBy("loanType") /*, orderBy("name") */); 
    console.log("[Service:getWorkflowDefinitions] Query constructed. Ensure composite index (loanType ASC, name ASC) exists if both orderBy are used.");

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
    console.error("[Service:getWorkflowDefinitions] Firestore error:", e);
    return createErrorResult("Failed to fetch workflow definitions from Firestore.", "getWorkflowDefinitions", e);
  }
}

export async function saveWorkflowDefinitions(definitions: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  console.log("[Service:saveWorkflowDefinitions] Attempting to save to Firestore:", definitions);
  const batch = writeBatch(db);
  try {
    // Existing definitions in Firestore (to handle deletions - optional advanced logic)
    // const existingDefsSnapshot = await getDocs(collection(db, "workflowDefinitions"));
    // const existingDefIds = new Set(existingDefsSnapshot.docs.map(doc => doc.id));
    // const incomingDefIds = new Set(definitions.map(def => def.id));

    for (const definition of definitions) {
      if (!definition.id) { // Should not happen if frontend assigns IDs
        console.error("[Service:saveWorkflowDefinitions] Workflow definition missing ID:", definition);
        continue;
      }
      const defRef = doc(db, "workflowDefinitions", definition.id);
      const { versions, ...defData } = definition;
      // Add/update definition
      batch.set(defRef, { ...defData, createdAt: defData.createdAt || serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });

      const existingVersionIdsForDef = new Set<string>();
      if (versions.length > 0) { // Only query existing if there are incoming versions
          const existingVersionsSnapshot = await getDocs(collection(defRef, "versions"));
          existingVersionsSnapshot.forEach(doc => existingVersionIdsForDef.add(doc.id));
      }
      const incomingVersionIds = new Set(versions.map(v => v.id));


      for (const version of versions) {
        if (!version.id) {
            console.error("[Service:saveWorkflowDefinitions] Workflow version missing ID for definition:", definition.id, version);
            continue;
        }
        const versionRef = doc(collection(defRef, "versions"), version.id);
        const { stages, ...versionData } = version;
        // Add/update version
        batch.set(versionRef, { ...versionData, workflowDefinitionId: definition.id, createdAt: versionData.createdAt || serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        
        const existingStageIdsForVersion = new Set<string>();
        if (stages.length > 0) { // Only query existing if there are incoming stages
            const existingStagesSnapshot = await getDocs(collection(versionRef, "stages"));
            existingStagesSnapshot.forEach(doc => existingStageIdsForVersion.add(doc.id));
        }
        const incomingStageIds = new Set(stages.map(s => s.id));

        for (const stage of stages) {
          if (!stage.id) {
            console.error("[Service:saveWorkflowDefinitions] Workflow stage missing ID for version:", version.id, stage);
            continue;
          }
          const stageRef = doc(collection(versionRef, "stages"), stage.id);
          // Add/update stage
          batch.set(stageRef, { ...stage, createdAt: stage.createdAt || serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        }
        // Delete stages not in incoming for this version
        // existingStageIdsForVersion.forEach(stageId => {
        //   if (!incomingStageIds.has(stageId)) {
        //     batch.delete(doc(collection(versionRef, "stages"), stageId));
        //   }
        // });
      }
      // Delete versions not in incoming for this definition
      // existingVersionIdsForDef.forEach(versionId => {
      //   if (!incomingVersionIds.has(versionId)) {
      //     batch.delete(doc(collection(defRef, "versions"), versionId));
      //   }
      // });
    }
    
    // Delete definitions not in incoming
    // existingDefIds.forEach(defId => {
    //   if (!incomingDefIds.has(defId)) {
    //     batch.delete(doc(db, "workflowDefinitions", defId));
    //   }
    // });

    await batch.commit();
    console.log("[Service:saveWorkflowDefinitions] Workflow definitions batch written to Firestore.");
    return { success: true };
  } catch (e: any) {
    console.error("[Service:saveWorkflowDefinitions] Firestore error during batch write:", e);
    return createErrorResult("Failed to save workflow definitions to Firestore.", "saveWorkflowDefinitions", e);
  }
}

export async function getDepartments(): Promise<{ departments?: Department[]; error?: string }> {
  console.log('[Service:getDepartments] Attempting to fetch from Firestore.');
  try {
    const departmentsCollectionRef = collection(db, "departments");
    const q = query(departmentsCollectionRef, orderBy("name")); 
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.warn("[Service:getDepartments] No departments found in Firestore 'departments' collection. This might be expected if none are configured.");
        return { departments: [] }; // Return empty array if none found
    }

    const departments: Department[] = [];
    querySnapshot.forEach((docSnap) => {
      const deptName = docSnap.data().name as string;
      if (deptName) {
        departments.push(deptName);
      } else {
        console.warn(`[Service:getDepartments] Document ID ${docSnap.id} in 'departments' collection is missing a 'name' field.`);
      }
    });
    
    console.log(`[Service:getDepartments] Fetched ${departments.length} departments from Firestore.`);
    return { departments };
  } catch (e: any) {
    console.error("[Service:getDepartments] Firestore error:", e);
    return createErrorResult("Failed to fetch departments from Firestore.", "getDepartments", e);
  }
}

export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  console.log('[Service:getAvailableLoanTypesForWorkflow] Attempting to fetch from Firestore.');
  try {
    const availableTypes = new Set<string>();
    const q = query(collection(db, "workflowDefinitions"));
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

      const versionsQuery = query(
        collection(db, `workflowDefinitions/${definitionId}/versions`),
        where("isActive", "==", true)
      );
      const versionsSnapshot = await getDocs(versionsQuery);

      if (!versionsSnapshot.empty) {
        availableTypes.add(loanType);
      }
    }
    
    const loanTypes = Array.from(availableTypes).sort();
    if (loanTypes.length === 0) console.warn("[Service:getAvailableLoanTypesForWorkflow] No loan types with active workflows found in Firestore.");
    else console.log(`[Service:getAvailableLoanTypesForWorkflow] Returning available types from Firestore: ${loanTypes.join(', ')}`);
    return { loanTypes };
  } catch (e: any) {
    console.error("[Service:getAvailableLoanTypesForWorkflow] Firestore error:", e);
    return createErrorResult("Failed to fetch available loan types for workflow from Firestore.", "getAvailableLoanTypesForWorkflow", e);
  }
}
