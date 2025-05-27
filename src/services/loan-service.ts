
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
const createErrorResult = (message: string, originalError?: unknown) => {
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
  
  console.error("Loan Service Error Encountered on Server:", detailedMessage, "\nOriginal Error Object (if any):", originalError);
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
      if (Object.prototype.toString.call(mappedData[key]) === '[object Object]') {
        // mappedData[key] = mapTimestampsInDoc(mappedData[key]); // Avoid deep recursion for now
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
        return data.toDate().toISOString(); // Convert Timestamp to ISO string if somehow present
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
  if (!db) {
    return createErrorResult("Firestore database is not initialized. Cannot add loan request.");
  }
  try {
    const currentDate = new Date(); // Use JS Date object directly
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
      // stageDeadline: null, // Explicitly set to null or calculate if needed
    };

    console.log("Data before preparing for Firestore (addLoanRequest):", JSON.stringify(newLoanDataBase, null, 2));
    const preparedLoanData = prepareDataForFirestoreWrite(newLoanDataBase);
    console.log("Data prepared for Firestore (addLoanRequest):", JSON.stringify(preparedLoanData, null, 2));

    const docRef = await addDoc(collection(db, LOAN_REQUESTS_COLLECTION), preparedLoanData);
    return { id: docRef.id };
  } catch (error) {
    console.error("Raw error in addLoanRequest service:", error);
    return createErrorResult("Failed to add loan request.", error);
  }
}

interface GetLoanRequestsResult {
  loans?: LoanRequest[];
  error?: string;
}

export async function getLoanRequests(): Promise<GetLoanRequestsResult> {
  if (!db) {
    return createErrorResult("Firestore database is not initialized. Cannot fetch loan requests.");
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
    return createErrorResult("Failed to fetch loan requests.", error);
  }
}

interface GetLoanRequestByIdResult {
  loan?: LoanRequest | null;
  error?: string;
}

export async function getLoanRequestById(id: string): Promise<GetLoanRequestByIdResult> {
  if (!db) {
    return createErrorResult(`Firestore database is not initialized. Cannot fetch loan request by ID: ${id}.`);
  }
   if (!id || typeof id !== 'string' || id.trim() === '') {
    console.warn("getLoanRequestById called with invalid ID:", id);
    return createErrorResult("Invalid or empty ID provided for fetching loan request.");
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
      console.log(`No such document in getLoanRequestById service for ID: ${id}`);
      return { loan: null, error: `Loan request with ID "${id}" not found.` };
    }
  } catch (error) {
    return createErrorResult(`Failed to fetch loan request details for ID: ${id}.`, error);
  }
}

interface UpdateLoanRequestResult {
  success?: boolean;
  error?: string;
}

export async function updateLoanRequest(id: string, dataToUpdate: Partial<Omit<LoanRequest, 'id'>>): Promise<UpdateLoanRequestResult> {
  if (!db) {
    return createErrorResult(`Firestore database is not initialized. Cannot update loan request with ID: ${id}.`);
  }
  if (!id || typeof id !== 'string' || id.trim() === '') {
    console.warn("updateLoanRequest called with invalid ID:", id);
    return createErrorResult("Invalid or empty ID provided for updating loan request.");
  }
  try {
    const docRef = doc(db, LOAN_REQUESTS_COLLECTION, id);
    const updatePayload = {
      ...dataToUpdate,
      lastUpdatedDate: new Date(), // Use JS Date object directly
    };
    console.log("Data before preparing for Firestore (updateLoanRequest):", JSON.stringify(updatePayload, null, 2));
    const preparedUpdateData = prepareDataForFirestoreWrite(updatePayload);
    console.log("Data prepared for Firestore (updateLoanRequest):", JSON.stringify(preparedUpdateData, null, 2));
    
    await updateDoc(docRef, preparedUpdateData);
    return { success: true };
  } catch (error) {
     console.error("Raw error in updateLoanRequest service:", error);
    return createErrorResult(`Failed to update loan request with ID: ${id}.`, error);
  }
}
