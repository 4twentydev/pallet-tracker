import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';
import { insertPallets, deleteAllPallets } from '@/lib/db/queries';
import type { NewPallet } from '@/lib/db/schema';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'data', 'Release-CheckList.xlsx');
const SHEET_NAME = 'PalletTracker';

/**
 * POST /api/import
 * Imports pallet data from the Excel file into the database
 * This is a one-time operation to migrate from Excel to database
 */
export async function POST(request: Request) {
  // Check for secret key to prevent unauthorized imports
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.IMPORT_SECRET_KEY;

  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[import] Starting Excel import from:', EXCEL_FILE_PATH);

    // Load the Excel workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE_PATH);

    const worksheet = workbook.getWorksheet(SHEET_NAME);
    if (!worksheet) {
      return NextResponse.json(
        { error: `Sheet "${SHEET_NAME}" not found in workbook` },
        { status: 400 }
      );
    }

    // Parse pallets from Excel
    const palletsToInsert: NewPallet[] = [];

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

      palletsToInsert.push({
        jobNumber,
        releaseNumber,
        palletNumber,
        size,
        elevation,
        made,
        accList,
        shippedDate,
        notes,
      });
    });

    console.log('[import] Found', palletsToInsert.length, 'pallets to import');

    // Clear existing data and insert new
    await deleteAllPallets();
    await insertPallets(palletsToInsert);

    console.log('[import] Import complete!');

    return NextResponse.json({
      success: true,
      message: `Imported ${palletsToInsert.length} pallets successfully`,
      count: palletsToInsert.length,
    });
  } catch (error) {
    console.error('[import] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/import
 * Returns info about the import endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to import Excel data into the database',
    note: 'Include Authorization header with Bearer token if IMPORT_SECRET_KEY is set',
  });
}
