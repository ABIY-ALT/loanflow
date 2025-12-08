
'use server';

import fs from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Helper to ensure directory exists
async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') { // Ignore if directory already exists
      throw error;
    }
  }
}

export async function uploadDocumentAction(
  loanId: string,
  conceptualDocName: string, // e.g., "Passport", "ID Card"
  formData: FormData
): Promise<{ success: boolean; filePath?: string; originalFileName?: string; error?: string }> {
  if (!loanId) {
    return { success: false, error: 'Loan ID is required.' };
  }
  if (!conceptualDocName) {
    return { success: false, error: 'Conceptual document name is required.' };
  }

  const file = formData.get('file') as File | null;

  if (!file) {
    return { success: false, error: 'No file selected for upload.' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: `File size exceeds the 5MB limit. Please upload a smaller file.` };
  }


  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename to prevent overwrites and handle special characters
    const timestamp = Date.now();
    // Basic sanitization, replace non-alphanumeric with underscore
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${timestamp}-${sanitizedOriginalName}`;

    // Store files in a secure, non-public directory
    const uploadDir = path.join(process.cwd(), 'storage', 'loan_documents', loanId);
    await ensureDir(uploadDir);

    const absoluteFilePath = path.join(uploadDir, uniqueFileName);
    await fs.writeFile(absoluteFilePath, buffer);
    
    // Store a relative path from the 'storage' root directory for retrieval
    const storageRelativePath = path.join('loan_documents', loanId, uniqueFileName);

    // Optional: Revalidate path if you list documents on the page immediately
    revalidatePath(`/loan-requests/${loanId}`);

    // Return the storage-relative path. The client will use this to construct a call to the secure download API endpoint.
    return { success: true, filePath: storageRelativePath, originalFileName: file.name };
  } catch (error: any) {
    console.error('Error uploading document:', error);
    return { success: false, error: `File upload failed: ${error.message}` };
  }
}
