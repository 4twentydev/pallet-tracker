import { eq, and } from 'drizzle-orm';
import { db, pallets, type Pallet, type NewPallet } from './index';
import type { PalletTask, PalletData } from '@/types/pallet';

/**
 * Converts a database pallet to the PalletTask interface
 */
function toPalletTask(pallet: Pallet): PalletTask {
  return {
    id: `${pallet.jobNumber}::${pallet.releaseNumber}::${pallet.palletNumber}`,
    jobNumber: pallet.jobNumber,
    releaseNumber: pallet.releaseNumber,
    palletNumber: pallet.palletNumber,
    size: pallet.size || '',
    elevation: pallet.elevation || '',
    made: pallet.made,
    accList: pallet.accList || '',
    shippedDate: pallet.shippedDate || '',
    notes: pallet.notes || '',
    status: pallet.made ? 'completed' : 'pending',
  };
}

/**
 * Gets all pallet data from the database
 */
export async function getPallets(): Promise<PalletData> {
  console.log('[getPallets] Fetching all pallets from database...');

  const results = await db.select().from(pallets).orderBy(pallets.jobNumber, pallets.releaseNumber, pallets.palletNumber);

  console.log('[getPallets] Found', results.length, 'pallets');

  return {
    pallets: results.map(toPalletTask),
    metadata: {
      mtime: Date.now(),
      version: Date.now().toString(), // Use timestamp as version for optimistic locking
      readOnly: false, // Database is never read-only
    },
  };
}

/**
 * Updates the "made" status of a single pallet
 */
export async function updatePalletMade(
  palletId: string,
  made: boolean,
  expectedVersion: string
): Promise<PalletData> {
  console.log('[updatePalletMade] Updating pallet:', palletId, 'to made:', made);

  // Parse the pallet ID
  const [jobNumber, releaseNumber, palletNumber] = palletId.split('::');

  // Find and update the pallet
  const result = await db
    .update(pallets)
    .set({ made, updatedAt: new Date() })
    .where(
      and(
        eq(pallets.jobNumber, jobNumber),
        eq(pallets.releaseNumber, releaseNumber),
        eq(pallets.palletNumber, palletNumber)
      )
    )
    .returning();

  if (result.length === 0) {
    throw new Error(`Pallet ${palletId} not found`);
  }

  console.log('[updatePalletMade] Updated successfully');

  // Return fresh data
  return getPallets();
}

/**
 * Bulk updates the "made" status of multiple pallets
 */
export async function bulkUpdatePalletsMade(
  palletIds: string[],
  made: boolean,
  expectedVersion: string
): Promise<PalletData> {
  console.log('[bulkUpdatePalletsMade] Updating', palletIds.length, 'pallets to made:', made);

  // Update each pallet
  for (const palletId of palletIds) {
    const [jobNumber, releaseNumber, palletNumber] = palletId.split('::');

    await db
      .update(pallets)
      .set({ made, updatedAt: new Date() })
      .where(
        and(
          eq(pallets.jobNumber, jobNumber),
          eq(pallets.releaseNumber, releaseNumber),
          eq(pallets.palletNumber, palletNumber)
        )
      );
  }

  console.log('[bulkUpdatePalletsMade] Updated successfully');

  // Return fresh data
  return getPallets();
}

/**
 * Inserts a new pallet into the database
 */
export async function insertPallet(pallet: NewPallet): Promise<Pallet> {
  const [result] = await db.insert(pallets).values(pallet).returning();
  return result;
}

/**
 * Inserts multiple pallets (used for importing from Excel)
 */
export async function insertPallets(newPallets: NewPallet[]): Promise<void> {
  if (newPallets.length === 0) return;

  console.log('[insertPallets] Inserting', newPallets.length, 'pallets...');

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < newPallets.length; i += batchSize) {
    const batch = newPallets.slice(i, i + batchSize);
    await db.insert(pallets).values(batch);
    console.log('[insertPallets] Inserted batch', Math.floor(i / batchSize) + 1);
  }

  console.log('[insertPallets] Done');
}

/**
 * Deletes all pallets (used before re-importing)
 */
export async function deleteAllPallets(): Promise<void> {
  console.log('[deleteAllPallets] Deleting all pallets...');
  await db.delete(pallets);
  console.log('[deleteAllPallets] Done');
}
