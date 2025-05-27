
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
    detailedMessage = `${message} (Firebase Error: Name: ${(originalError as any).name || 'N/A'}, Code: ${(originalError as any).code || 'N/A'}, Message: ${originalError.message})`;
  } else if (typeof originalError === 'string') {
    detailedMessage = `${message} (Details: ${originalError})`;
  }
  // Log on the server for more detailed server-side debugging
  console.error("Loan Service Error Encountered:", detailedMessage, "\nOriginal Error Object (if any):", originalError);
  return { error: detailedMessage }; // Return a serializable error object
};


// Helper to convert Firestore Timestamps to ISO strings if they exist
const mapTimestamps = (data: any): any => {
  const mappedData = { ...data };
  for (const key in mappedData) {
    if (mappedData[key] instanceof Timestamp) {
      mappedData[key] = mappedData[key].toDate().toISOString();
    } else if (typeof mappedData[key] === 'object' && mappedData[key] !== null) {
      // Recursively map nested objects, but be careful with deep recursion
      // For this app, loan history/documents are arrays of objects, handle them if necessary
      if (Array.isArray(mappedData[key])) {
        mappedData[key] = mappedData[key].map(item => 
            typeof item === 'object' && item !== null ? mapTimestamps(item) : item
        );
      } else {
        // mappedData[key] = mapTimestamps(mappedData[key]); // Avoid deep recursion for now unless specifically needed
      }
    }
  }
  return mappedData;
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
    const currentDate = new Date();
    const newLoanData = {
      ...loanData,
      loanNumber: `LN-${String(Date.now()).slice(-6)}`,
      customerNumber: `CUST-${String(Date.now()).slice(-5)}`,
      currentStage: LoanStage.APPLICATION_SUBMITTED,
      submittedDate: formatISO(currentDate),
      lastUpdatedDate: formatISO(currentDate),
      documents: [],
      history: [
        {
          id: `hist-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: formatISO(currentDate),
          userId: 'system-entry',
          userName: 'System',
          notes: 'Loan application submitted.',
        },
      ],
      isOverdue: false,
      // stageDeadline will be set based on workflow settings, potentially later or not at all for initial submission
    };
    const docRef = await addDoc(collection(db, LOAN_REQUESTS_COLLECTION), newLoanData);
    return { id: docRef.id };
  } catch (error) {
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
      const stageDeadline = data.stageDeadline ? new Date(data.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && data.currentStage !== LoanStage.FUNDS_DISBURSED && data.currentStage !== LoanStage.REJECTED && data.currentStage !== LoanStage.APPROVED : false;
      
      return { 
        id: doc.id, 
        ...mapTimestamps(data), // Ensure timestamps are converted
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
      const stageDeadline = data.stageDeadline ? new Date(data.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && data.currentStage !== LoanStage.FUNDS_DISBURSED && data.currentStage !== LoanStage.REJECTED && data.currentStage !== LoanStage.APPROVED : false;
      
      return { 
        loan: { 
          id: docSnap.id, 
          ...mapTimestamps(data), // Ensure timestamps are converted
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
    const updateDataWithTimestamp = {
      ...dataToUpdate,
      lastUpdatedDate: formatISO(new Date()),
    };
    await updateDoc(docRef, updateDataWithTimestamp);
    return { success: true };
  } catch (error) {
    return createErrorResult(`Failed to update loan request with ID: ${id}.`, error);
  }
}
