import ExcelJS from 'exceljs';
import type { PalletData } from '@/types/pallet';
import { readPalletData } from './reader';
import { EXCEL_FILE_PATH, SHEET_NAME, retryFileOperation, computeFileHash, isFileLockError } from './server-utils';

const MADE_COLUMN = 6; // Column F (Made)

/**
 * Updates the "Made" status of a single pallet in the Excel file
 * @param palletId - The pallet ID (format: "job-release-pallet")
 * @param made - true to mark as "X", false to clear
 * @param expectedVersion - The expected file version for optimistic locking
 * @returns Updated pallet data
 * @throws Error if file was modified externally or pallet not found
 */
export async function updatePalletMadeStatus(
  palletId: string,
  made: boolean,
  expectedVersion: string
): Promise<PalletData> {
  console.log('[updatePalletMadeStatus] Starting:', { palletId, made, expectedVersion: expectedVersion.substring(0, 12) + '...' });

  try {
    // Check for conflicts using content hash (works reliably with cloud sync)
    const currentHash = await computeFileHash();
    console.log('[updatePalletMadeStatus] Current hash:', currentHash.substring(0, 12) + '...');
    console.log('[updatePalletMadeStatus] Expected hash:', expectedVersion.substring(0, 12) + '...');

    if (currentHash !== expectedVersion) {
      console.error('[updatePalletMadeStatus] CONTENT HASH MISMATCH');
      console.error('[updatePalletMadeStatus] Current:  ', currentHash);
      console.error('[updatePalletMadeStatus] Expected: ', expectedVersion);
      throw new Error('CONFLICT: File has been modified externally');
    }
    console.log('[updatePalletMadeStatus] Hash verified - proceeding with update');

    // Parse the pallet ID (using :: as delimiter to handle hyphens in release numbers)
    const [jobNumber, releaseNumber, palletNumber] = palletId.split('::');
    console.log('[updatePalletMadeStatus] Parsed ID:', { jobNumber, releaseNumber, palletNumber });

    // Load the workbook with retry logic
    console.log('[updatePalletMadeStatus] Loading workbook from:', EXCEL_FILE_PATH);
    const workbook = await retryFileOperation(async () => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(EXCEL_FILE_PATH);
      return wb;
    });

    const worksheet = workbook.getWorksheet(SHEET_NAME);
    if (!worksheet) {
      console.error('[updatePalletMadeStatus] Sheet not found:', SHEET_NAME);
      throw new Error(`Sheet "${SHEET_NAME}" not found in workbook`);
    }
    console.log('[updatePalletMadeStatus] Worksheet loaded');

    // Find and update the row
    let found = false;
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowJob = row.getCell(1).text.trim();
      const rowRelease = row.getCell(2).text.trim();
      const rowPallet = row.getCell(3).text.trim();

      if (rowJob === jobNumber && rowRelease === releaseNumber && rowPallet === palletNumber) {
        console.log('[updatePalletMadeStatus] Found pallet at row:', rowNumber);
        const oldValue = row.getCell(MADE_COLUMN).text;
        row.getCell(MADE_COLUMN).value = made ? 'X' : null;
        console.log('[updatePalletMadeStatus] Updated cell F from', oldValue, 'to', made ? 'X' : null);
        found = true;
      }
    });

    if (!found) {
      console.error('[updatePalletMadeStatus] Pallet not found in Excel');
      throw new Error(`Pallet ${palletId} not found in Excel file`);
    }

    // Write the changes back to the file with retry logic
    console.log('[updatePalletMadeStatus] Writing to file...');
    await retryFileOperation(async () => {
      await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
    });
    console.log('[updatePalletMadeStatus] File written successfully');

    // Return the updated data
    console.log('[updatePalletMadeStatus] Reading updated data...');
    const updatedData = await readPalletData();
    console.log('[updatePalletMadeStatus] Updated data loaded, pallets:', updatedData.pallets.length);
    return updatedData;
  } catch (error) {
    console.error('[updatePalletMadeStatus] ERROR:', error);

    // Check if this is a file lock error (Excel has file open)
    if (isFileLockError(error)) {
      throw new Error('FILE_LOCKED: Cannot save - Excel has the file open. Close Excel and try again.');
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update pallet status');
  }
}

/**
 * Updates the "Made" status of multiple pallets in bulk
 * @param palletIds - Array of pallet IDs to update
 * @param made - true to mark as "X", false to clear
 * @param expectedVersion - The expected file version for optimistic locking
 * @returns Updated pallet data
 * @throws Error if file was modified externally or any pallet not found
 */
export async function bulkUpdatePalletStatus(
  palletIds: string[],
  made: boolean,
  expectedVersion: string
): Promise<PalletData> {
  try {
    // Check for conflicts using content hash (works reliably with cloud sync)
    const currentHash = await computeFileHash();

    if (currentHash !== expectedVersion) {
      throw new Error('CONFLICT: File has been modified externally');
    }

    // Create a set of pallet IDs for quick lookup
    const palletIdsSet = new Set(palletIds);
    const foundIds = new Set<string>();

    // Load the workbook with retry logic
    const workbook = await retryFileOperation(async () => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(EXCEL_FILE_PATH);
      return wb;
    });

    const worksheet = workbook.getWorksheet(SHEET_NAME);
    if (!worksheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found in workbook`);
    }

    // Find and update all matching rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowJob = row.getCell(1).text.trim();
      const rowRelease = row.getCell(2).text.trim();
      const rowPallet = row.getCell(3).text.trim();
      const palletId = `${rowJob}::${rowRelease}::${rowPallet}`;

      if (palletIdsSet.has(palletId)) {
        row.getCell(MADE_COLUMN).value = made ? 'X' : null;
        foundIds.add(palletId);
      }
    });

    // Check if all pallets were found
    if (foundIds.size !== palletIds.length) {
      const notFound = palletIds.filter(id => !foundIds.has(id));
      throw new Error(`Pallets not found: ${notFound.join(', ')}`);
    }

    // Write the changes back to the file with retry logic
    await retryFileOperation(async () => {
      await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
    });

    // Return the updated data
    return readPalletData();
  } catch (error) {
    // Check if this is a file lock error (Excel has file open)
    if (isFileLockError(error)) {
      throw new Error('FILE_LOCKED: Cannot save - Excel has the file open. Close Excel and try again.');
    }

    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to bulk update pallet status');
  }
}
