
'use server';
import type { LoanRequest } from '@/types/loan';
import { LoanStage } from '@/types/loan';
import { db } from '@/lib/firebase'; // Firestore instance
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { formatISO } from 'date-fns';

const LOAN_REQUESTS_COLLECTION = 'loanRequests';

// Consistent error object creation
const createErrorResult = (message: string, originalError?: unknown, context?: string) => {
  let detailedMessage = message;
  if (originalError instanceof Error) {
    const firebaseError = originalError as any; 
    detailedMessage = `${message} (Firebase Error: Name: ${firebaseError.name || 'N/A'}, Code: ${firebaseError.code || 'N/A'}, Message: ${firebaseError.message})`;
    if (firebaseError.details) {
      detailedMessage += `, Details: ${firebaseError.details}`;
    }
  } else if (typeof originalError === 'string') {
    detailedMessage = `${message} (Details: ${originalError})`;
  } else if (originalError) {
    try {
      detailedMessage = `${message} (Unknown error type: ${JSON.stringify(originalError)})`;
    } catch (e) {
      detailedMessage = `${message} (Unknown error type and could not stringify error: ${String(originalError)})`;
    }
  }
  
  console.error(`Loan Service Error Encountered on Server (Context: ${context || 'General'}):`, detailedMessage, "\nFull Original Error Object (if any):", originalError);
  
  // For addLoanRequest, return a very simple error string to ensure serializability
  if (context === 'addLoanRequest') {
    return { error: `Failed to add loan request. Server Details: ${message} - See server logs for more.` };
  }
  return { error: detailedMessage }; 
};


const mapTimestampsInDoc = (data: any): any => {
  if (!data) return data;
  const mappedData = { ...data };
  for (const key in mappedData) {
    if (mappedData[key] instanceof Timestamp) {
      mappedData[key] = mappedData[key].toDate().toISOString();
    } else if (Array.isArray(mappedData[key])) {
      mappedData[key] = mappedData[key].map(item => 
        (item instanceof Timestamp) ? item.toDate().toISOString() :
        (typeof item === 'object' && item !== null && !(item instanceof Date)) ? mapTimestampsInDoc(item) : item
      );
    } else if (typeof mappedData[key] === 'object' && mappedData[key] !== null && !(mappedData[key] instanceof Date)) {
      // Only recurse if it's a plain object, not other complex objects.
      if (Object.prototype.toString.call(mappedData[key]) === '[object Object]') {
        // mappedData[key] = mapTimestampsInDoc(mappedData[key]); // Avoid deep recursion for now on nested non-Timestamp objects
      }
    }
  }
  return mappedData;
};

const prepareDataForFirestoreWrite = (data: any): any => {
    if (data === undefined || data === null) return data;

    if (data instanceof Date) {
        return formatISO(data); // Convert Date to ISO string
    }
     if (data instanceof Timestamp) { 
        // This case should ideally not be hit if we are creating data from JS Dates
        console.warn("Firestore Timestamp object found in data being prepared for write. Converting to ISO string.", data);
        return data.toDate().toISOString(); 
    }

    if (Array.isArray(data)) {
        return data.map(item => prepareDataForFirestoreWrite(item));
    }

    if (typeof data === 'object' && Object.prototype.toString.call(data) === '[object Object]') {
        const res: { [key: string]: any } = {};
        for (const key of Object.keys(data)) {
            res[key] = prepareDataForFirestoreWrite(data[key]);
        }
        return res;
    }
    return data;
};


interface AddLoanRequestResult {
  id?: string;
  error?: string;
}

