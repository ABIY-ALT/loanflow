
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
  // serverTimestamp, // Not currently used, but good for future
  Timestamp,
  // where, // Not currently used
  // deleteDoc, // Not currently used
  // writeBatch, // Not currently used
} from 'firebase/firestore';
import { formatISO } from 'date-fns';

const LOAN_REQUESTS_COLLECTION = 'loanRequests';

const getDetailedErrorMessage = (error: unknown, defaultMessage: string): string => {
  let detailedErrorMessage = defaultMessage;
  if (error instanceof Error) {
      detailedErrorMessage = error.message; // Default to the message
      if ((error as any).code && (error as any).name) { // Firebase errors often have code and name
          detailedErrorMessage = `Firebase Error (${(error as any).name} - ${(error as any).code}): ${error.message}`;
      }
  } else if (typeof error === 'string') {
      detailedErrorMessage = error;
  }
  console.error("Firestore Service Error Details: ", detailedErrorMessage, "\nOriginal Error Object:", error); // Log on the server
  return detailedErrorMessage;
};

// Helper to convert Firestore Timestamps to ISO strings if they exist
const mapTimestamps = (data: any): any => {
  const mappedData = { ...data };
  for (const key in mappedData) {
    if (mappedData[key] instanceof Timestamp) {
      mappedData[key] = mappedData[key].toDate().toISOString();
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
    };
    const docRef = await addDoc(collection(db, LOAN_REQUESTS_COLLECTION), newLoanData);
    return { id: docRef.id };
  } catch (error) {
    return { error: getDetailedErrorMessage(error, "Failed to add loan request.") };
  }
}

interface GetLoanRequestsResult {
  loans?: LoanRequest[];
  error?: string;
}

export async function getLoanRequests(): Promise<GetLoanRequestsResult> {
  try {
    const q = query(collection(db, LOAN_REQUESTS_COLLECTION), orderBy('submittedDate', 'desc'));
    const querySnapshot = await getDocs(q);
    const loans = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const stageDeadline = data.stageDeadline ? new Date(data.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && data.currentStage !== LoanStage.FUNDS_DISBURSED && data.currentStage !== LoanStage.REJECTED && data.currentStage !== LoanStage.APPROVED : false;
      
      return { 
        id: doc.id, 
        ...mapTimestamps(data),
        isOverdue,
      } as LoanRequest;
    });
    return { loans };
  } catch (error) {
    return { error: getDetailedErrorMessage(error, "Failed to fetch loan requests.") };
  }
}

interface GetLoanRequestByIdResult {
  loan?: LoanRequest | null; // Allow null if not found but no error
  error?: string;
}

export async function getLoanRequestById(id: string): Promise<GetLoanRequestByIdResult> {
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
          ...mapTimestamps(data),
          isOverdue,
        } as LoanRequest 
      };
    } else {
      console.log("No such document in getLoanRequestById service!");
      return { loan: null, error: `Loan request with ID "${id}" not found.` }; // Specific message for not found
    }
  } catch (error) {
    return { error: getDetailedErrorMessage(error, "Failed to fetch loan request details.") };
  }
}

interface UpdateLoanRequestResult {
  success?: boolean;
  error?: string;
}

export async function updateLoanRequest(id: string, dataToUpdate: Partial<Omit<LoanRequest, 'id'>>): Promise<UpdateLoanRequestResult> {
  try {
    const docRef = doc(db, LOAN_REQUESTS_COLLECTION, id);
    const updateDataWithTimestamp = {
      ...dataToUpdate,
      lastUpdatedDate: formatISO(new Date()),
    };
    await updateDoc(docRef, updateDataWithTimestamp);
    return { success: true };
  } catch (error) {
    return { error: getDetailedErrorMessage(error, "Failed to update loan request.") };
  }
}
