
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
  serverTimestamp
} from 'firebase/firestore';

// Helper to convert Firestore Timestamps to ISO strings if they exist
const mapTimestamps = (data: any) : any => {
  const mappedData = { ...data };
  for (const key in mappedData) {
    if (mappedData[key] instanceof Timestamp) {
      mappedData[key] = mappedData[key].toDate().toISOString();
    }
  }
  return mappedData;
};


export async function addLoanRequest(loanData: Omit<LoanRequest, 'id' | 'submittedDate' | 'lastUpdatedDate' | 'history' | 'currentStage' | 'documents' | 'isOverdue' | 'loanNumber' | 'customerNumber'>): Promise<string> {
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
      documents: [], // Initialize with empty documents array
      history: [
        {
          id: `hist-${Date.now()}`,
          stage: LoanStage.APPLICATION_SUBMITTED,
          timestamp: new Date().toISOString(),
          userId: 'system', // Placeholder
          userName: 'System via New Application Form',
          notes: 'Loan application submitted by customer.',
        },
      ],
      isOverdue: false, // Default to not overdue
      // stageDeadline: Calculate based on currentStage and settings (future enhancement)
    };

    const docRef = await addDoc(collection(db, 'loanRequests'), {
      ...docData,
      // Use serverTimestamp for fields that should be set by the server upon write
      // For example, if you want Firestore to manage created/updated timestamps:
      // submittedDate: serverTimestamp(),
      // lastUpdatedDate: serverTimestamp(),
      // However, LoanRequest type expects strings, so we use ISO strings from client
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding loan request: ', error);
    throw new Error('Failed to add loan request.');
  }
}

export async function getLoanRequests(): Promise<LoanRequest[]> {
  try {
    const loanRequestsCol = collection(db, 'loanRequests');
    // Optionally, order by submittedDate or lastUpdatedDate
    const q = query(loanRequestsCol, orderBy('submittedDate', 'desc'));
    const loanRequestsSnapshot = await getDocs(q);
    const loanRequestsList = loanRequestsSnapshot.docs.map(doc => {
      const data = doc.data();
      // Ensure all necessary fields are present and map Timestamps
      const mappedData = mapTimestamps(data);
      return { 
        id: doc.id, 
        ...mappedData,
        // Ensure all fields from LoanRequest type are present with defaults if necessary
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
    });
    return loanRequestsList;
  } catch (error) {
    console.error('Error getting loan requests: ', error);
    throw new Error('Failed to retrieve loan requests.');
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
        // Ensure all fields from LoanRequest type are present with defaults if necessary
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

// Placeholder for update function - will be implemented in a future phase
// export async function updateLoanRequest(id: string, updatedData: Partial<LoanRequest>): Promise<void> {
//   try {
//     const loanRequestDoc = doc(db, 'loanRequests', id);
//     await updateDoc(loanRequestDoc, {
//        ...updatedData,
//        lastUpdatedDate: new Date().toISOString() // Or serverTimestamp()
//     });
//   } catch (error) {
//     console.error("Error updating loan request: ", error);
//     throw new Error("Failed to update loan request.");
//   }
// }
