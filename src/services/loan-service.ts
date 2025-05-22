
'use server';
import { db } from '@/lib/firebase';
import type { LoanRequest } from '@/types/loan';
import { LoanStage } from '@/types/loan'; // Ensure LoanStage is imported if used for default values
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  Timestamp,
  query, 
  orderBy,
  updateDoc // Added updateDoc
  // serverTimestamp // Not using serverTimestamp for now to keep types simple with ISO strings
} from 'firebase/firestore';

// Helper to convert Firestore Timestamps to ISO strings if they exist
const mapTimestamps = (data: any) : any => {
  const mappedData = { ...data };
  for (const key in mappedData) {
    if (mappedData[key] instanceof Timestamp) {
      mappedData[key] = mappedData[key].toDate().toISOString();
    } else if (typeof mappedData[key] === 'object' && mappedData[key] !== null) {
      // Recursively map nested objects if necessary, e.g., history or documents
      if (Array.isArray(mappedData[key])) {
        mappedData[key] = mappedData[key].map(item => 
            typeof item === 'object' && item !== null ? mapTimestamps(item) : item
        );
      } else {
        mappedData[key] = mapTimestamps(mappedData[key]);
      }
    }
  }
  return mappedData;
};


// Define a type for the result of getLoanRequests
interface GetLoanRequestsResult {
  loans?: LoanRequest[];
  error?: any; // Use 'any' to capture any type of error
}
export async function addLoanRequest(loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber' | 'assignedTo' | 'stageDeadline'>): Promise<string> {
  try {
    const newLoanNumber = `LN${String(Date.now()).slice(-5)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
    const newCustomerNumber = `CUST${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
    
    const docData: Omit<LoanRequest, 'id'> = {
      ...loanData,
      loanNumber: newLoanNumber,
      customerNumber: newCustomerNumber,
      currentStage: LoanStage.APPLICATION_SUBMITTED,
      submittedDate: new Date().toISOString(),
      lastUpdatedDate: new Date().toISOString(),
      documents: [], 
      history: [
        {
          id: `hist-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: new Date().toISOString(),
          userId: 'system', 
          userName: 'System via New Application Form',
          notes: 'Loan application submitted by customer.',
        },
      ],
      isOverdue: false, 
      // stageDeadline: Calculate based on currentStage and settings (future enhancement)
    };

    const docRef = await addDoc(collection(db, 'loanRequests'), docData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding loan request: ', error);
    throw new Error('Failed to add loan request.');
  }
}

export async function getLoanRequests(): Promise<GetLoanRequestsResult> {
 try {
    const loanRequestsCol = collection(db, 'loanRequests'); // Start of Firestore interaction
    const q = query(loanRequestsCol, orderBy('submittedDate', 'desc')); // Added desc
    const loanRequestsSnapshot = await getDocs(q); // Potential error source

    const loanRequestsList = loanRequestsSnapshot.docs.map(doc => { // Processing data
      const data = doc.data();
      const mappedData = mapTimestamps(data); // Helper function call
      return {
        id: doc.id,
        ...mappedData,
        loanNumber: mappedData.loanNumber || '', // Handling potentially missing fields
        customerNumber: mappedData.customerNumber || '',
        customerName: mappedData.customerName || '',
        customerEmail: mappedData.customerEmail || '',
        customerPhone: mappedData.customerPhone || '',
        loanAmount: mappedData.loanAmount || 0,
        loanType: mappedData.loanType || '',
        loanPurpose: mappedData.loanPurpose || '',
        currentStage: mappedData.currentStage || LoanStage.APPLICATION_SUBMITTED,
        submittedDate: mappedData.submittedDate || new Date().toISOString(),
        lastUpdatedDate: mappedData.lastUpdatedDate || new Date().toISOString(),
        documents: mappedData.documents || [],
        history: mappedData.history || [],
        isOverdue: mappedData.isOverdue || false,
      } as LoanRequest; // Type assertion
    }); // End of data processing loop

 return { loans: loanRequestsList }; // Return object with loans if successful
  } catch (error) {
 console.error("Error in getLoanRequests:", error);
 return { error: error }; // Return object with error if an error occurs
 }
}

export async function getLoanRequestById(id: string): Promise<LoanRequest | undefined> {
  try {
    const loanRequestDoc = doc(db, 'loanRequests', id);
    const loanRequestSnapshot = await getDoc(loanRequestDoc);
    if (loanRequestSnapshot.exists()) {
      const data = loanRequestSnapshot.data();
      const mappedData = mapTimestamps(data);
      return { 
        id: loanRequestSnapshot.id, 
        ...mappedData,
        loanNumber: mappedData.loanNumber || '',
        customerNumber: mappedData.customerNumber || '',
        customerName: mappedData.customerName || '',
        customerEmail: mappedData.customerEmail || '',
        customerPhone: mappedData.customerPhone || '',
        loanAmount: mappedData.loanAmount || 0,
        loanType: mappedData.loanType || '',
        loanPurpose: mappedData.loanPurpose || '',
        currentStage: mappedData.currentStage || LoanStage.APPLICATION_SUBMITTED,
        submittedDate: mappedData.submittedDate || new Date().toISOString(),
        lastUpdatedDate: mappedData.lastUpdatedDate || new Date().toISOString(),
        documents: mappedData.documents || [],
        history: mappedData.history || [],
        isOverdue: mappedData.isOverdue || false,
      } as LoanRequest;
    } else {
      console.log('No such document!');
      return undefined;
    }
  } catch (error) {
    console.error('Error getting loan request by ID: ', error);
    throw new Error('Failed to retrieve loan request.');
  }
}

export async function updateLoanRequest(id: string, dataToUpdate: Partial<Omit<LoanRequest, 'id'>>): Promise<void> {
  try {
    const loanRequestDoc = doc(db, 'loanRequests', id);
    await updateDoc(loanRequestDoc, {
       ...dataToUpdate,
       lastUpdatedDate: new Date().toISOString() // Always update this field
    });
  } catch (error) {
    console.error("Error updating loan request: ", error);
    // Consider re-throwing a more specific error or handling it based on application needs
    throw new Error(`Failed to update loan request with ID ${id}.`);
  }
}
