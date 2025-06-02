
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
      return null;
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
        // Potentially return null or handle as an error depending on desired behavior
    }

    return { workflowDef: workflowDefinition, activeVersion, stages: activeVersion.stages };

  } catch (error) {
    console.error(`[Service:getActiveWorkflowVersionForLoanType] Error fetching active workflow for loan type ${loanType}:`, error);
    return null;
  }
};

const getStageDefinitionByRef = async (stageRef: any): Promise<WorkflowStageDefinition | null> => {
  if (!stageRef || typeof stageRef.path !== 'string') return null;
  try {
    const stageDocSnap = await getDoc(stageRef);
    if (stageDocSnap.exists()) {
      return { id: stageDocSnap.id, ...convertTimestampsToISO(stageDocSnap.data()) } as WorkflowStageDefinition;
    }
    console.warn(`[Service:getStageDefinitionByRef] Stage document not found at path: ${stageRef.path}`);
    return null;
  } catch (error) {
    console.error(`[Service:getStageDefinitionByRef] Error fetching stage by reference ${stageRef.path}:`, error);
    return null;
  }
};

const resolveLoanStageData = async (loanData: any): Promise<Partial<LoanRequest>> => {
  const resolvedData: Partial<LoanRequest> = {};
  if (loanData.currentStageRef && typeof loanData.currentStageRef.path === 'string') {
    const stageDef = await getStageDefinitionByRef(loanData.currentStageRef);
    if (stageDef) {
      resolvedData.currentStageId = stageDef.id;
      resolvedData.currentStageName = stageDef.name;
      resolvedData.assignedDepartment = stageDef.responsibleDepartment;

      // To get workflowDefinitionId and workflowVersionId, we need to traverse up from stageRef
      // stageRef.path is like "workflowDefinitions/DEF_ID/versions/VER_ID/stages/STAGE_ID"
      const pathSegments = loanData.currentStageRef.path.split('/');
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
        const deadline = loanData.stageDeadline instanceof Timestamp ? loanData.stageDeadline.toDate() : parseISO(loanData.stageDeadline);
        resolvedData.isOverdue = isBefore(deadline, new Date()) && !isTerminal;
      } else {
        resolvedData.isOverdue = false;
      }
    } else {
        resolvedData.currentStageName = 'Unknown Stage (Ref Invalid)';
        resolvedData.isOverdue = false;
        resolvedData.isTerminalStage = false;
    }
  } else {
    resolvedData.currentStageName = 'Unknown Stage (No Ref)';
    resolvedData.isOverdue = false;
    resolvedData.isTerminalStage = false;
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
      ...loanData,
      loanNumber: `LN-FS-${String(Date.now()).slice(-6)}`, 
      customerNumber: `CUST-FS-${String(Date.now()).slice(-5)}`,
      
      workflowDefinitionId_mirror: workflowDef.id, 
      workflowVersionRef: doc(db, `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}`),
      currentStageRef: doc(db, `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}/stages/${firstStage.id}`),
      
      assignedDepartment: firstStage.responsibleDepartment,
      assignedTo: null, 

      submittedDate: serverTime, 
      lastUpdatedDate: serverTime, 
      stageEntryDate: serverTime, 
      stageDeadline: Timestamp.fromDate(stageDeadlineDate), 
      
      history: [
        {
          id: `hist-fs-${Date.now()}`,
          stageName: firstStage.name,
          timestamp: formatISO(currentDate), 
          userId: 'system-fs-user',
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
    // Add orderBy if needed, e.g., orderBy("lastUpdatedDate", "desc")
    const q = query(loanCollectionRef, orderBy("lastUpdatedDate", "desc"));
    const querySnapshot = await getDocs(q);

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
      } as LoanRequest;
      loansFromFirestore.push(loan);
    }
    
    console.log(`[Service:getLoanRequests] Fetched ${loansFromFirestore.length} loans from Firestore.`);
    return { loans: loansFromFirestore, users: mockUsers }; // mockUsers still used for assignee names if needed
  } catch (e: any)
  {
    console.error("[Service:getLoanRequests] Firestore error:", e);
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
      } as LoanRequest;

      const workflowsResult = await getWorkflowDefinitions(); // Fetch all workflow defs for settings context
      return { loan, users: mockUsers, workflowDefinitions: workflowsResult.workflows };
    } else {
      console.warn(`[Service:getLoanRequestById] Loan with ID "${id}" not found in Firestore.`);
      return { loan: null, users: mockUsers, error: `Loan with ID "${id}" not found.` };
    }
  } catch (e: any) {
    console.error(`[Service:getLoanRequestById] Firestore error for ID ${id}:`, e);
    return createErrorResult(`Failed to fetch loan request for ID ${id} from Firestore.`, `getLoanRequestById-${id}`, e);
  }
}


