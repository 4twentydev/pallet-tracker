import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { webhookNotifications } from '@/lib/db/schema';
import { processWebhookNotification } from '@/lib/services/webhook-processor';

/**
 * Microsoft Graph Webhook Endpoint
 * Handles both validation requests and notification callbacks
 *
 * Validation Flow:
 * 1. Microsoft sends GET request with validationToken
 * 2. We respond with the token in plain text (200 OK)
 *
 * Notification Flow:
 * 1. Microsoft sends POST request with change notifications
 * 2. We validate the clientState
 * 3. We process the notifications asynchronously
 * 4. We respond 202 Accepted immediately
 *
 * See: https://learn.microsoft.com/en-us/graph/webhooks
 */

/**
 * GET handler for webhook validation
 * Microsoft Graph sends this during subscription creation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const validationToken = searchParams.get('validationToken');

    if (!validationToken) {
      console.error('[Webhook:GET] No validation token provided');
      return NextResponse.json({ error: 'Missing validation token' }, { status: 400 });
    }

    console.log('[Webhook:GET] Validation request received');

    // Respond with the validation token in plain text
    // This is required by Microsoft Graph API
    return new NextResponse(validationToken, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error('[Webhook:GET] Validation error:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}

/**
 * POST handler for webhook notifications
 * Microsoft Graph sends this when subscribed resources change
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[Webhook:POST] Received notification');

    // Validate the request has notifications
    if (!body.value || !Array.isArray(body.value)) {
      console.error('[Webhook:POST] Invalid notification format');
      return NextResponse.json({ error: 'Invalid notification format' }, { status: 400 });
    }

    const notifications = body.value;
    console.log('[Webhook:POST] Processing', notifications.length, 'notifications');

    // Validate clientState for each notification
    const clientState = process.env.WEBHOOK_CLIENT_STATE;
    if (!clientState) {
      console.error('[Webhook:POST] WEBHOOK_CLIENT_STATE not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Process each notification
    const processingPromises = notifications.map(async (notification: any) => {
      try {
        // Validate clientState
        if (notification.clientState !== clientState) {
          console.error('[Webhook:POST] Invalid clientState for notification:', notification.subscriptionId);
          return;
        }

        console.log('[Webhook:POST] Valid notification:', {
          subscriptionId: notification.subscriptionId,
          resource: notification.resource,
          changeType: notification.changeType,
        });

        // Store notification in database
        await db.insert(webhookNotifications).values({
          subscriptionId: notification.subscriptionId,
          changeType: notification.changeType,
          resource: notification.resource,
          resourceData: JSON.stringify(notification.resourceData || {}),
          processed: false,
        });

        // Process notification asynchronously (don't await)
        // This ensures we respond to Microsoft quickly (< 3 seconds)
        processWebhookNotification(notification).catch((error) => {
          console.error('[Webhook:POST] Error processing notification:', error);
        });
      } catch (error) {
        console.error('[Webhook:POST] Error handling notification:', error);
      }
    });

    // Wait for all notifications to be stored (but not processed)
    await Promise.all(processingPromises);

    console.log('[Webhook:POST] Notifications stored, responding 202');

    // Respond with 202 Accepted immediately
    // Microsoft Graph requires response within 3 seconds
    return NextResponse.json({ status: 'accepted' }, { status: 202 });
  } catch (error) {
    console.error('[Webhook:POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
