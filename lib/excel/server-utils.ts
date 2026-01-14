import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'Release-CheckList.xlsx');
export const SHEET_NAME = 'PalletTracker';

/**
 * Checks if an error is a file lock error (Excel or cloud sync has the file open)
 */
export function isFileLockError(error: unknown): boolean {
  const errorCode = (error as NodeJS.ErrnoException).code;
  return errorCode === 'EBUSY' || errorCode === 'EPERM' || errorCode === 'EACCES';
}

/**
 * Creates a temporary copy of the Excel file for reading when the original is locked
 * Returns the path to the temp file
 */
export async function createTempCopy(): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFileName = `pallet-tracker-${Date.now()}.xlsx`;
  const tempPath = path.join(tempDir, tempFileName);

  // Copy file to temp location
  await fs.copyFile(EXCEL_FILE_PATH, tempPath);
  console.log('[createTempCopy] Created temp copy at:', tempPath);

  return tempPath;
}

/**
 * Cleans up a temporary file
 */
export async function cleanupTempFile(tempPath: string): Promise<void> {
  try {
    await fs.unlink(tempPath);
    console.log('[cleanupTempFile] Removed temp file:', tempPath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Computes SHA-256 hash of the Excel file content
 * This is more reliable than mtime for conflict detection in cloud-synced folders
 * Uses retry logic to handle temporary file locks from cloud sync
 */
export async function computeFileHash(filePath: string = EXCEL_FILE_PATH): Promise<string> {
  const fileBuffer = await retryFileOperation(() => fs.readFile(filePath));
  return createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Retry logic for file operations that may be temporarily locked
 * Handles EBUSY, EPERM, EACCES errors common with cloud sync (Dropbox, OneDrive)
 */
export async function retryFileOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  delayMs = 200
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const errorCode = (error as NodeJS.ErrnoException).code;

      // Only retry on file lock errors (EBUSY, EPERM, EACCES)
      if (errorCode === 'EBUSY' || errorCode === 'EPERM' || errorCode === 'EACCES') {
        if (attempt < maxRetries) {
          const delay = delayMs * Math.pow(2, attempt);
          console.log(`[retryFileOperation] File locked, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // For other errors or max retries reached, throw immediately
      throw error;
    }
  }

  throw lastError || new Error('Retry operation failed');
}
