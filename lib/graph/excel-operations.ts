import { getGraphClient } from './client';
import type { Todo, NewTodo } from '@/lib/db/schema';

/**
 * Microsoft Graph Excel Operations
 * Provides methods to interact with Excel Tables in OneDrive/SharePoint
 * Uses Microsoft Graph API for all Excel operations
 */

export interface ExcelRow {
  index: number;
  values: string[][];
}

export interface ExcelTableRow {
  id: string; // Row ID from Graph API
  index: number;
  values: string[][];
}

/**
 * Gets the Excel Table resource path for Graph API
 */
function getTablePath(): string {
  const workbookId = process.env.EXCEL_WORKBOOK_ID;
  const worksheetName = process.env.EXCEL_WORKSHEET_NAME || 'PalletTracker';
  const tableName = process.env.EXCEL_TABLE_NAME || 'PalletTable';

  if (!workbookId) {
    throw new Error('EXCEL_WORKBOOK_ID is not configured');
  }

  return `/me/drive/items/${workbookId}/workbook/worksheets('${worksheetName}')/tables('${tableName}')`;
}

/**
 * Gets the Excel Worksheet resource path for Graph API
 */
function getWorksheetPath(): string {
  const workbookId = process.env.EXCEL_WORKBOOK_ID;
  const worksheetName = process.env.EXCEL_WORKSHEET_NAME || 'PalletTracker';

  if (!workbookId) {
    throw new Error('EXCEL_WORKBOOK_ID is not configured');
  }

  return `/me/drive/items/${workbookId}/workbook/worksheets('${worksheetName}')`;
}

/**
 * Reads all rows from the Excel Table
 * @returns Array of table rows with IDs and values
 */
export async function readExcelTableRows(): Promise<ExcelTableRow[]> {
  try {
    const client = getGraphClient();
    const tablePath = getTablePath();

    console.log('[readExcelTableRows] Fetching rows from:', tablePath);

    // Get all rows from the table
    const response = await client
      .api(`${tablePath}/rows`)
      .header('Prefer', 'allow-empty-collection')
      .get();

    console.log('[readExcelTableRows] Fetched', response.value?.length || 0, 'rows');

    return response.value || [];
  } catch (error) {
    console.error('[readExcelTableRows] Error:', error);
    throw new Error(`Failed to read Excel table rows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets a specific row by row ID
 * @param rowId - The Graph API row ID
 */
export async function getExcelRowById(rowId: string): Promise<ExcelTableRow | null> {
  try {
    const client = getGraphClient();
    const tablePath = getTablePath();

    console.log('[getExcelRowById] Fetching row:', rowId);

    const row = await client.api(`${tablePath}/rows/${rowId}`).get();

    return row;
  } catch (error) {
    console.error('[getExcelRowById] Error:', error);
    return null;
  }
}

/**
 * Updates a specific row in the Excel Table
 * @param rowId - The Graph API row ID
 * @param values - Array of values to update (must match column count)
 */
export async function updateExcelRow(rowId: string, values: string[][]): Promise<boolean> {
  try {
    const client = getGraphClient();
    const tablePath = getTablePath();

    console.log('[updateExcelRow] Updating row:', rowId);

    await client.api(`${tablePath}/rows/${rowId}`).patch({
      values,
    });

    console.log('[updateExcelRow] Row updated successfully');
    return true;
  } catch (error) {
    console.error('[updateExcelRow] Error:', error);
    throw new Error(`Failed to update Excel row: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Adds a new row to the Excel Table
 * @param values - Array of values for the new row
 * @param index - Optional index to insert at (null for append)
 */
export async function addExcelRow(values: string[][], index: number | null = null): Promise<ExcelTableRow> {
  try {
    const client = getGraphClient();
    const tablePath = getTablePath();

    console.log('[addExcelRow] Adding new row');

    const response = await client.api(`${tablePath}/rows`).post({
      index,
      values,
    });

    console.log('[addExcelRow] Row added successfully');
    return response;
  } catch (error) {
    console.error('[addExcelRow] Error:', error);
    throw new Error(`Failed to add Excel row: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Deletes a row from the Excel Table
 * @param rowId - The Graph API row ID
 */
export async function deleteExcelRow(rowId: string): Promise<boolean> {
  try {
    const client = getGraphClient();
    const tablePath = getTablePath();

    console.log('[deleteExcelRow] Deleting row:', rowId);

    await client.api(`${tablePath}/rows/${rowId}`).delete();

    console.log('[deleteExcelRow] Row deleted successfully');
    return true;
  } catch (error) {
    console.error('[deleteExcelRow] Error:', error);
    throw new Error(`Failed to delete Excel row: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Converts Excel row values to Todo object
 * Maps Excel columns to database fields
 *
 * Expected Excel columns:
 * 0: task_id (UUID)
 * 1: job_number
 * 2: release_number
 * 3: pallet_number
 * 4: size
 * 5: elevation
 * 6: status (new/in_progress/done)
 * 7: assigned_to
 * 8: due_date
 * 9: acc_list
 * 10: shipped_date
 * 11: notes
 */
export function excelRowToTodo(row: ExcelTableRow): NewTodo {
  const values = row.values[0] || [];

  return {
    taskId: values[0] || '',
    jobNumber: values[1] || '',
    releaseNumber: values[2] || '',
    palletNumber: values[3] || '',
    size: values[4] || '',
    elevation: values[5] || '',
    status: (values[6] as 'new' | 'in_progress' | 'done') || 'new',
    assignedTo: values[7] || null,
    dueDate: values[8] ? new Date(values[8]) : null,
    accList: values[9] || '',
    shippedDate: values[10] || null,
    notes: values[11] || '',
    excelRowId: row.id,
    excelRowIndex: row.index,
  };
}

/**
 * Converts Todo object to Excel row values
 * Maps database fields back to Excel columns
 */
export function todoToExcelRow(todo: Todo | NewTodo): string[][] {
  return [
    [
      'taskId' in todo && todo.taskId ? todo.taskId : '',
      todo.jobNumber,
      todo.releaseNumber,
      todo.palletNumber,
      todo.size,
      todo.elevation,
      todo.status,
      todo.assignedTo || '',
      todo.dueDate ? new Date(todo.dueDate).toISOString() : '',
      todo.accList || '',
      todo.shippedDate || '',
      todo.notes || '',
    ],
  ];
}

/**
 * Gets the Excel Table metadata
 * Useful for debugging and validation
 */
export async function getTableMetadata() {
  try {
    const client = getGraphClient();
    const tablePath = getTablePath();

    console.log('[getTableMetadata] Fetching table metadata');

    const table = await client.api(tablePath).get();

    return {
      id: table.id,
      name: table.name,
      showHeaders: table.showHeaders,
      showTotals: table.showTotals,
      style: table.style,
    };
  } catch (error) {
    console.error('[getTableMetadata] Error:', error);
    throw new Error(`Failed to get table metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
