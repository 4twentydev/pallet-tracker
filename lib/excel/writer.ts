import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import path from 'path';
import type { PalletData } from '@/types/pallet';
import { readPalletData } from './reader';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'ReleaseCheckList (1).xlsx');
const SHEET_NAME = 'PalletTracker';
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
  console.log('[updatePalletMadeStatus] Starting:', { palletId, made, expectedVersion });

  try {
    // Check for conflicts (optimistic locking)
    const currentStats = await fs.stat(EXCEL_FILE_PATH);
    const currentVersion = currentStats.mtimeMs.toString();
    console.log('[updatePalletMadeStatus] Current version:', currentVersion);

    if (currentVersion !== expectedVersion) {
      console.error('[updatePalletMadeStatus] VERSION MISMATCH');
      throw new Error('CONFLICT: File has been modified externally');
    }

    // Parse the pallet ID (using :: as delimiter to handle hyphens in release numbers)
    const [jobNumber, releaseNumber, palletNumber] = palletId.split('::');
    console.log('[updatePalletMadeStatus] Parsed ID:', { jobNumber, releaseNumber, palletNumber });

    // Load the workbook
    console.log('[updatePalletMadeStatus] Loading workbook from:', EXCEL_FILE_PATH);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);

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

    // Write the changes back to the file
    console.log('[updatePalletMadeStatus] Writing to file...');
    await workbook.xlsx.writeFile(EXCEL_FILE_PATH);
    console.log('[updatePalletMadeStatus] File written successfully');

    // Return the updated data
    console.log('[updatePalletMadeStatus] Reading updated data...');
    const updatedData = await readPalletData();
    console.log('[updatePalletMadeStatus] Updated data loaded, pallets:', updatedData.pallets.length);
    return updatedData;
  } catch (error) {
    console.error('[updatePalletMadeStatus] ERROR:', error);
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
    // Check for conflicts (optimistic locking)
    const currentStats = await fs.stat(EXCEL_FILE_PATH);
    const currentVersion = currentStats.mtimeMs.toString();

    if (currentVersion !== expectedVersion) {
      throw new Error('CONFLICT: File has been modified externally');
    }

    // Create a set of pallet IDs for quick lookup
    const palletIdsSet = new Set(palletIds);
    const foundIds = new Set<string>();

    // Load the workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);

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

    // Write the changes back to the file
    await workbook.xlsx.writeFile(EXCEL_FILE_PATH);

    // Return the updated data
    return readPalletData();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to bulk update pallet status');
  }
}
