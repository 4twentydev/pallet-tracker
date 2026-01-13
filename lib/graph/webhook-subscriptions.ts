import { getGraphClient } from './client';
import { db } from '@/lib/db';
import { webhookSubscriptions, type NewWebhookSubscription } from '@/lib/db/schema';
import { eq, lt, and } from 'drizzle-orm';

/**
 * Microsoft Graph Webhook Subscription Management
 * Handles creation, renewal, and deletion of webhook subscriptions
 * Monitors Excel workbook/worksheet/table changes in real-time
 */

export interface WebhookSubscriptionConfig {
  resource: string; // e.g., "/me/drive/items/{item-id}/workbook/worksheets/{sheet-id}"
  changeType: 'updated' | 'created' | 'deleted'; // Usually 'updated' for Excel
  expirationMinutes?: number; // Default: 4230 (3 days) - Graph API maximum
}

/**
 * Creates a new webhook subscription for Excel changes
 * Registers with Microsoft Graph and stores in database
 *
 * @param config - Subscription configuration
 * @returns Created subscription details
 */
export async function createWebhookSubscription(
  config: WebhookSubscriptionConfig
): Promise<NewWebhookSubscription> {
  try {
    const client = getGraphClient();

    const notificationUrl = process.env.WEBHOOK_NOTIFICATION_URL;
    const clientState = process.env.WEBHOOK_CLIENT_STATE;

    if (!notificationUrl || !clientState) {
      throw new Error('Webhook configuration missing in environment variables');
    }

    // Calculate expiration (max 3 days for Excel)
    const expirationMinutes = config.expirationMinutes || 4230; // 3 days
    const expirationDateTime = new Date();
    expirationDateTime.setMinutes(expirationDateTime.getMinutes() + expirationMinutes);

    console.log('[createWebhookSubscription] Creating subscription for:', config.resource);

    // Create subscription via Graph API
    const subscription = await client.api('/subscriptions').post({
      changeType: config.changeType,
      notificationUrl,
      resource: config.resource,
      expirationDateTime: expirationDateTime.toISOString(),
      clientState,
    });

    console.log('[createWebhookSubscription] Subscription created:', subscription.id);

    // Store in database
    const dbSubscription: NewWebhookSubscription = {
      id: subscription.id,
      resource: config.resource,
      changeType: config.changeType,
      notificationUrl,
      clientState,
      expirationDateTime: new Date(subscription.expirationDateTime),
      active: true,
    };

    await db.insert(webhookSubscriptions).values(dbSubscription);

    console.log('[createWebhookSubscription] Subscription saved to database');

    return dbSubscription;
  } catch (error) {
    console.error('[createWebhookSubscription] Error:', error);
    throw new Error(
      `Failed to create webhook subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Renews an existing webhook subscription
 * Should be called before expiration (recommended: 1 day before)
 *
 * @param subscriptionId - The subscription ID to renew
 * @returns Updated subscription details
 */
export async function renewWebhookSubscription(subscriptionId: string): Promise<boolean> {
  try {
    const client = getGraphClient();

    // Calculate new expiration (3 days from now)
    const expirationDateTime = new Date();
    expirationDateTime.setMinutes(expirationDateTime.getMinutes() + 4230);

    console.log('[renewWebhookSubscription] Renewing subscription:', subscriptionId);

    // Renew via Graph API
    await client.api(`/subscriptions/${subscriptionId}`).patch({
      expirationDateTime: expirationDateTime.toISOString(),
    });

    console.log('[renewWebhookSubscription] Subscription renewed');

    // Update database
    await db
      .update(webhookSubscriptions)
      .set({
        expirationDateTime,
        lastRenewed: new Date(),
        renewalAttempts: 0,
        lastError: null,
        lastErrorAt: null,
      })
      .where(eq(webhookSubscriptions.id, subscriptionId));

    console.log('[renewWebhookSubscription] Database updated');

    return true;
  } catch (error) {
    console.error('[renewWebhookSubscription] Error:', error);

    // Update error tracking
    await db
      .update(webhookSubscriptions)
      .set({
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastErrorAt: new Date(),
        renewalAttempts: db.$count(webhookSubscriptions.renewalAttempts) + 1,
      })
      .where(eq(webhookSubscriptions.id, subscriptionId));

    throw new Error(
      `Failed to renew webhook subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Deletes a webhook subscription
 * Removes from both Graph API and database
 *
 * @param subscriptionId - The subscription ID to delete
 * @returns Success status
 */
export async function deleteWebhookSubscription(subscriptionId: string): Promise<boolean> {
  try {
    const client = getGraphClient();

    console.log('[deleteWebhookSubscription] Deleting subscription:', subscriptionId);

    // Delete from Graph API
    await client.api(`/subscriptions/${subscriptionId}`).delete();

    console.log('[deleteWebhookSubscription] Subscription deleted from Graph API');

    // Mark as inactive in database (keep for audit trail)
    await db
      .update(webhookSubscriptions)
      .set({ active: false })
      .where(eq(webhookSubscriptions.id, subscriptionId));

    console.log('[deleteWebhookSubscription] Database updated');

    return true;
  } catch (error) {
    console.error('[deleteWebhookSubscription] Error:', error);
    throw new Error(
      `Failed to delete webhook subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets all active subscriptions from database
 */
export async function getActiveSubscriptions() {
  return db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions.active, true));
}

/**
 * Gets subscriptions expiring soon (within 24 hours)
 * Used by renewal job
 */
export async function getSubscriptionsExpiringSoon() {
  const twentyFourHoursFromNow = new Date();
  twentyFourHoursFromNow.setHours(twentyFourHoursFromNow.getHours() + 24);

  return db
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.active, true),
        lt(webhookSubscriptions.expirationDateTime, twentyFourHoursFromNow)
      )
    );
}

/**
 * Creates subscription for Excel Table changes
 * Convenience method for the most common use case
 */
export async function createExcelTableSubscription(): Promise<NewWebhookSubscription> {
  const workbookId = process.env.EXCEL_WORKBOOK_ID;
  const worksheetName = process.env.EXCEL_WORKSHEET_NAME || 'PalletTracker';

  if (!workbookId) {
    throw new Error('EXCEL_WORKBOOK_ID is not configured');
  }

  // Subscribe to worksheet changes (includes table updates)
  const resource = `/me/drive/items/${workbookId}/workbook/worksheets('${worksheetName}')`;

  return createWebhookSubscription({
    resource,
    changeType: 'updated',
  });
}

/**
 * Automatic subscription renewal job
 * Should be run via cron job or scheduled task
 * Renews subscriptions expiring within 24 hours
 */
export async function autoRenewSubscriptions(): Promise<{
  renewed: number;
  failed: number;
  errors: string[];
}> {
  console.log('[autoRenewSubscriptions] Starting auto-renewal job');

  const subscriptions = await getSubscriptionsExpiringSoon();
  console.log('[autoRenewSubscriptions] Found', subscriptions.length, 'subscriptions to renew');

  let renewed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const subscription of subscriptions) {
    try {
      await renewWebhookSubscription(subscription.id);
      renewed++;
    } catch (error) {
      failed++;
      errors.push(`${subscription.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('[autoRenewSubscriptions] Completed:', { renewed, failed });

  return { renewed, failed, errors };
}

/**
 * Validates that a subscription still exists in Graph API
 * Useful for debugging and reconciliation
 */
export async function validateSubscription(subscriptionId: string): Promise<boolean> {
  try {
    const client = getGraphClient();
    await client.api(`/subscriptions/${subscriptionId}`).get();
    return true;
  } catch (error) {
    console.error('[validateSubscription] Subscription not found:', subscriptionId);
    return false;
  }
}