export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'assignedTo' | 'stageDeadline'>
): Promise<AddLoanRequestResult> {
  console.log("[Service:addLoanRequest] Initiated.");
  if (!db) {
    console.error("[Service:addLoanRequest] Firestore database (db) is not initialized.");
    return createErrorResult("Firestore database is not initialized. Cannot add loan request.", undefined, 'addLoanRequest');
  }
  try {
    const currentDate = new Date(); 
    const newLoanDataBase = {
      ...loanData,
      loanNumber: `LN-${String(Date.now()).slice(-6)}`,
      customerNumber: `CUST-${String(Date.now()).slice(-5)}`,
      currentStage: LoanStage.APPLICATION_SUBMITTED,
      submittedDate: currentDate, 
      lastUpdatedDate: currentDate, 
      documents: [], 
      history: [
        {
          id: `hist-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: currentDate, 
          userId: 'system-entry',
          userName: 'System',
          notes: 'Loan application submitted.',
        },
      ],
      isOverdue: false,
      stageDeadline: null, // Default to null or calculate based on settings
    };

    console.log("[Service:addLoanRequest] Data before preparing for Firestore:", JSON.stringify(newLoanDataBase, null, 2));
    const preparedLoanData = prepareDataForFirestoreWrite(newLoanDataBase);
    console.log("[Service:addLoanRequest] Data prepared for Firestore:", JSON.stringify(preparedLoanData, null, 2));

    const docRef = await addDoc(collection(db, LOAN_REQUESTS_COLLECTION), preparedLoanData);
    console.log("[Service:addLoanRequest] Document written with ID:", docRef.id);
    return { id: docRef.id };
  } catch (error) {
    console.error("[Service:addLoanRequest] Raw error during Firestore addDoc:", error);
    console.error("[Service:addLoanRequest] Error name:", (error as Error).name);
    console.error("[Service:addLoanRequest] Error message:", (error as Error).message);
    console.error("[Service:addLoanRequest] Error stack:", (error as Error).stack);
    return createErrorResult("Failed to add loan request to Firestore.", error, 'addLoanRequest');
  }
}

interface GetLoanRequestsResult {
  loans?: LoanRequest[];
  error?: string;
}

export async function getLoanRequests(): Promise<GetLoanRequestsResult> {
  if (!db) {
    return createErrorResult("Firestore database is not initialized. Cannot fetch loan requests.", undefined, 'getLoanRequests');
  }
  try {
    const q = query(collection(db, LOAN_REQUESTS_COLLECTION), orderBy('submittedDate', 'desc'));
    const querySnapshot = await getDocs(q);
    const loans = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const mappedData = mapTimestampsInDoc(data);
      const stageDeadline = mappedData.stageDeadline ? new Date(mappedData.stageDeadline) : null;
      const currentStage = mappedData.currentStage || LoanStage.APPLICATION_SUBMITTED;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(currentStage) : false;
      
      return { 
        id: doc.id, 
        ...mappedData,
        isOverdue,
      } as LoanRequest;
    });
    return { loans };
  } catch (error) {
    return createErrorResult("Failed to fetch loan requests.", error, 'getLoanRequests');
  }
}

interface GetLoanRequestByIdResult {
  loan?: LoanRequest | null; // Allow null if not found but no error occurred
  error?: string;
}

export async function getLoanRequestById(id: string): Promise<GetLoanRequestByIdResult> {
  if (!db) {
    return createErrorResult(`Firestore database is not initialized. Cannot fetch loan request by ID: ${id}.`, undefined, 'getLoanRequestById');
  }
   if (!id || typeof id !== 'string' || id.trim() === '') {
    console.warn("[Service:getLoanRequestById] Called with invalid ID:", id);
    return createErrorResult("Invalid or empty ID provided for fetching loan request.", undefined, 'getLoanRequestById');
  }
  try {
    const docRef = doc(db, LOAN_REQUESTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const mappedData = mapTimestampsInDoc(data);
      const stageDeadline = mappedData.stageDeadline ? new Date(mappedData.stageDeadline) : null;
      const currentStage = mappedData.currentStage || LoanStage.APPLICATION_SUBMITTED;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && ![LoanStage.FUNDS_DISBURSED, LoanStage.REJECTED, LoanStage.APPROVED].includes(currentStage) : false;
      
      return { 
        loan: { 
          id: docSnap.id, 
          ...mappedData,
          isOverdue,
        } as LoanRequest 
      };
    } else {
      console.log(`[Service:getLoanRequestById] No such document for ID: ${id}`);
      // Explicitly return error here as per previous logic, or decide if loan: null with no error is preferred
      return { loan: null, error: `Loan request with ID "${id}" not found.` }; 
    }
  } catch (error) {
    return createErrorResult(`Failed to fetch loan request details for ID: ${id}.`, error, 'getLoanRequestById');
  }
}

interface UpdateLoanRequestResult {
  success?: boolean;
  error?: string;
}

export async function updateLoanRequest(id: string, dataToUpdate: Partial<Omit<LoanRequest, 'id'>>): Promise<UpdateLoanRequestResult> {
  if (!db) {
    return createErrorResult(`Firestore database is not initialized. Cannot update loan request with ID: ${id}.`, undefined, 'updateLoanRequest');
  }
  if (!id || typeof id !== 'string' || id.trim() === '') {
    console.warn("[Service:updateLoanRequest] Called with invalid ID:", id);
    return createErrorResult("Invalid or empty ID provided for updating loan request.", undefined, 'updateLoanRequest');
  }
  try {
    const docRef = doc(db, LOAN_REQUESTS_COLLECTION, id);
    const updatePayload = {
      ...dataToUpdate,
      lastUpdatedDate: new Date(), 
    };
    console.log("[Service:updateLoanRequest] Data before preparing for Firestore:", JSON.stringify(updatePayload, null, 2));
    const preparedUpdateData = prepareDataForFirestoreWrite(updatePayload);
    console.log("[Service:updateLoanRequest] Data prepared for Firestore:", JSON.stringify(preparedUpdateData, null, 2));
    
    await updateDoc(docRef, preparedUpdateData);
    return { success: true };
  } catch (error) {
     console.error("[Service:updateLoanRequest] Raw error during Firestore updateDoc:", error);
    return createErrorResult(`Failed to update loan request with ID: ${id}.`, error, 'updateLoanRequest');
  }
}
