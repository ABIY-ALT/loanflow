
'use server';
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition } from '@/types/loan';
// Department type still needed from types/loan
import type { Department as DepartmentType } from '@/types/loan';

import { UserRole } from '@/types/loan';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc, addDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, runTransaction, limit, deleteDoc } from 'firebase/firestore';

import { formatISO, parseISO, addDays, isBefore } from 'date-fns';
import { convertTimestampsToISO } from '@/lib/firestore-utils';

// Mock data imports for users are still present as user management is not yet Firestore-backed
import { mockUsers } from '@/lib/mock-data';

console.log("--- loan-service.ts loaded ---");

const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    const errorDetails = (typeof originalError === 'object' && originalError !== null && typeof originalError.message === 'string') ? originalError.message : String(originalError);
    detailedMessage += ` Raw: ${errorDetails}`;
  }
  console.error(`[Service:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

const getActiveWorkflowVersionForLoanType = async (loanType: string): Promise<{ workflowDef: WorkflowDefinition, activeVersion: WorkflowVersion, stages: WorkflowStageDefinition[] } | null> => {
  console.log(`--- GET ACTIVE WORKFLOW VERSION FOR LOAN TYPE (loanType: "${loanType}") ---`);
  try {
    const wfDefQuery = query(collection(db, "workflowDefinitions"), where("loanType", "==", loanType));
    const wfDefSnapshot = await getDocs(wfDefQuery);

    if (wfDefSnapshot.empty) {
      console.warn(`[Service:getActiveWfVer] No workflow definition found for loan type: "${loanType}"`);
      return null;
    }
    const wfDefDoc = wfDefSnapshot.docs[0];
    const wfDefData = convertTimestampsToISO(wfDefDoc.data()) as Omit<WorkflowDefinition, 'id' | 'versions'>;

    const workflowDefinition: WorkflowDefinition = { id: wfDefDoc.id, ...wfDefData, versions: [] };

    const activeVersionsQuery = query(
      collection(db, `workflowDefinitions/${wfDefDoc.id}/versions`),
      where("isActive", "==", true),
      limit(1)
    );
    const versionsSnapshot = await getDocs(activeVersionsQuery);
    
    if (versionsSnapshot.empty) {
      console.warn(`[Service:getActiveWfVer] No version explicitly marked 'isActive: true' found for Definition ID: ${wfDefDoc.id} (Loan Type: "${loanType}"). This loan type CANNOT BE USED FOR NEW REQUESTS (via getActiveWorkflowVersionForLoanType).`);
      return null; 
    }
    
    const activeVersionDoc = versionsSnapshot.docs[0];
    const activeVersionId = activeVersionDoc.id;
    
    const activeVersionData = convertTimestampsToISO(activeVersionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages' | 'workflowDefinitionId'>;
    const activeVersion: WorkflowVersion = {
        id: activeVersionId,
        workflowDefinitionId: wfDefDoc.id,
        ...activeVersionData,
        stages: [], 
        isActive: true // Ensure this is set based on the query
    };

    const stagesPath = `workflowDefinitions/${wfDefDoc.id}/versions/${activeVersion.id}/stages`;
    const stagesQuery = query(
        collection(db, stagesPath),
        orderBy("order", "asc")
    );
    const stagesSnapshot = await getDocs(stagesQuery);

    if (stagesSnapshot.empty) {
        console.warn(`[Service:getActiveWfVer] FIRESTORE WARNING: The stages query for path "${stagesPath}" (Active Version ID: ${activeVersion.id}) returned an EMPTY snapshot. This active version has no stages.`);
        activeVersion.stages = [];
    } else {
      activeVersion.stages = stagesSnapshot.docs.map(stageDoc => {
          const stageData = { id: stageDoc.id, ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>) };
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


const getStageDefinitionByRef = async (stageRefPath: string, seenObjects: Set<any>): Promise<WorkflowStageDefinition | null> => {
  if (!stageRefPath || typeof stageRefPath !== 'string') {
      return null;
  }
  try {
    const stageDocRef = doc(db, stageRefPath);
    const stageDocSnap = await getDoc(stageDocRef);
    if (stageDocSnap.exists()) {
      // Pass the seenObjects set to convertTimestampsToISO
      return { id: stageDocSnap.id, ...convertTimestampsToISO(stageDocSnap.data(), 0, 15, seenObjects) } as WorkflowStageDefinition;
    }
    return null;
  } catch (error) {
    console.error(`[Service:getStageDefinitionByRef] Error fetching stage by reference ${stageRefPath}:`, error);
    return null;
  }
};

const resolveLoanStageData = async (loanData: any, seenObjects: Set<any>): Promise<Partial<LoanRequest>> => {
  const resolvedData: Partial<LoanRequest> = {};
  const stageRefPath = loanData.currentStageRef?.path;

  if (typeof stageRefPath === 'string' && stageRefPath) {
    // Pass the seenObjects set to getStageDefinitionByRef
    const stageDef = await getStageDefinitionByRef(stageRefPath, seenObjects);
    if (stageDef) {
      resolvedData.currentStageId = stageDef.id;
      resolvedData.currentStageName = stageDef.name;
      resolvedData.assignedDepartment = stageDef.responsibleDepartment;

      const pathSegments = stageRefPath.split('/');
      if (pathSegments.length >= 5) { 
        resolvedData.workflowDefinitionId = pathSegments[1];
        resolvedData.workflowVersionId = pathSegments[3];
      }
      const isTerminal = stageDef.name.toLowerCase().includes("closed") ||
                         stageDef.name.toLowerCase().includes("rejected") ||
                         stageDef.name.toLowerCase().includes("disbursed") ||
                         stageDef.name.toLowerCase().includes("funded");
      resolvedData.isTerminalStage = isTerminal;

      if (loanData.stageDeadline) {
        const deadlineInput = loanData.stageDeadline instanceof Timestamp 
                              ? loanData.stageDeadline.toDate().toISOString() 
                              : (typeof loanData.stageDeadline === 'string' ? loanData.stageDeadline : null);
        if (deadlineInput) {
            try {
                const deadlineDate = parseISO(deadlineInput);
                resolvedData.isOverdue = isBefore(deadlineDate, new Date()) && !isTerminal;
            } catch (e) {
                console.warn(`[Service:resolveLoanStageData] Error parsing stageDeadline "${deadlineInput}":`, e);
                resolvedData.isOverdue = false; 
            }
        } else {
            resolvedData.isOverdue = false; 
        }
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
  const activeWorkflowInfo = await getActiveWorkflowVersionForLoanType(loanData.loanType);

  if (!activeWorkflowInfo) {
    const errorMessage = `Cannot create loan for type "${loanData.loanType}". No properly configured and explicitly ACTIVE workflow version (with stages) found. Please ensure an active version exists with stages defined in Settings, and save all settings.`;
    return createErrorResult(errorMessage, "addLoanRequest");
  }
  
  const { workflowDef, activeVersion, stages } = activeWorkflowInfo;

  if (!stages || stages.length === 0) { 
    // This check is slightly redundant if getActiveWorkflowVersionForLoanType guarantees stages, but good for safety.
    const errorMessage = `Internal Error: Active workflow version V${activeVersion.versionNumber} (ID: ${activeVersion.id}) for loan type "${loanData.loanType}" (Def: "${workflowDef.name}") has no stages defined. Please configure in Settings.`;
    return createErrorResult(errorMessage, "addLoanRequest");
  }

  // Assuming stages are correctly ordered by `getActiveWorkflowVersionForLoanType`
  const firstStage = stages[0];

  if (!firstStage || typeof firstStage.order !== 'number') {
     const errorMessage = `First stage is missing or malformed for active workflow. Loan Type: "${loanData.loanType}", Definition: "${workflowDef.name}" (ID: ${workflowDef.id}), Active Version: V${activeVersion.versionNumber} (ID: ${activeVersion.id}). It has ${stages.length} stages. Expected stages to be ordered correctly.`;
     return createErrorResult(errorMessage, "addLoanRequest");
  }
  
  // Optional: More strict check if you absolutely require order to start at 0.
  // if (firstStage.order !== 0) {
  //    const errorMessage = `Data Integrity Issue: The first stage (Order: ${firstStage.order}, Name: "${firstStage.name}") in the active workflow for "${loanData.loanType}" (Def: "${workflowDef.name}", Ver: V${activeVersion.versionNumber}) does not have order 0. Please correct workflow configuration.`;
  //    return createErrorResult(errorMessage, "addLoanRequest");
  // }


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
    }
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
          timestamp: formatISO(currentDate), // Ensure ISO string for history
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

    return { id: docRef.id };

  } catch (e: any) {
    return createErrorResult(`Failed to add loan request to Firestore.`, "addLoanRequest", e);
  }
}

export async function getLoanRequests(): Promise<{ loans?: LoanRequest[]; error?: string; users?: User[] }> {
  try {
    const loanCollectionRef = collection(db, "loanRequests");
    const q = query(loanCollectionRef, orderBy("lastUpdatedDate", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return { loans: [], users: mockUsers };
    }

    const loansFromFirestore: LoanRequest[] = [];
    for (const loanDoc of querySnapshot.docs) {
      const mainSeenSet = new Set<any>(); // Create a new set for each top-level document
      const rawData = loanDoc.data();
      const fullyConvertedData = convertTimestampsToISO(rawData, 0, 15, mainSeenSet);
      const stageRelatedData = await resolveLoanStageData(rawData, mainSeenSet); // Pass the same set

      const loan: LoanRequest = {
        id: loanDoc.id,
        ...(typeof fullyConvertedData === 'object' && fullyConvertedData !== null ? fullyConvertedData : {}), 
        ...stageRelatedData,
        history: (typeof fullyConvertedData === 'object' && fullyConvertedData !== null && Array.isArray(fullyConvertedData.history)) ? fullyConvertedData.history : [],
        documents: (typeof fullyConvertedData === 'object' && fullyConvertedData !== null && Array.isArray(fullyConvertedData.documents)) ? fullyConvertedData.documents : [],
        assignedTo: rawData.assignedToUserId || undefined, 
      } as LoanRequest;
      loansFromFirestore.push(loan);
    }

    return { loans: loansFromFirestore, users: mockUsers };
  } catch (e: any) {
    return createErrorResult("Failed to fetch loans from Firestore.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; workflowDefinitions?: WorkflowDefinition[] }> {
  try {
    const loanDocRef = doc(db, "loanRequests", id);
    const loanDocSnap = await getDoc(loanDocRef);

    if (loanDocSnap.exists()) {
      const mainSeenSet = new Set<any>(); // Create a new set for this document
      const rawData = loanDocSnap.data();
      const fullyConvertedData = convertTimestampsToISO(rawData, 0, 15, mainSeenSet);
      const stageRelatedData = await resolveLoanStageData(rawData, mainSeenSet); // Pass the same set

      const loan: LoanRequest = {
        id: loanDocSnap.id,
        ...(typeof fullyConvertedData === 'object' && fullyConvertedData !== null ? fullyConvertedData : {}),
        ...stageRelatedData,
        history: (typeof fullyConvertedData === 'object' && fullyConvertedData !== null && Array.isArray(fullyConvertedData.history)) ? fullyConvertedData.history : [],
        documents: (typeof fullyConvertedData === 'object' && fullyConvertedData !== null && Array.isArray(fullyConvertedData.documents)) ? fullyConvertedData.documents : [],
        assignedTo: rawData.assignedToUserId || undefined,
      } as LoanRequest;

      const workflowsResult = await getWorkflowDefinitions();
      return { loan, users: mockUsers, workflowDefinitions: workflowsResult.workflows };
    } else {
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
  const loanDocRef = doc(db, "loanRequests", id);
  try {
    await runTransaction(db, async (transaction) => {
      const loanDoc = await transaction.get(loanDocRef);
      if (!loanDoc.exists()) {
        throw new Error(`Loan with ID "${id}" not found for update.`);
      }

      const currentLoanData = loanDoc.data();
      const updatePayload: { [key: string]: any } = { ...dataToUpdate, lastUpdatedDate: serverTimestamp(), updatedAt: serverTimestamp() };

      // Convert specific date strings to Timestamps if provided
      if (typeof dataToUpdate.submittedDate === 'string') {
        updatePayload.submittedDate = Timestamp.fromDate(parseISO(dataToUpdate.submittedDate));
      } else if (dataToUpdate.submittedDate === null || dataToUpdate.submittedDate === undefined) {
         updatePayload.submittedDate = null; 
      }

      if (typeof dataToUpdate.stageDeadline === 'string') {
        updatePayload.stageDeadline = Timestamp.fromDate(parseISO(dataToUpdate.stageDeadline));
      } else if (dataToUpdate.stageDeadline === null || dataToUpdate.stageDeadline === undefined) {
         updatePayload.stageDeadline = null;
      }
      
      if (typeof dataToUpdate.lastUpdatedDate === 'string') { 
        delete updatePayload.lastUpdatedDate; 
      }


      // Resolve current stage ID from currentLoanData (raw data)
      const mainSeenSetForCurrentData = new Set<any>();
      const resolvedCurrentStageInfo = await resolveLoanStageData(currentLoanData, mainSeenSetForCurrentData);
      const resolvedCurrentStageId = resolvedCurrentStageInfo.currentStageId;

      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== resolvedCurrentStageId) {
          const wfDefId = dataToUpdate.workflowDefinitionId || currentLoanData.workflowDefinitionId_mirror || resolvedCurrentStageInfo.workflowDefinitionId;
          
          let wfVerId = dataToUpdate.workflowVersionId;
          if (!wfVerId) {
            const currentWfVersionRefPath = currentLoanData.workflowVersionRef?.path;
            if (currentWfVersionRefPath && typeof currentWfVersionRefPath === 'string') {
              wfVerId = currentWfVersionRefPath.split('/')[3];
            } else {
                const resolvedWfVerId = resolvedCurrentStageInfo.workflowVersionId;
                if(resolvedWfVerId) wfVerId = resolvedWfVerId;
            }
          }
          
          if(!wfDefId || !wfVerId) {
            throw new Error("Workflow context (DefinitionId or VersionId) missing for stage transition.");
          }

          updatePayload.workflowDefinitionId_mirror = wfDefId; 
          updatePayload.workflowVersionRef = doc(db, `workflowDefinitions/${wfDefId}/versions/${wfVerId}`);
          
          const newStageRefPath = `workflowDefinitions/${wfDefId}/versions/${wfVerId}/stages/${dataToUpdate.currentStageId}`;
          // For getStageDefinitionByRef, we are fetching a new doc, so a new seenSet context starts here.
          const newStageDef = await getStageDefinitionByRef(newStageRefPath, new Set<any>()); 
          if (!newStageDef) {
            throw new Error(`New stage definition not found for path: ${newStageRefPath}. Ensure stage ID "${dataToUpdate.currentStageId}" exists in version "${wfVerId}".`);
          }

          updatePayload.currentStageRef = doc(db, newStageRefPath);
          updatePayload.assignedDepartment = newStageDef.responsibleDepartment;
          // Handle assignedToUserId based on incoming assignedTo
          if (dataToUpdate.hasOwnProperty('assignedTo')) {
            updatePayload.assignedToUserId = (dataToUpdate.assignedTo === undefined || dataToUpdate.assignedTo === null) ? null : dataToUpdate.assignedTo;
          } else {
             // If assignedTo is not in dataToUpdate, but stage changes, it usually implies unassignment or system assignment
             updatePayload.assignedToUserId = null; // Default to unassign when stage changes unless explicitly set
          }
          updatePayload.stageEntryDate = serverTimestamp(); 
          updatePayload.stageDeadline = Timestamp.fromDate(addDays(new Date(), newStageDef.defaultTimelineDays));
          updatePayload.isReadyForManagerReview = false; 

          // Clean up client-side helper fields from payload
          delete updatePayload.currentStageId;
          delete updatePayload.workflowDefinitionId; 
          delete updatePayload.workflowVersionId;
          delete updatePayload.currentStageName; 

      } else if (dataToUpdate.hasOwnProperty('assignedTo')) {
          // Only updating assignment, not stage
          updatePayload.assignedToUserId = (dataToUpdate.assignedTo === undefined || dataToUpdate.assignedTo === null) ? null : dataToUpdate.assignedTo;
      }
      
      if (dataToUpdate.hasOwnProperty('assignedTo')) {
         delete updatePayload.assignedTo; // Remove the temporary 'assignedTo' used for logic
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
      
      const protectedFields = ['id', 'loanNumber', 'customerNumber', 'createdAt']; 
      protectedFields.forEach(field => delete updatePayload[field]);
      
      transaction.update(loanDocRef, updatePayload);
    });

    const updatedDocSnap = await getDoc(loanDocRef);
    if (updatedDocSnap.exists()) {
        const mainSeenSet = new Set<any>(); // New set for processing the updated document
        const rawData = updatedDocSnap.data();
        const fullyConvertedData = convertTimestampsToISO(rawData, 0, 15, mainSeenSet);
        const stageRelatedData = await resolveLoanStageData(rawData, mainSeenSet); // Pass the same set

        const updatedLoanObject: LoanRequest = {
            id: updatedDocSnap.id,
            ...(typeof fullyConvertedData === 'object' && fullyConvertedData !== null ? fullyConvertedData : {}),
            ...stageRelatedData,
            history: (typeof fullyConvertedData === 'object' && fullyConvertedData !== null && Array.isArray(fullyConvertedData.history)) ? fullyConvertedData.history : [],
            documents: (typeof fullyConvertedData === 'object' && fullyConvertedData !== null && Array.isArray(fullyConvertedData.documents)) ? fullyConvertedData.documents : [],
            assignedTo: rawData.assignedToUserId || undefined, 
        } as LoanRequest;
        return { success: true, updatedLoan: updatedLoanObject };
    } else {
        return createErrorResult("Failed to retrieve updated loan after transaction.", `updateLoanRequest-${id}`);
    }

  } catch (e: any) {
    return createErrorResult(`Failed to update loan request for ID ${id} in Firestore.`, `updateLoanRequest-${id}`, e);
  }
}

export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  try {
    const workflowDefsCollectionRef = collection(db, "workflowDefinitions");
    const q = query(workflowDefsCollectionRef, orderBy("loanType")); 

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
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

    return { workflows };
  } catch (e: any) {
    let errorMessage = "Failed to fetch workflow definitions from Firestore.";
     if (e instanceof Error && 'message' in e) { 
      errorMessage += ` Raw: ${e.message}`;
      if (e.message.toLowerCase().includes("query requires an index") || e.message.toLowerCase().includes("index not found")) {
        errorMessage += " This often means a composite index is required in Firestore. Please check the Firebase console for a link to create the missing index, usually involving fields used in 'orderBy' or 'where' clauses in queries on subcollections.";
      }
    }
    return { error: errorMessage };
  }
}

export async function addWorkflowDefinitionToFirestore(
  definitionData: Omit<WorkflowDefinition, 'id' | 'versions' | 'createdAt' | 'updatedAt'>
): Promise<{ id?: string; error?: string }> {
  try {
    const q = query(collection(db, "workflowDefinitions"), where("loanType", "==", definitionData.loanType));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const existingDef = querySnapshot.docs[0].data();
      return createErrorResult(`A workflow definition for loan type "${definitionData.loanType}" already exists (Name: "${existingDef.name}"). Each loan type can only have one definition container. Add versions to it instead.`, "addWorkflowDefinitionToFirestore");
    }

    const workflowDefsCollectionRef = collection(db, "workflowDefinitions");
    const newDefDocData = {
      ...definitionData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(workflowDefsCollectionRef, newDefDocData);
    return { id: docRef.id };
  } catch (e: any) {
    return createErrorResult(`Failed to add workflow definition to Firestore.`, "addWorkflowDefinitionToFirestore", e);
  }
}


export async function saveWorkflowDefinitions(definitions: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  const batch = writeBatch(db);
  try {
    for (const definition of definitions) {
      const definitionId = definition.id; 
      if (!definitionId) {
        console.error(`[Service:saveWfDefs] Workflow definition "${definition.name}" is missing an ID. Skipping save for this definition.`);
        continue; 
      }

      const defRef = doc(db, "workflowDefinitions", definitionId);
      const { versions, id: _defIdToExclude, createdAt: defCreatedAtFromUI, updatedAt: _defUpdatedAtFromUI, ...defDataFromUI } = definition;
      
      const defPayload: any = { ...defDataFromUI, updatedAt: serverTimestamp() };
      if (defCreatedAtFromUI && typeof defCreatedAtFromUI === 'string') {
        try {
            defPayload.createdAt = Timestamp.fromDate(parseISO(defCreatedAtFromUI));
        } catch (dateParseError) {
            console.warn(`[Service:saveWfDefs] Could not parse def createdAt string "${defCreatedAtFromUI}" for ${definitionId}. Using serverTimestamp.`);
            defPayload.createdAt = serverTimestamp(); 
        }
      } else if(!defPayload.createdAt) { 
        const currentDefDoc = await getDoc(defRef); 
        if (!currentDefDoc.exists() || !currentDefDoc.data()?.createdAt) {
          defPayload.createdAt = serverTimestamp();
        } else if (currentDefDoc.exists() && currentDefDoc.data()?.createdAt) {
          defPayload.createdAt = currentDefDoc.data()?.createdAt; 
        }
      }
      batch.set(defRef, defPayload, { merge: true }); 

      let existingVersionIdsInFirestore = new Set<string>();
      try {
        const versionsSnapshot = await getDocs(collection(defRef, "versions"));
        existingVersionIdsInFirestore = new Set<string>(versionsSnapshot.docs.map(d => d.id));
      } catch (versionsFetchError: any) {
        return createErrorResult(`Failed to fetch existing versions for definition ${definition.name} (ID: ${definitionId}). Save aborted. Raw: ${versionsFetchError.message}`, "saveWorkflowDefinitions_fetchVersions", versionsFetchError);
      }
      
      const incomingVersionIdsFromUI = new Set<string>();

      for (const version of versions) {
        const versionId = version.id; 
        if (!versionId) {
          console.error(`[Service:saveWfDefs] Version number "${version.versionNumber}" for def "${definition.name}" (ID: ${definitionId}) is missing its own ID. Skipping this version.`);
          continue;
        }
        incomingVersionIdsFromUI.add(versionId);

        const versionRef = doc(collection(defRef, "versions"), versionId);
        const { stages, id: _verIdToExclude, workflowDefinitionId: _wfDefIdToExcludeFromVersion, createdAt: verCreatedAtFromUI, updatedAt: _verUpdatedAtFromUI, ...versionDataFromUI } = version;
        
        const versionPayload: any = {...versionDataFromUI, workflowDefinitionId: definitionId, isActive: versionDataFromUI.isActive === true, updatedAt: serverTimestamp() };
        if (verCreatedAtFromUI && typeof verCreatedAtFromUI === 'string') {
             try {
                versionPayload.createdAt = Timestamp.fromDate(parseISO(verCreatedAtFromUI));
            } catch (dateParseError) {
                console.warn(`[Service:saveWfDefs] Could not parse version createdAt string "${verCreatedAtFromUI}" for ${versionId}. Using serverTimestamp.`);
                versionPayload.createdAt = serverTimestamp(); 
            }
        } else if (!versionPayload.createdAt) { 
           const currentVerDoc = await getDoc(versionRef);
           if (!currentVerDoc.exists() || !currentVerDoc.data()?.createdAt) {
             versionPayload.createdAt = serverTimestamp();
           } else if (currentVerDoc.exists() && currentVerDoc.data()?.createdAt) {
             versionPayload.createdAt = currentVerDoc.data()?.createdAt; 
           }
        }
        batch.set(versionRef, versionPayload, { merge: true });

        let existingStageIdsInFirestore = new Set<string>();
        try {
            const stagesSnapshot = await getDocs(collection(versionRef, "stages"));
            existingStageIdsInFirestore = new Set<string>(stagesSnapshot.docs.map(d => d.id));
        } catch (stagesFetchError: any)            {
            return createErrorResult(`Failed to fetch existing stages for version ${version.versionNumber} (ID: ${versionId}). Save aborted. Raw: ${stagesFetchError.message}`, "saveWorkflowDefinitions_fetchStages", stagesFetchError);
        }

        const incomingStageIdsFromUI = new Set<string>();
        for (const stage of stages) {
          const stageId = stage.id; 
          if (!stageId) {
            console.error(`[Service:saveWfDefs] Stage "${stage.name}" for version "${version.versionNumber}" (ID: ${versionId}) is missing its own ID. Skipping this stage.`);
            continue;
          }
          incomingStageIdsFromUI.add(stageId);
          
          const stageRef = doc(collection(versionRef, "stages"), stageId);
          const { id: _stageIdToExclude, createdAt: stageCreatedAtFromUI, updatedAt: _stageUpdatedAtFromUI, ...stageDataFromUI } = stage;
          const stagePayload: any = {...stageDataFromUI, updatedAt: serverTimestamp() };
          if(stageCreatedAtFromUI && typeof stageCreatedAtFromUI === 'string') {
             try {
                stagePayload.createdAt = Timestamp.fromDate(parseISO(stageCreatedAtFromUI));
            } catch (dateParseError) {
                console.warn(`[Service:saveWfDefs] Could not parse stage createdAt string "${stageCreatedAtFromUI}" for ${stageId}. Using serverTimestamp.`);
                stagePayload.createdAt = serverTimestamp(); 
            }
          } else if (!stagePayload.createdAt) { 
            const currentStageDoc = await getDoc(stageRef);
            if (!currentStageDoc.exists() || !currentStageDoc.data()?.createdAt) {
              stagePayload.createdAt = serverTimestamp();
            } else if (currentStageDoc.exists() && currentStageDoc.data()?.createdAt) {
                stagePayload.createdAt = currentStageDoc.data()?.createdAt; 
            }
          }
          batch.set(stageRef, stagePayload, { merge: true });
        }
        
        existingStageIdsInFirestore.forEach(idInFirestore => {
          if (!incomingStageIdsFromUI.has(idInFirestore)) {
            const stageToDeleteRef = doc(collection(versionRef, "stages"), idInFirestore);
            batch.delete(stageToDeleteRef);
          }
        });
      }
      
       existingVersionIdsInFirestore.forEach(idInFirestore => {
        if (!incomingVersionIdsFromUI.has(idInFirestore)) {
          const versionToDeleteRef = doc(collection(defRef, "versions"), idInFirestore);
          batch.delete(versionToDeleteRef); 
        }
      });
    }

    await batch.commit();
    return { success: true };
  } catch (e: any) {
    return createErrorResult("Failed to save workflow definitions to Firestore.", "saveWorkflowDefinitions", e);
  }
}

export async function getDepartments(): Promise<{ departments?: {id: string, name: DepartmentType}[]; error?: string }> {
  try {
    const departmentsCollectionRef = collection(db, "departments");
    const q = query(departmentsCollectionRef, orderBy("name")); 
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return { departments: [] };
    }

    const departments: {id: string, name: DepartmentType}[] = [];
    querySnapshot.forEach((docSnap) => {
      const deptData = docSnap.data();
      const deptName = deptData.name;
      if (typeof deptName === 'string' && deptName.trim() !== '') {
        departments.push({ id: docSnap.id, name: deptName as DepartmentType });
      } else {
        console.warn(`[Service:getDepartments] Firestore document ID ${docSnap.id} in 'departments' collection has missing or invalid 'name' field. Data:`, deptData);
      }
    });

    return { departments };
  } catch (e: any) {
    return createErrorResult("Failed to fetch departments from Firestore.", "getDepartments", e);
  }
}

export async function addDepartment(departmentName: string): Promise<{ id?: string; error?: string }> {
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
    return { id: docRef.id };
  } catch (e: any) {
    return createErrorResult(`Failed to add department "${departmentName.trim()}".`, "addDepartment", e);
  }
}

export async function deleteDepartment(departmentId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const departmentDocRef = doc(db, "departments", departmentId);
    await deleteDoc(departmentDocRef);
    return { success: true };
  } catch (e: any) {
    return createErrorResult(`Failed to delete department ID: ${departmentId}.`, "deleteDepartment", e);
  }
}


export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  console.log('--- GET AVAILABLE LOAN TYPES FOR WORKFLOW (SERVICE) ---');
  const availableTypes = new Set<string>();
  try {
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
        
      const stagesQuery = query(
        collection(db, `workflowDefinitions/${definitionId}/versions/${activeVersionId}/stages`),
        limit(1) 
      );
      const stagesSnapshot = await getDocs(stagesQuery);
      
      if (!stagesSnapshot.empty) {
        console.log(`[Service:getAvailLoanTypes] Loan type "${loanType}" (Def ID: ${definitionId}, Active Version ID: ${activeVersionId}) HAS AN ACTIVE VERSION WITH STAGES. Adding to available list.`);
        availableTypes.add(loanType);
      } else {
        console.warn(`[Service:getAvailLoanTypes] Loan type "${loanType}" (Def ID: ${definitionId}, Active Version ID: ${activeVersionId}) has an active version but NO STAGES defined for it. This loan type will not be available for new requests.`);
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
    let errorMessage = "Failed to fetch available loan types from Firestore.";
    if (e instanceof Error && e.message?.toLowerCase().includes("query requires an index")) {
        errorMessage += " A Firestore index might be missing. Check server logs and Firestore console.";
    }
    return createErrorResult(errorMessage, "getAvailableLoanTypesForWorkflow", e);
  }
}

