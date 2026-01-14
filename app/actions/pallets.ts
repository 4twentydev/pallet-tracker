'use server';

import { revalidatePath } from 'next/cache';
import { getPallets, updatePalletMade, bulkUpdatePalletsMade } from '@/lib/db/queries';
import type { ServerActionResult } from '@/types/pallet';

/**
 * Server Action to get all pallet data from database
 */
export async function getPalletData() {
  try {
    const data = await getPallets();
    return data;
  } catch (error) {
    console.error('Failed to read pallet data:', error);
    throw new Error('Failed to load pallet data from database.');
  }
}

/**
 * Server Action to toggle a single pallet's "Made" status
 */
export async function togglePalletStatus(
  palletId: string,
  currentStatus: boolean,
  version: string
): Promise<ServerActionResult> {
  console.log('[togglePalletStatus] Starting:', { palletId, currentStatus, version });

  try {
    const newStatus = !currentStatus;
    console.log('[togglePalletStatus] Writing new status:', newStatus);

    const data = await updatePalletMade(palletId, newStatus, version);
    console.log('[togglePalletStatus] Update successful, pallets count:', data.pallets.length);

    revalidatePath('/');
    console.log('[togglePalletStatus] Path revalidated');

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[togglePalletStatus] ERROR:', error);

    if (error instanceof Error) {
      console.error('[togglePalletStatus] Error message:', error.message);

      if (error.message.includes('not found')) {
        return {
          success: false,
          error: 'not_found',
          message: `Pallet ${palletId} could not be found.`,
        };
      }

      return {
        success: false,
        error: 'unknown',
        message: `Error: ${error.message}`,
      };
    }

    return {
      success: false,
      error: 'unknown',
      message: `Unknown error type: ${String(error)}`,
    };
  }
}

/**
 * Server Action to bulk update multiple pallets' "Made" status
 */
export async function bulkTogglePallets(
  palletIds: string[],
  makeStatus: boolean,
  version: string
): Promise<ServerActionResult> {
  try {
    const data = await bulkUpdatePalletsMade(palletIds, makeStatus, version);

    revalidatePath('/');

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Failed to bulk update pallets:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          success: false,
          error: 'not_found',
          message: error.message,
        };
      }
    }

    return {
      success: false,
      error: 'unknown',
      message: 'An unexpected error occurred while updating the pallets.',
    };
  }
}
