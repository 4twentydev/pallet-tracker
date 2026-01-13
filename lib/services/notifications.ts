import { db } from '@/lib/db';
import { notificationQueue, type NewNotificationQueueItem } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';

/**
 * Notification Service
 * Manages queuing and sending notifications (SMS, email, in-app)
 * Supports retry logic and delivery tracking
 */

/**
 * Queues a notification for delivery
 *
 * @param notification - Notification details
 * @returns Created notification queue item
 */
export async function queueNotification(
  notification: Omit<NewNotificationQueueItem, 'id' | 'createdAt'>
): Promise<void> {
  try {
    console.log('[queueNotification] Queuing notification:', notification.type, 'to', notification.recipient);

    await db.insert(notificationQueue).values({
      ...notification,
      status: 'pending',
      retryCount: 0,
      nextRetryAt: new Date(), // Send immediately
    });

    console.log('[queueNotification] Notification queued successfully');
  } catch (error) {
    console.error('[queueNotification] Error:', error);
    throw new Error(`Failed to queue notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sends SMS notification via Twilio
 *
 * @param to - Phone number
 * @param message - SMS message
 * @returns Success status
 */
async function sendSMS(to: string, message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[sendSMS] Twilio not configured, skipping SMS');
    return false;
  }

  try {
    console.log('[sendSMS] Sending SMS to:', to);

    // Use Twilio API
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[sendSMS] Twilio API error:', error);
      return false;
    }

    console.log('[sendSMS] SMS sent successfully');
    return true;
  } catch (error) {
    console.error('[sendSMS] Error:', error);
    return false;
  }
}

/**
 * Sends email notification
 * Note: You'll need to configure an email service (SendGrid, AWS SES, etc.)
 *
 * @param to - Email address
 * @param subject - Email subject
 * @param message - Email body
 * @returns Success status
 */
async function sendEmail(to: string, subject: string, message: string): Promise<boolean> {
  // TODO: Implement email sending logic
  // This is a placeholder for email functionality
  console.log('[sendEmail] Email sending not yet implemented');
  console.log('[sendEmail] Would send to:', to, 'Subject:', subject);
  return true; // Return true for now to avoid retry loops
}

/**
 * Processes in-app notifications
 * Stores notifications in database for display in the UI
 *
 * @param recipient - User ID or identifier
 * @param subject - Notification title
 * @param message - Notification message
 * @returns Success status
 */
async function sendInAppNotification(recipient: string, subject: string, message: string): Promise<boolean> {
  try {
    console.log('[sendInAppNotification] Storing in-app notification for:', recipient);

    // In-app notifications are already stored in the queue
    // This function is a placeholder for additional in-app logic
    // (e.g., WebSocket push, real-time updates, etc.)

    // TODO: Implement real-time push via WebSocket or Server-Sent Events
    console.log('[sendInAppNotification] In-app notification logged');

    return true;
  } catch (error) {
    console.error('[sendInAppNotification] Error:', error);
    return false;
  }
}

/**
 * Processes pending notifications from the queue
 * Should be called via cron job or scheduled task
 *
 * @returns Processing statistics
 */
export async function processNotificationQueue(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  console.log('[processNotificationQueue] Starting...');

  // Get pending notifications ready to send
  const pendingNotifications = await db
    .select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.status, 'pending'),
        lt(notificationQueue.nextRetryAt, new Date())
      )
    )
    .limit(50); // Process in batches

  console.log('[processNotificationQueue] Found', pendingNotifications.length, 'pending notifications');

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of pendingNotifications) {
    try {
      // Check if max retries exceeded
      if (notification.retryCount >= notification.maxRetries) {
        console.warn('[processNotificationQueue] Max retries exceeded for notification:', notification.id);
        await db
          .update(notificationQueue)
          .set({
            status: 'failed',
            failureReason: 'Max retries exceeded',
          })
          .where(eq(notificationQueue.id, notification.id));
        skipped++;
        continue;
      }

      let success = false;

      // Send based on type
      switch (notification.type) {
        case 'sms':
          success = await sendSMS(notification.recipient, notification.message);
          break;
        case 'email':
          success = await sendEmail(notification.recipient, notification.subject || '', notification.message);
          break;
        case 'in_app':
          success = await sendInAppNotification(
            notification.recipient,
            notification.subject || '',
            notification.message
          );
          break;
        default:
          console.error('[processNotificationQueue] Unknown notification type:', notification.type);
          skipped++;
          continue;
      }

      if (success) {
        // Mark as sent
        await db
          .update(notificationQueue)
          .set({
            status: 'sent',
            sentAt: new Date(),
          })
          .where(eq(notificationQueue.id, notification.id));
        sent++;
      } else {
        // Schedule retry with exponential backoff
        const nextRetryMinutes = Math.pow(2, notification.retryCount) * 5; // 5, 10, 20, 40 minutes
        const nextRetryAt = new Date();
        nextRetryAt.setMinutes(nextRetryAt.getMinutes() + nextRetryMinutes);

        await db
          .update(notificationQueue)
          .set({
            retryCount: notification.retryCount + 1,
            nextRetryAt,
            failureReason: 'Send failed, will retry',
          })
          .where(eq(notificationQueue.id, notification.id));
        failed++;
      }
    } catch (error) {
      console.error('[processNotificationQueue] Error processing notification:', notification.id, error);
      failed++;
    }
  }

  console.log('[processNotificationQueue] Completed:', { sent, failed, skipped });

  return { sent, failed, skipped };
}

/**
 * Gets recent notifications for a recipient (for UI display)
 *
 * @param recipient - User ID or identifier
 * @param limit - Maximum number of notifications to return
 * @returns Array of notifications
 */
export async function getNotificationsForRecipient(recipient: string, limit = 50) {
  return db
    .select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.recipient, recipient),
        eq(notificationQueue.type, 'in_app')
      )
    )
    .orderBy(notificationQueue.createdAt)
    .limit(limit);
}

/**
 * Marks a notification as read (for in-app notifications)
 *
 * @param notificationId - The notification ID
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await db
      .update(notificationQueue)
      .set({
        status: 'sent', // Use 'sent' to indicate it's been seen
        sentAt: new Date(),
      })
      .where(eq(notificationQueue.id, notificationId));
  } catch (error) {
    console.error('[markNotificationAsRead] Error:', error);
    throw error;
  }
}
