import { db } from '@/lib/db';
import { todos, webhookNotifications, type NewTodo } from '@/lib/db/schema';
import { readExcelTableRows, excelRowToTodo } from '@/lib/graph/excel-operations';
import { eq, and } from 'drizzle-orm';
import { queueNotification } from './notifications';

/**
 * Webhook Notification Processor
 * Handles processing of Microsoft Graph webhook notifications
 * Fetches changed Excel rows and syncs with database
 */

interface WebhookNotification {
  subscriptionId: string;
  changeType: string;
  resource: string;
  resourceData?: {
    '@odata.type': string;
    '@odata.id': string;
    id?: string;
  };
}

/**
 * Processes a webhook notification
 * Fetches the changed Excel data and updates the database
 *
 * @param notification - The webhook notification from Microsoft Graph
 */
export async function processWebhookNotification(notification: WebhookNotification): Promise<void> {
  console.log('[processWebhookNotification] Starting:', notification.subscriptionId);

  try {
    // Fetch all rows from Excel Table
    // Note: Graph API doesn't provide row-level change detection,
    // so we need to fetch and compare all rows
    console.log('[processWebhookNotification] Fetching Excel rows...');
    const excelRows = await readExcelTableRows();
    console.log('[processWebhookNotification] Fetched', excelRows.length, 'rows from Excel');

    // Get existing todos from database
    const existingTodos = await db
      .select()
      .from(todos)
      .where(eq(todos.deleted, false));

    console.log('[processWebhookNotification] Found', existingTodos.length, 'existing todos in DB');

    // Create maps for efficient lookup
    const existingTodosByTaskId = new Map(existingTodos.map((t) => [t.taskId, t]));
    const excelRowsByTaskId = new Map();

    // Process each Excel row
    const newTodos: NewTodo[] = [];
    const updatedTodos: Array<{ taskId: string; data: Partial<NewTodo> }> = [];

    for (const excelRow of excelRows) {
      try {
        const todoData = excelRowToTodo(excelRow);

        // Skip rows without taskId (invalid data)
        if (!todoData.taskId) {
          console.warn('[processWebhookNotification] Skipping row without taskId:', excelRow.index);
          continue;
        }

        excelRowsByTaskId.set(todoData.taskId, true);

        const existing = existingTodosByTaskId.get(todoData.taskId);

        if (existing) {
          // Check if data has changed
          const hasChanges =
            existing.jobNumber !== todoData.jobNumber ||
            existing.releaseNumber !== todoData.releaseNumber ||
            existing.palletNumber !== todoData.palletNumber ||
            existing.size !== todoData.size ||
            existing.elevation !== todoData.elevation ||
            existing.status !== todoData.status ||
            existing.assignedTo !== todoData.assignedTo ||
            existing.accList !== todoData.accList ||
            existing.shippedDate !== todoData.shippedDate ||
            existing.notes !== todoData.notes;

          if (hasChanges) {
            console.log('[processWebhookNotification] Detected changes for todo:', todoData.taskId);
            updatedTodos.push({
              taskId: todoData.taskId,
              data: {
                ...todoData,
                updatedAt: new Date(),
              },
            });

            // Queue notification if status changed or assigned
            if (existing.status !== todoData.status && todoData.status === 'in_progress') {
              await queueNotification({
                type: 'in_app',
                recipient: todoData.assignedTo || 'admin',
                subject: 'Task Started',
                message: `Task ${todoData.jobNumber}-${todoData.releaseNumber}-${todoData.palletNumber} is now in progress`,
                todoId: existing.id,
              });
            }

            if (existing.status !== todoData.status && todoData.status === 'done') {
              await queueNotification({
                type: 'in_app',
                recipient: todoData.assignedTo || 'admin',
                subject: 'Task Completed',
                message: `Task ${todoData.jobNumber}-${todoData.releaseNumber}-${todoData.palletNumber} is completed`,
                todoId: existing.id,
              });
            }
          }
        } else {
          // New todo
          console.log('[processWebhookNotification] New todo detected:', todoData.taskId);
          newTodos.push(todoData);

          // Queue notification for new task
          if (todoData.assignedTo) {
            // Will be added after insertion
          }
        }
      } catch (error) {
        console.error('[processWebhookNotification] Error processing row:', excelRow.index, error);
      }
    }

    // Find deleted todos (exist in DB but not in Excel)
    const deletedTodoIds = existingTodos
      .filter((t) => !excelRowsByTaskId.has(t.taskId))
      .map((t) => t.id);

    console.log('[processWebhookNotification] Summary:', {
      new: newTodos.length,
      updated: updatedTodos.length,
      deleted: deletedTodoIds.length,
    });

    // Apply changes to database
    // 1. Insert new todos
    if (newTodos.length > 0) {
      console.log('[processWebhookNotification] Inserting', newTodos.length, 'new todos');
      const insertedTodos = await db.insert(todos).values(newTodos).returning();

      // Queue notifications for newly assigned tasks
      for (const todo of insertedTodos) {
        if (todo.assignedTo) {
          await queueNotification({
            type: 'in_app',
            recipient: todo.assignedTo,
            subject: 'New Task Assigned',
            message: `You have been assigned task: ${todo.jobNumber}-${todo.releaseNumber}-${todo.palletNumber}`,
            todoId: todo.id,
          });
        }
      }
    }

    // 2. Update existing todos
    if (updatedTodos.length > 0) {
      console.log('[processWebhookNotification] Updating', updatedTodos.length, 'todos');
      for (const update of updatedTodos) {
        await db.update(todos).set(update.data).where(eq(todos.taskId, update.taskId));
      }
    }

    // 3. Soft delete removed todos
    if (deletedTodoIds.length > 0) {
      console.log('[processWebhookNotification] Soft deleting', deletedTodoIds.length, 'todos');
      for (const todoId of deletedTodoIds) {
        await db
          .update(todos)
          .set({ deleted: true, updatedAt: new Date() })
          .where(eq(todos.id, todoId));
      }
    }

    // Mark notification as processed
    await db
      .update(webhookNotifications)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(
        and(
          eq(webhookNotifications.subscriptionId, notification.subscriptionId),
          eq(webhookNotifications.processed, false)
        )
      );

    console.log('[processWebhookNotification] Completed successfully');
  } catch (error) {
    console.error('[processWebhookNotification] Error:', error);

    // Mark notification as failed
    await db
      .update(webhookNotifications)
      .set({
        processingError: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(
        and(
          eq(webhookNotifications.subscriptionId, notification.subscriptionId),
          eq(webhookNotifications.processed, false)
        )
      );

    throw error;
  }
}

/**
 * Reprocesses failed notifications
 * Can be called via cron job or admin trigger
 */
export async function reprocessFailedNotifications(): Promise<{
  processed: number;
  failed: number;
}> {
  console.log('[reprocessFailedNotifications] Starting...');

  const failedNotifications = await db
    .select()
    .from(webhookNotifications)
    .where(
      and(
        eq(webhookNotifications.processed, false),
        // Only retry notifications with errors (not pending ones)
        eq(webhookNotifications.processingError, '')
      )
    )
    .limit(100); // Process in batches

  console.log('[reprocessFailedNotifications] Found', failedNotifications.length, 'failed notifications');

  let processed = 0;
  let failed = 0;

  for (const notification of failedNotifications) {
    try {
      await processWebhookNotification({
        subscriptionId: notification.subscriptionId,
        changeType: notification.changeType,
        resource: notification.resource,
        resourceData: notification.resourceData ? JSON.parse(notification.resourceData) : undefined,
      });
      processed++;
    } catch (error) {
      console.error('[reprocessFailedNotifications] Failed to reprocess:', notification.id);
      failed++;
    }
  }

  console.log('[reprocessFailedNotifications] Completed:', { processed, failed });

  return { processed, failed };
}
