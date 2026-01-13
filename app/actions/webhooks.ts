'use server';

import { db } from '@/lib/db';
import { webhookSubscriptions } from '@/lib/db/schema';
import {
  createExcelTableSubscription,
  renewWebhookSubscription,
  deleteWebhookSubscription,
  getActiveSubscriptions,
  validateSubscription,
  autoRenewSubscriptions,
} from '@/lib/graph/webhook-subscriptions';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Server Actions for Webhook Management
 * Admin interface for managing Microsoft Graph webhook subscriptions
 */

export interface WebhookActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Gets all webhook subscriptions
 */
export async function getWebhookSubscriptions(): Promise<WebhookActionResult> {
  try {
    console.log('[getWebhookSubscriptions] Fetching subscriptions...');

    const subscriptions = await db.select().from(webhookSubscriptions);

    console.log('[getWebhookSubscriptions] Found', subscriptions.length, 'subscriptions');

    return {
      success: true,
      data: subscriptions,
    };
  } catch (error) {
    console.error('[getWebhookSubscriptions] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch subscriptions',
    };
  }
}

/**
 * Creates a new Excel webhook subscription
 */
export async function createWebhookSubscriptionAction(): Promise<WebhookActionResult> {
  try {
    console.log('[createWebhookSubscriptionAction] Creating subscription...');

    const subscription = await createExcelTableSubscription();

    console.log('[createWebhookSubscriptionAction] Subscription created:', subscription.id);

    revalidatePath('/admin/webhooks');

    return {
      success: true,
      data: subscription,
    };
  } catch (error) {
    console.error('[createWebhookSubscriptionAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription',
    };
  }
}

/**
 * Renews a webhook subscription
 */
export async function renewWebhookSubscriptionAction(subscriptionId: string): Promise<WebhookActionResult> {
  try {
    console.log('[renewWebhookSubscriptionAction] Renewing subscription:', subscriptionId);

    await renewWebhookSubscription(subscriptionId);

    revalidatePath('/admin/webhooks');

    return {
      success: true,
    };
  } catch (error) {
    console.error('[renewWebhookSubscriptionAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to renew subscription',
    };
  }
}

/**
 * Deletes a webhook subscription
 */
export async function deleteWebhookSubscriptionAction(subscriptionId: string): Promise<WebhookActionResult> {
  try {
    console.log('[deleteWebhookSubscriptionAction] Deleting subscription:', subscriptionId);

    await deleteWebhookSubscription(subscriptionId);

    revalidatePath('/admin/webhooks');

    return {
      success: true,
    };
  } catch (error) {
    console.error('[deleteWebhookSubscriptionAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete subscription',
    };
  }
}

/**
 * Validates a webhook subscription (checks if it exists in Graph API)
 */
export async function validateWebhookSubscriptionAction(subscriptionId: string): Promise<WebhookActionResult> {
  try {
    console.log('[validateWebhookSubscriptionAction] Validating subscription:', subscriptionId);

    const isValid = await validateSubscription(subscriptionId);

    return {
      success: true,
      data: { valid: isValid },
    };
  } catch (error) {
    console.error('[validateWebhookSubscriptionAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate subscription',
    };
  }
}

/**
 * Triggers auto-renewal of expiring subscriptions
 */
export async function autoRenewSubscriptionsAction(): Promise<WebhookActionResult> {
  try {
    console.log('[autoRenewSubscriptionsAction] Starting auto-renewal...');

    const result = await autoRenewSubscriptions();

    revalidatePath('/admin/webhooks');

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[autoRenewSubscriptionsAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to auto-renew subscriptions',
    };
  }
}
