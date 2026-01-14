import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import type { PalletTask, PalletData } from '@/types/pallet';
import {
  EXCEL_FILE_PATH,
  SHEET_NAME,
  retryFileOperation,
  computeFileHash,
  isFileLockError,
  createTempCopy,
  cleanupTempFile,
} from './server-utils';

/**
 * Attempts to load the workbook, falling back to a temp copy if the file is locked
 * @returns Object with workbook, whether it's read-only, and optional temp path to clean up
 */
async function loadWorkbookWithFallback(): Promise<{
  workbook: ExcelJS.Workbook;
  readOnly: boolean;
  tempPath?: string;
}> {
  // First, try to load directly with retry logic for temporary locks
  try {
    console.log('[loadWorkbookWithFallback] Attempting direct read...');
    const workbook = await retryFileOperation(async () => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(EXCEL_FILE_PATH);
      return wb;
    });
    console.log('[loadWorkbookWithFallback] Direct read successful');
    return { workbook, readOnly: false };
  } catch (error) {
    // If it's a persistent lock (Excel has file open), try temp copy
    if (isFileLockError(error)) {
      console.log('[loadWorkbookWithFallback] File locked, trying temp copy fallback...');
      try {
        const tempPath = await createTempCopy();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(tempPath);
        console.log('[loadWorkbookWithFallback] Read from temp copy successful (read-only mode)');
        return { workbook, readOnly: true, tempPath };
      } catch (tempError) {
        console.error('[loadWorkbookWithFallback] Temp copy fallback failed:', tempError);
        throw new Error('Cannot read Excel file. Please close Excel and try again.');
      }
    }
    throw error;
  }
}

/**
 * Reads pallet data from the Excel file
 * Falls back to read-only mode if Excel has the file open
 * @returns Promise containing pallets array and file metadata
 */
export async function readPalletData(): Promise<PalletData> {
  console.log('[readPalletData] Starting...');
  console.log('[readPalletData] Excel file path:', EXCEL_FILE_PATH);

  let tempPath: string | undefined;

  try {
    // Get file metadata for optimistic locking
    console.log('[readPalletData] Getting file stats...');
    const stats = await fs.stat(EXCEL_FILE_PATH);
    console.log('[readPalletData] File size:', stats.size, 'bytes, modified:', new Date(stats.mtimeMs).toISOString());

    // Load the workbook (with fallback to temp copy if locked)
    console.log('[readPalletData] Loading workbook...');
    const { workbook, readOnly, tempPath: tp } = await loadWorkbookWithFallback();
    tempPath = tp;
    console.log('[readPalletData] Workbook loaded, readOnly:', readOnly);

    // Get the PalletTracker worksheet
    console.log('[readPalletData] Looking for sheet:', SHEET_NAME);
    const worksheet = workbook.getWorksheet(SHEET_NAME);
    if (!worksheet) {
      const availableSheets = workbook.worksheets.map(ws => ws.name).join(', ');
      console.error('[readPalletData] Available sheets:', availableSheets);
      throw new Error(`Sheet "${SHEET_NAME}" not found in workbook. Available sheets: ${availableSheets}`);
    }
    console.log('[readPalletData] Worksheet found, row count:', worksheet.rowCount);

    const pallets: PalletTask[] = [];

    // Iterate through rows (skip header row 1)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const jobNumber = row.getCell(1).text.trim();
      const releaseNumber = row.getCell(2).text.trim();
      const palletNumber = row.getCell(3).text.trim();

      // Skip rows without essential data
      if (!jobNumber || !releaseNumber || !palletNumber) return;

      const size = row.getCell(4).text.trim();
      const elevation = row.getCell(5).text.trim();
      const madeValue = row.getCell(6).text.trim().toUpperCase();
      const made = madeValue === 'X';
      const accList = row.getCell(7).text.trim();
      const shippedDate = row.getCell(8).text.trim();
      const notes = row.getCell(9).text.trim();

      pallets.push({
        id: `${jobNumber}::${releaseNumber}::${palletNumber}`,
        jobNumber,
        releaseNumber,
        palletNumber,
        size,
        elevation,
        made,
        accList,
        shippedDate,
        notes,
        status: made ? 'completed' : 'pending',
      });
    });

    console.log('[readPalletData] Loaded', pallets.length, 'pallets');
    if (pallets.length > 0) {
      console.log('[readPalletData] Sample pallet IDs:', pallets.slice(0, 3).map(p => p.id));
    }

    // Compute content hash for reliable conflict detection (works with cloud sync)
    // Use temp file hash if we're in read-only mode, otherwise use original file
    const contentHash = await computeFileHash(tempPath || EXCEL_FILE_PATH);
    console.log('[readPalletData] Content hash:', contentHash.substring(0, 12) + '...');

    // Clean up temp file if we created one
    if (tempPath) {
      await cleanupTempFile(tempPath);
    }

    return {
      pallets,
      metadata: {
        mtime: stats.mtimeMs,
        version: contentHash,
        readOnly,
      },
    };
  } catch (error) {
    // Clean up temp file on error too
    if (tempPath) {
      await cleanupTempFile(tempPath);
    }
    console.error('[readPalletData] ERROR:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to read Excel file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Gets the current file modification time
 * @returns File modification timestamp in milliseconds
 */
export async function getFileModificationTime(): Promise<number> {
  try {
    const stats = await fs.stat(EXCEL_FILE_PATH);
    return stats.mtimeMs;
  } catch (error) {
    throw new Error('Failed to get file modification time');
  }
}
