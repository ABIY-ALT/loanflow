
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
  serverTimestamp,
  Timestamp,
  where,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { formatISO } from 'date-fns';

const LOAN_REQUESTS_COLLECTION = 'loanRequests';

// Helper to convert Firestore Timestamps to ISO strings if they exist
// and ensure other date strings are also in ISO format.
const mapTimestamps = (data: any): any => {
  const mappedData = { ...data };
  for (const key in mappedData) {
    if (mappedData[key] instanceof Timestamp) {
      mappedData[key] = mappedData[key].toDate().toISOString();
    } else if (key.endsWith('Date') && typeof mappedData[key] === 'string' && !isNaN(new Date(mappedData[key] as string).getTime())) {
      // Ensure string dates are also valid ISO if possible, or handle as needed
      // This part might need adjustment based on how dates are actually stored
    }
  }
  return mappedData;
};


export async function addLoanRequest(
  loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'assignedTo' | 'stageDeadline'>
): Promise<string> {
  try {
    const currentDate = new Date();
    const newLoanData = {
      ...loanData,
      loanNumber: `LN-${String(Date.now()).slice(-6)}`, // Simple unique loan number
      customerNumber: `CUST-${String(Date.now()).slice(-5)}`, // Simple unique customer number
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
      // stageDeadline could be calculated based on settings here if needed
    };
    const docRef = await addDoc(collection(db, LOAN_REQUESTS_COLLECTION), newLoanData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding loan request to Firestore: ", error);
    throw new Error("Failed to add loan request.");
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
      // Calculate isOverdue dynamically
      const stageDeadline = data.stageDeadline ? new Date(data.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && data.currentStage !== LoanStage.FUNDS_DISBURSED && data.currentStage !== LoanStage.REJECTED && data.currentStage !== LoanStage.APPROVED : false;
      
      return { 
        id: doc.id, 
        ...mapTimestamps(data),
        isOverdue, // Add calculated isOverdue
      } as LoanRequest;
    });
    return { loans };
  } catch (error) {
    console.error("Error fetching loan requests from Firestore: ", error);
    return { error: "Failed to fetch loan requests." };
  }
}

export async function getLoanRequestById(id: string): Promise<LoanRequest | null> {
  try {
    const docRef = doc(db, LOAN_REQUESTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const stageDeadline = data.stageDeadline ? new Date(data.stageDeadline) : null;
      const isOverdue = stageDeadline ? stageDeadline.getTime() < new Date().getTime() && data.currentStage !== LoanStage.FUNDS_DISBURSED && data.currentStage !== LoanStage.REJECTED && data.currentStage !== LoanStage.APPROVED : false;
      
      return { 
        id: docSnap.id, 
        ...mapTimestamps(data),
        isOverdue,
      } as LoanRequest;
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching loan request by ID from Firestore: ", error);
    throw new Error("Failed to fetch loan request details.");
  }
}

export async function updateLoanRequest(id: string, dataToUpdate: Partial<Omit<LoanRequest, 'id'>>): Promise<void> {
  try {
    const docRef = doc(db, LOAN_REQUESTS_COLLECTION, id);
    // Ensure lastUpdatedDate is always updated
    const updateDataWithTimestamp = {
      ...dataToUpdate,
      lastUpdatedDate: formatISO(new Date()),
    };
    await updateDoc(docRef, updateDataWithTimestamp);
  } catch (error) {
    console.error("Error updating loan request in Firestore: ", error);
    throw new Error("Failed to update loan request.");
  }
}
