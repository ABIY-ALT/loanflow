
'use server';
import type { LoanRequest, User, WorkflowDefinition, WorkflowVersion, WorkflowStageDefinition, Department } from '@/types/loan';
import { UserRole } from '@/types/loan';
// Mock data imports are removed as we transition to Firestore for actual data
// import { mockLoanRequests, mockUsers, mockWorkflowDefinitions, mockDepartments } from '@/lib/mock-data';
import { db } from '@/lib/firebase'; // Assuming firebase.ts is set up
import { collection, getDocs, query, where, orderBy, doc, getDoc, addDoc, updateDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';

import { formatISO, parseISO, addDays, isBefore } from 'date-fns';

// --- Placeholder for actual database interactions ---
// The following mock data arrays would be removed entirely once Firestore is fully integrated.
// For this incremental step, we'll keep them for functions not yet refactored.
import { mockLoanRequests, mockUsers, mockDepartments } from '@/lib/mock-data';
let sessionMockLoanRequests: LoanRequest[] = JSON.parse(JSON.stringify(mockLoanRequests));
// let sessionMockWorkflowDefinitions: WorkflowDefinition[] = JSON.parse(JSON.stringify(mockWorkflowDefinitions)); // Removed, will fetch from Firestore
let sessionMockDepartments: Department[] = JSON.parse(JSON.stringify(mockDepartments));


const createErrorResult = (message: string, context?: string, originalError?: any): { error: string } => {
  let detailedMessage = `Loan Service Error (Context: ${context || 'Unknown'}): ${message}.`;
  if (originalError) {
    detailedMessage += ` Raw: ${ (typeof originalError === 'object' && originalError !== null) ? JSON.stringify(originalError) : String(originalError)}. Name: ${originalError?.name}. Message: ${originalError?.message}. Code: ${originalError?.code}`;
  }
  console.error(`[Service:${context || 'Unknown'}] Error:`, detailedMessage, originalError);
  return { error: detailedMessage };
};

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert Firestore Timestamps to ISO strings in nested objects
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


// Helper to find the currently active WorkflowVersion for a specific loanType from Firestore
const getActiveWorkflowVersionForLoanType = async (loanType: string): Promise<{ workflowDef: WorkflowDefinition, activeVersion: WorkflowVersion, stages: WorkflowStageDefinition[] } | null> => {
  try {
    const wfDefQuery = query(collection(db, "workflowDefinitions"), where("loanType", "==", loanType));
    const wfDefSnapshot = await getDocs(wfDefQuery);

    if (wfDefSnapshot.empty) {
      console.warn(`[Service] No workflow definition found for loan type: ${loanType}`);
      return null;
    }

    // Assuming only one workflow definition per loanType as per design
    const wfDefDoc = wfDefSnapshot.docs[0];
    const wfDefData = convertTimestampsToISO(wfDefDoc.data()) as Omit<WorkflowDefinition, 'id' | 'versions'>;
    
    const workflowDefinition: WorkflowDefinition = {
        id: wfDefDoc.id,
        ...wfDefData,
        versions: [] // Versions will be fetched next
    };

    const versionsQuery = query(
      collection(db, `workflowDefinitions/${wfDefDoc.id}/versions`),
      where("isActive", "==", true),
      orderBy("versionNumber", "desc") // Get latest active if multiple (should not happen ideally)
    );
    const versionsSnapshot = await getDocs(versionsQuery);

    if (versionsSnapshot.empty) {
      console.warn(`[Service] No active version found for workflow: ${workflowDefinition.name} (Loan Type: ${loanType})`);
      return null;
    }
    
    const activeVersionDoc = versionsSnapshot.docs[0]; // Take the first active one
    const activeVersionData = convertTimestampsToISO(activeVersionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages'>;
    const activeVersion: WorkflowVersion = {
        id: activeVersionDoc.id,
        workflowDefinitionId: wfDefDoc.id,
        ...activeVersionData,
        stages: [] // Stages will be fetched next
    };

    const stagesQuery = query(
        collection(db, `workflowDefinitions/${wfDefDoc.id}/versions/${activeVersion.id}/stages`),
        orderBy("order", "asc")
    );
    const stagesSnapshot = await getDocs(stagesQuery);
    const stages: WorkflowStageDefinition[] = stagesSnapshot.docs.map(stageDoc => ({
        id: stageDoc.id,
        ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>)
    }));
    
    activeVersion.stages = stages; // Attach stages to the active version

    return { workflowDef: workflowDefinition, activeVersion, stages };

  } catch (error) {
    console.error(`[Service] Error fetching active workflow for loan type ${loanType}:`, error);
    return null;
  }
};


// Helper to get a specific stage definition by its ID from any workflow version
const getStageDefinitionById = async (workflowDefinitionId: string, workflowVersionId: string, stageId: string): Promise<WorkflowStageDefinition | null> => {
    try {
        const stageDocRef = doc(db, `workflowDefinitions/${workflowDefinitionId}/versions/${workflowVersionId}/stages/${stageId}`);
        const stageDocSnap = await getDoc(stageDocRef);
        if (stageDocSnap.exists()) {
            return { id: stageDocSnap.id, ...convertTimestampsToISO(stageDocSnap.data()) } as WorkflowStageDefinition;
        }
        console.warn(`[Service] Stage with ID ${stageId} not found in version ${workflowVersionId} of workflow ${workflowDefinitionId}.`);
        return null;
    } catch (error) {
         console.error(`[Service] Error fetching stage ${stageId}:`, error);
        return null;
    }
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
  const firstStage = stages.find(s => s.order === 0); // Assumes stages are ordered

  if (!firstStage) {
    return createErrorResult(`First stage (order 0) not found for workflow: ${workflowDef.name} V${activeVersion.versionNumber}.`, "addLoanRequest");
  }

  try {
    const currentDate = new Date();
    const stageDeadlineDate = addDays(currentDate, firstStage.defaultTimelineDays);
    const serverTime = serverTimestamp(); // Use serverTimestamp for Firestore

    const newLoanDocData = {
      customerName: loanData.customerName,
      customerEmail: loanData.customerEmail,
      customerPhone: loanData.customerPhone,
      loanAmount: loanData.loanAmount,
      loanType: loanData.loanType, 
      loanPurpose: loanData.loanPurpose,
      loanNumber: `LN-FS-${String(Date.now()).slice(-5)}`, // Consider more robust generation
      customerNumber: `CUST-FS-${String(Date.now()).slice(-4)}`,
      
      workflowDefinitionId_mirror: workflowDef.id, // Mirror for potential queries
      workflowVersionRef: doc(db, `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}`),
      currentStageRef: doc(db, `workflowDefinitions/${workflowDef.id}/versions/${activeVersion.id}/stages/${firstStage.id}`),
      
      assignedDepartmentName: firstStage.responsibleDepartmentName,
      assignedToUserId: null, 

      submittedDate: serverTime, // Timestamp
      lastUpdatedDate: serverTime, // Timestamp
      stageEntryDate: serverTime, // Timestamp
      stageDeadline: Timestamp.fromDate(stageDeadlineDate), // Convert to Firestore Timestamp
      
      history: [
        {
          id: `hist-fs-${Date.now()}`,
          stageName: firstStage.name,
          timestamp: formatISO(currentDate), // For display, keep ISO in array. Firestore dates are Timestamps.
          userId: 'system-fs-user',
          userName: 'System/User (Firestore)',
          notes: `Loan application submitted. Workflow: ${workflowDef.name} (V${activeVersion.versionNumber}). Initial stage: ${firstStage.name}. Assigned to ${firstStage.responsibleDepartmentName} department.`,
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
  console.log('[Service:getLoanRequests] Called. (Still using MOCK for list view)');
  // THIS FUNCTION STILL USES MOCK DATA. It needs full Firestore implementation.
  // For a full Firestore implementation, you would query the 'loanRequests' collection,
  // resolve references to stages, calculate overdue status, etc.
  try {
    await simulateDelay(50 + Math.random() * 100);

    const processedLoans = await Promise.all(sessionMockLoanRequests.map(async loan => {
      // This part would fetch actual stage data if loan-service was fully on Firestore
      const stageDef = await getStageDefinitionById(loan.workflowDefinitionId, loan.workflowVersionId, loan.currentStageId);
      const stageDeadlineDate = loan.stageDeadline ? parseISO(loan.stageDeadline) : null;
      
      let isTerminalStage = false;
      // This logic would also need to be adapted for Firestore structure
      // const workflowVer = sessionMockWorkflowDefinitions.flatMap(wd => wd.versions).find(v => v.id === loan.workflowVersionId);
      // if (workflowVer && stageDef) {
      //     const stageIndex = workflowVer.stages.findIndex(s => s.id === stageDef.id);
      //     if (stageIndex === workflowVer.stages.length -1) isTerminalStage = true; 
      // }
      if (stageDef?.name.toLowerCase().includes("closed") || stageDef?.name.toLowerCase().includes("rejected") || stageDef?.name.toLowerCase().includes("disbursed") || stageDef?.name.toLowerCase().includes("funded")) {
          isTerminalStage = true;
      }

      const isOverdue = stageDeadlineDate ? isBefore(stageDeadlineDate, new Date()) && !isTerminalStage : false;

      return { 
        ...loan, 
        isOverdue, 
        history: Array.isArray(loan.history) ? loan.history : [], 
        documents: Array.isArray(loan.documents) ? loan.documents : [], 
        assignedDepartment: stageDef?.responsibleDepartmentName || loan.assignedDepartment,
        currentStageName: stageDef?.name || 'Unknown Stage (Mock)',
        isTerminalStage: isTerminalStage,
       };
    }));
    console.log(`[Service:getLoanRequests] Returning ${processedLoans.length} loans (from mock).`);
    return { loans: processedLoans, users: mockUsers };
  } catch (e: any) {
    return createErrorResult("Failed to fetch mock loan requests.", "getLoanRequests", e);
  }
}

export async function getLoanRequestById(id: string): Promise<{ loan?: LoanRequest | null; users?: User[]; error?: string; workflowDefinitions?: WorkflowDefinition[] }> {
   console.log(`[Service:getLoanRequestById] Called for ID ${id}. (Still using MOCK for detail view)`);
  // THIS FUNCTION STILL USES MOCK DATA. Needs full Firestore implementation.
  try {
    await simulateDelay(50 + Math.random() * 50);
    const foundLoanData = sessionMockLoanRequests.find(l => l.id === id);

    if (foundLoanData) {
      const stageDef = await getStageDefinitionById(foundLoanData.workflowDefinitionId, foundLoanData.workflowVersionId, foundLoanData.currentStageId);
      const stageDeadlineDate = foundLoanData.stageDeadline ? parseISO(foundLoanData.stageDeadline) : null;

      let isTerminalStage = false;
      // ... (terminal stage logic adaptation for Firestore)
       if (stageDef?.name.toLowerCase().includes("closed") || stageDef?.name.toLowerCase().includes("rejected") || stageDef?.name.toLowerCase().includes("disbursed") || stageDef?.name.toLowerCase().includes("funded")) {
          isTerminalStage = true;
      }
      const isOverdue = stageDeadlineDate ? isBefore(stageDeadlineDate, new Date()) && !isTerminalStage : false;

      const loan = { 
        ...foundLoanData, 
        isOverdue, 
        history: Array.isArray(foundLoanData.history) ? foundLoanData.history : [], 
        documents: Array.isArray(foundLoanData.documents) ? foundLoanData.documents : [], 
        assignedDepartment: stageDef?.responsibleDepartmentName || foundLoanData.assignedDepartment,
        currentStageName: stageDef?.name || 'Unknown Stage (Mock)',
        isTerminalStage: isTerminalStage,
      };
      const workflows = await getWorkflowDefinitions(); // Fetch from Firestore for settings context
      return { loan, users: mockUsers, workflowDefinitions: workflows.workflows };
    }
    return { loan: null, users: mockUsers, error: `Mock loan with ID "${id}" not found.` };
  } catch (e: any) {
    return createErrorResult(`Failed to fetch mock loan request for ID ${id}.`, `getLoanRequestById-${id}`, e);
  }
}

export async function updateLoanRequest(
  id: string,
  dataToUpdate: Partial<Omit<LoanRequest, 'id'>>
): Promise<{ success?: boolean; updatedLoan?: LoanRequest; error?: string }> {
  console.log(`[Service:updateLoanRequest] Called for ID ${id} with data:`, dataToUpdate, "(Still using MOCK)");
  // THIS FUNCTION STILL USES MOCK DATA. Needs full Firestore implementation.
  // Firestore update would involve:
  // const loanDocRef = doc(db, "loanRequests", id);
  // await updateDoc(loanDocRef, { ...dataToUpdate, lastUpdatedDate: serverTimestamp() });
  // If currentStageRef changes, you'd update stageEntryDate, stageDeadline, assignedDepartmentName, assignedToUserId, isReadyForManagerReview.
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
        lastUpdatedDate: formatISO(new Date()), // Would be serverTimestamp() in Firestore
      };
      
      if (dataToUpdate.currentStageId && dataToUpdate.currentStageId !== originalLoan.currentStageId) {
          const newStageDef = await getStageDefinitionById(updatedLoanData.workflowDefinitionId, updatedLoanData.workflowVersionId, dataToUpdate.currentStageId);
          if (newStageDef) {
              updatedLoanData.assignedDepartment = newStageDef.responsibleDepartmentName;
              updatedLoanData.currentStageName = newStageDef.name;
              updatedLoanData.assignedTo = undefined; 
              updatedLoanData.stageDeadline = formatISO(addDays(new Date(), newStageDef.defaultTimelineDays));
              updatedLoanData.isReadyForManagerReview = false; 
              // updatedLoanData.stageEntryDate = formatISO(new Date()); // Update stage entry time
          } else {
            console.warn(`[Mock Service:updateLoanRequest] Could not find new stage definition for stageId ${dataToUpdate.currentStageId} in version ${updatedLoanData.workflowVersionId}`);
          }
      }

      sessionMockLoanRequests[loanIndex] = updatedLoanData;
      console.log(`[Mock Service:updateLoanRequest] Successfully updated mock loan ID: ${id}.`);
      return { success: true, updatedLoan: updatedLoanData };
    }
    return createErrorResult(`Mock loan with ID "${id}" not found for update.`, "updateLoanRequest");
  } catch (e: any) {
    return createErrorResult(`Failed to update mock loan request for ID ${id}.`, `updateLoanRequest-${id}`, e);
  }
}

export async function getWorkflowDefinitions(): Promise<{ workflows?: WorkflowDefinition[]; error?: string }> {
  try {
    const workflowDefsCollectionRef = collection(db, "workflowDefinitions");
    const q = query(workflowDefsCollectionRef, orderBy("loanType"), orderBy("name")); // Example ordering
    const querySnapshot = await getDocs(q);
    
    const workflows: WorkflowDefinition[] = [];

    for (const wfDoc of querySnapshot.docs) {
      const wfData = convertTimestampsToISO(wfDoc.data()) as Omit<WorkflowDefinition, 'id' | 'versions'>;
      const definition: WorkflowDefinition = {
        id: wfDoc.id,
        ...wfData,
        versions: [],
      };

      const versionsCollectionRef = collection(db, `workflowDefinitions/${wfDoc.id}/versions`);
      const versionsQuery = query(versionsCollectionRef, orderBy("versionNumber", "desc"));
      const versionsSnapshot = await getDocs(versionsQuery);

      for (const versionDoc of versionsSnapshot.docs) {
        const versionData = convertTimestampsToISO(versionDoc.data()) as Omit<WorkflowVersion, 'id' | 'stages' | 'workflowDefinitionId'>;
        const version: WorkflowVersion = {
          id: versionDoc.id,
          workflowDefinitionId: wfDoc.id,
          ...versionData,
          stages: [],
        };

        const stagesCollectionRef = collection(db, `workflowDefinitions/${wfDoc.id}/versions/${versionDoc.id}/stages`);
        const stagesQuery = query(stagesCollectionRef, orderBy("order", "asc"));
        const stagesSnapshot = await getDocs(stagesQuery);
        
        version.stages = stagesSnapshot.docs.map(stageDoc => ({
          id: stageDoc.id,
          ...(convertTimestampsToISO(stageDoc.data()) as Omit<WorkflowStageDefinition, 'id'>)
        }));
        definition.versions.push(version);
      }
      workflows.push(definition);
    }
    
    console.log(`[Service:getWorkflowDefinitions] Fetched ${workflows.length} workflow definitions from Firestore.`);
    return { workflows };
  } catch (e: any) {
    return createErrorResult("Failed to fetch workflow definitions from Firestore.", "getWorkflowDefinitions", e);
  }
}

export async function saveWorkflowDefinitions(definitions: WorkflowDefinition[]): Promise<{ success?: boolean; error?: string }> {
  // This is a complex operation. It needs to handle:
  // - Creating new definitions, versions, stages.
  // - Updating existing ones.
  // - Deleting ones not present in the input (if that's the desired behavior).
  // - Ensuring only one version is active per loanType.
  // This would typically be done in a batch write or a series of transactional operations.
  // The mock implementation used to just overwrite `sessionMockWorkflowDefinitions`.
  // For Firestore, a true save would involve iterating through the input,
  // comparing with existing data, and performing adds/updates/deletes.
  
  const batch = writeBatch(db);

  try {
    // 1. Fetch existing definitions to compare (simplified for this example)
    const existingDefsSnapshot = await getDocs(collection(db, "workflowDefinitions"));
    const existingDefIds = new Set(existingDefsSnapshot.docs.map(d => d.id));

    for (const definition of definitions) {
      const defRef = doc(db, "workflowDefinitions", definition.id); // Use provided ID or generate new
      
      const { versions, ...defData } = definition; // Separate versions from definition data
      const defPayload = {
          ...defData,
          updatedAt: serverTimestamp()
      };
      if (existingDefIds.has(definition.id)) {
          batch.update(defRef, defPayload);
      } else {
          batch.set(defRef, {...defPayload, createdAt: serverTimestamp()});
      }
      existingDefIds.delete(definition.id); // Mark as processed

      // Handle versions
      const existingVersionsSnapshot = await getDocs(collection(defRef, "versions"));
      const existingVersionIds = new Set(existingVersionsSnapshot.docs.map(d => d.id));

      for (const version of versions) {
        const versionRef = doc(collection(defRef, "versions"), version.id); // Use ID or generate
        const { stages, ...versionData } = version;
        const versionPayload = {
            ...versionData,
            workflowDefinitionId: definition.id, // Ensure linkage
            updatedAt: serverTimestamp()
        };
         if (existingVersionIds.has(version.id)) {
            batch.update(versionRef, versionPayload);
        } else {
            batch.set(versionRef, {...versionPayload, createdAt: serverTimestamp()});
        }
        existingVersionIds.delete(version.id);

        // Handle stages
        const existingStagesSnapshot = await getDocs(collection(versionRef, "stages"));
        const existingStageIds = new Set(existingStagesSnapshot.docs.map(d => d.id));

        for (const stage of stages) {
          const stageRef = doc(collection(versionRef, "stages"), stage.id);
          const stagePayload = {
              ...stage,
              // workflowVersionId: version.id, // Not needed if subcollection
              updatedAt: serverTimestamp()
          };
           if (existingStageIds.has(stage.id)) {
                batch.update(stageRef, stagePayload);
            } else {
                batch.set(stageRef, {...stagePayload, createdAt: serverTimestamp()});
            }
            existingStageIds.delete(stage.id);
        }
        // Delete stages not in input
        existingStageIds.forEach(stageIdToDelete => batch.delete(doc(collection(versionRef, "stages"), stageIdToDelete)));
      }
      // Delete versions not in input
      existingVersionIds.forEach(versionIdToDelete => batch.delete(doc(collection(defRef, "versions"), versionIdToDelete)));
    }
    // Delete definitions not in input (use with caution)
    // existingDefIds.forEach(defIdToDelete => batch.delete(doc(db, "workflowDefinitions", defIdToDelete)));

    await batch.commit();
    console.log("[Service:saveWorkflowDefinitions] Workflow definitions batch written to Firestore.");
    return { success: true };
  } catch (e: any) {
    return createErrorResult("Failed to save workflow definitions to Firestore.", "saveWorkflowDefinitions", e);
  }
}


export async function getDepartments(): Promise<{ departments?: Department[]; error?: string }> {
  // For Firestore, you might have a 'departments' collection or manage this list in a config document.
  // Using mock for now.
  try {
    await simulateDelay(10);
    // If using a collection:
    // const deptSnapshot = await getDocs(collection(db, "departments"));
    // const depts = deptSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Department));
    // return { departments: depts.map(d => d.name) }; // Assuming Department type just needs names
    return { departments: JSON.parse(JSON.stringify(sessionMockDepartments)) };
  } catch (e: any) {
    return createErrorResult("Failed to fetch departments.", "getDepartments", e);
  }
}

export async function getAvailableLoanTypesForWorkflow(): Promise<{ loanTypes?: string[]; error?: string }> {
  console.log('[Service:getAvailableLoanTypesForWorkflow] Called.');
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
    console.log(`[Service:getAvailableLoanTypesForWorkflow] Returning available types from Firestore: ${loanTypes.join(', ')}`);
    return { loanTypes };
  } catch (e: any) {
    return createErrorResult("Failed to fetch available loan types for workflow from Firestore.", "getAvailableLoanTypesForWorkflow", e);
  }
}
