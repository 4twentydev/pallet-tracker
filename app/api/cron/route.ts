import { NextRequest, NextResponse } from 'next/server';
import { autoRenewSubscriptions } from '@/lib/graph/webhook-subscriptions';
import { processNotificationQueue } from '@/lib/services/notifications';
import { reprocessFailedNotifications } from '@/lib/services/webhook-processor';

/**
 * Cron Job API Route
 * Handles scheduled tasks:
 * - Auto-renewal of webhook subscriptions (run every 12 hours)
 * - Processing of notification queue (run every 5 minutes)
 * - Reprocessing of failed webhook notifications (run hourly)
 *
 * Setup with Vercel Cron Jobs:
 * Add to vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron?task=renew",
 *       "schedule": "0 0,12 * * *"
 *     },
 *     {
 *       "path": "/api/cron?task=notifications",
 *       "schedule": "0,5,10,15,20,25,30,35,40,45,50,55 * * * *"
 *     },
 *     {
 *       "path": "/api/cron?task=reprocess",
 *       "schedule": "0 * * * *"
 *     }
 *   ]
 * }
 *
 * Or use external cron service (e.g., cron-job.org) to call these endpoints
 */

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const task = searchParams.get('task');

    console.log('[Cron] Running task:', task);

    switch (task) {
      case 'renew':
        // Auto-renew webhook subscriptions
        const renewResult = await autoRenewSubscriptions();
        console.log('[Cron:renew] Result:', renewResult);
        return NextResponse.json({
          task: 'renew',
          ...renewResult,
        });

      case 'notifications':
        // Process notification queue
        const notificationResult = await processNotificationQueue();
        console.log('[Cron:notifications] Result:', notificationResult);
        return NextResponse.json({
          task: 'notifications',
          ...notificationResult,
        });

      case 'reprocess':
        // Reprocess failed webhook notifications
        const reprocessResult = await reprocessFailedNotifications();
        console.log('[Cron:reprocess] Result:', reprocessResult);
        return NextResponse.json({
          task: 'reprocess',
          ...reprocessResult,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid task parameter. Use: renew, notifications, or reprocess' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
