import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import path from 'path';
import type { PalletTask, PalletData } from '@/types/pallet';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'ReleaseCheckList (1).xlsx');
const SHEET_NAME = 'PalletTracker';

/**
 * Reads pallet data from the Excel file
 * @returns Promise containing pallets array and file metadata
 */
export async function readPalletData(): Promise<PalletData> {
  console.log('[readPalletData] Starting...');
  console.log('[readPalletData] Excel file path:', EXCEL_FILE_PATH);

  try {
    // Get file metadata for optimistic locking
    console.log('[readPalletData] Getting file stats...');
    const stats = await fs.stat(EXCEL_FILE_PATH);
    console.log('[readPalletData] File size:', stats.size, 'bytes, modified:', new Date(stats.mtimeMs).toISOString());

    // Load the workbook
    console.log('[readPalletData] Loading workbook...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);
    console.log('[readPalletData] Workbook loaded');

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

    return {
      pallets,
      metadata: {
        mtime: stats.mtimeMs,
        version: stats.mtimeMs.toString(),
      },
    };
  } catch (error) {
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