export async function updateLoanRequest(
  id: string,
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>>
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
  console.log(`[Service:updateLoanRequest] Called for ID ${id} with data:`, dataToUpdate, "(Still using MOCK for now)");
  // THIS FUNCTION STILL USES MOCK DATA. Needs full Firestore implementation.
  // Firestore update would involve:
  // const loanDocRef = doc(db, "loanRequests", id);
  // const updatePayload = { ...dataToUpdate, lastUpdatedDate: serverTimestamp() };
  // if (dataToUpdate.currentStageId && dataToUpdate.workflowDefinitionId && dataToUpdate.workflowVersionId) {
  //    updatePayload.currentStageRef = doc(db, `workflowDefinitions/${dataToUpdate.workflowDefinitionId}/versions/${dataToUpdate.workflowVersionId}/stages/${dataToUpdate.currentStageId}`);
  //    // also update stageEntryDate, stageDeadline, assignedDepartment, assignedTo=null, isReadyForManagerReview=false etc.
  // }
  // await updateDoc(loanDocRef, updatePayload);
  // Fetch the updated doc and return it.
  
  // Fallback to MOCK for now - TO BE REPLACED
  let sessionMockLoanRequests: LoanRequest[] = []; // Placeholder, as mock data source removed for reads
  try {
    const tempResult = await getLoanRequests(); // This is bad for performance in a real app
    if (tempResult.loans) sessionMockLoanRequests = tempResult.loans;
  } catch (e) { /* ignore, just for mock fallback */ }

   try {
    await simulateDelay(50 + Math.random() * 100);
    const loanIndex = sessionMockLoanRequests.findIndex(l => l.id === id);

    if (loanIndex > -1) {
      const originalLoan = sessionMockLoanRequests[loanIndex];
      
      const updatedLoanData: LoanRequest = {
        ...originalLoan,
        ...dataToUpdate,
        history: dataToUpdate.history ? [...dataToUpdate.history] : [...originalLoan.history],
        documents: dataToUpdate.documents ? [...dataToUpdate.documents] : [...originalLoan.documents],
        lastUpdatedDate: formatISO(new Date()), 
      };
      
      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== originalLoan.currentStageId && updatedLoanData.workflowDefinitionId && updatedLoanData.workflowVersionId) {
          // This mock logic for stage change is highly simplified and needs proper Firestore ref resolution
          // const newStageDef = await getStageDefinitionByRef(...); // Needs a real ref
          // For mock, we'll try to find it in a mock structure if available, or just update name
          updatedLoanData.assignedDepartment = dataToUpdate.assignedDepartment || 'New Dept (Mock)';
          updatedLoanData.currentStageName = 'New Stage (Mock)';
          updatedLoanData.assignedTo = undefined; 
          updatedLoanData.stageDeadline = formatISO(addDays(new Date(), 5)); // Mock deadline
          updatedLoanData.isReadyForManagerReview = false; 
      }

      sessionMockLoanRequests[loanIndex] = updatedLoanData; // This updates a local copy, not persistent
      console.warn(`[Mock Service:updateLoanRequest] Successfully updated MOCK loan ID: ${id}. Data is NOT persistent.`);
      return { success: true, updatedLoan: updatedLoanData };
    }
    return createErrorResult(`MOCK loan with ID "${id}" not found for update.`, "updateLoanRequest-Mock");
  } catch (e: any) {
    return createErrorResult(`Failed to update MOCK loan request for ID ${id}.`, `updateLoanRequest-Mock-${id}`, e);
  }
}

export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  console.log('[Service:getWorkflowDefinitions] Attempting to fetch from Firestore.');
  try {
    const workflowDefsCollectionRef = collection(db, "workflowDefinitions");
    const q = query(workflowDefsCollectionRef, orderBy("loanType"), orderBy("name"));
    const querySnapshot = await getDocs(q);
    
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
    
    if (workflows.length === 0) console.warn("[Service:getWorkflowDefinitions] No workflow definitions found in Firestore.");
    else console.log(`[Service:getWorkflowDefinitions] Fetched ${workflows.length} workflow definitions from Firestore.`);
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
    // Logic to determine existing definitions, versions, stages for deletion (optional, based on strategy)
    // For simplicity, this version focuses on add/update. A more robust version would handle deletions.

    for (const definition of definitions) {
      const defRef = doc(db, "workflowDefinitions", definition.id);
      const { versions, ...defData } = definition;
      batch.set(defRef, { ...defData, updatedAt: serverTimestamp() }, { merge: true }); // Use merge to create if not exists, or update

      for (const version of versions) {
        const versionRef = doc(collection(defRef, "versions"), version.id);
        const { stages, ...versionData } = version;
        batch.set(versionRef, { ...versionData, workflowDefinitionId: definition.id, updatedAt: serverTimestamp() }, { merge: true });

        for (const stage of stages) {
          const stageRef = doc(collection(versionRef, "stages"), stage.id);
          batch.set(stageRef, { ...stage, updatedAt: serverTimestamp() }, { merge: true });
        }
      }
    }

    await batch.commit();
    console.log("[Service:saveWorkflowDefinitions] Workflow definitions batch written to Firestore.");
    return { success: true };
  } catch (e: any) {
    return createErrorResult("Failed to save workflow definitions to Firestore.", "saveWorkflowDefinitions", e);
  }
}

export async function getDepartments(): Promise<{ departments?: Department[]; error?: string }> {
  console.log('[Service:getDepartments] Attempting to fetch from Firestore.');
  try {
    const departmentsCollectionRef = collection(db, "departments");
    const q = query(departmentsCollectionRef, orderBy("name")); // Assuming documents have a 'name' field.
    const querySnapshot = await getDocs(q);

    const departments: Department[] = [];
    querySnapshot.forEach((docSnap) => {
      // Assuming each department document has a 'name' field.
      // And Department type is just `string`.
      const deptName = docSnap.data().name as string;
      if (deptName) {
        departments.push(deptName);
      }
    });
    
    if (departments.length === 0) console.warn("[Service:getDepartments] No departments found in Firestore 'departments' collection or documents lack a 'name' field.");
    else console.log(`[Service:getDepartments] Fetched ${departments.length} departments from Firestore.`);
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

    for (const defDoc of querySnapshot.docs) {
      const definitionId = defDoc.id;
      const loanType = defDoc.data().loanType as string;

      const versionsQuery = query(
        collection(db, `workflowDefinitions/${definitionId}/versions`),
        where("isActive", "==", true)
      );
      const versionsSnapshot = await getDocs(versionsQuery);

      if (!versionsSnapshot.empty && loanType) {
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
