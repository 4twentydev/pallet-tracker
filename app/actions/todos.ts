'use server';

import { db } from '@/lib/db';
import { todos, type Todo, type NewTodo } from '@/lib/db/schema';
import { eq, and, desc, or, like } from 'drizzle-orm';
import { updateExcelRow, todoToExcelRow, readExcelTableRows } from '@/lib/graph/excel-operations';
import { queueNotification } from '@/lib/services/notifications';
import { revalidatePath } from 'next/cache';

/**
 * Server Actions for Todo Management
 * Integrates with Microsoft Graph API for Excel sync
 * Uses database as source of truth with Excel as external storage
 */

export interface TodoActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Gets all todos from the database
 * Optionally filters by status, job, or search query
 */
export async function getTodos(filters?: {
  status?: 'new' | 'in_progress' | 'done';
  jobNumber?: string;
  releaseNumber?: string;
  assignedTo?: string;
  searchQuery?: string;
}): Promise<TodoActionResult<Todo[]>> {
  try {
    console.log('[getTodos] Fetching todos with filters:', filters);

    let query = db.select().from(todos).where(eq(todos.deleted, false));

    // Apply filters
    const conditions: any[] = [eq(todos.deleted, false)];

    if (filters?.status) {
      conditions.push(eq(todos.status, filters.status));
    }

    if (filters?.jobNumber) {
      conditions.push(eq(todos.jobNumber, filters.jobNumber));
    }

    if (filters?.releaseNumber) {
      conditions.push(eq(todos.releaseNumber, filters.releaseNumber));
    }

    if (filters?.assignedTo) {
      conditions.push(eq(todos.assignedTo, filters.assignedTo));
    }

    if (filters?.searchQuery) {
      const search = `%${filters.searchQuery}%`;
      conditions.push(
        or(
          like(todos.jobNumber, search),
          like(todos.releaseNumber, search),
          like(todos.palletNumber, search),
          like(todos.notes, search)
        )
      );
    }

    const results = await db
      .select()
      .from(todos)
      .where(and(...conditions))
      .orderBy(desc(todos.createdAt));

    console.log('[getTodos] Found', results.length, 'todos');

    return {
      success: true,
      data: results,
    };
  } catch (error) {
    console.error('[getTodos] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch todos',
    };
  }
}

/**
 * Gets a single todo by ID
 */
export async function getTodoById(id: string): Promise<TodoActionResult<Todo>> {
  try {
    console.log('[getTodoById] Fetching todo:', id);

    const result = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, id), eq(todos.deleted, false)))
      .limit(1);

    if (result.length === 0) {
      return {
        success: false,
        error: 'Todo not found',
      };
    }

    return {
      success: true,
      data: result[0],
    };
  } catch (error) {
    console.error('[getTodoById] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch todo',
    };
  }
}

/**
 * Updates a todo's status
 * Syncs change back to Excel via Graph API
 */
export async function updateTodoStatus(
  id: string,
  status: 'new' | 'in_progress' | 'done'
): Promise<TodoActionResult<Todo>> {
  try {
    console.log('[updateTodoStatus] Updating todo:', id, 'to status:', status);

    // Get the todo
    const todoResult = await getTodoById(id);
    if (!todoResult.success || !todoResult.data) {
      return {
        success: false,
        error: 'Todo not found',
      };
    }

    const todo = todoResult.data;

    // Update in database
    const updated = await db
      .update(todos)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(todos.id, id))
      .returning();

    if (updated.length === 0) {
      return {
        success: false,
        error: 'Failed to update todo',
      };
    }

    // Sync to Excel if we have the row ID
    if (todo.excelRowId) {
      try {
        const excelRow = todoToExcelRow(updated[0]);
        await updateExcelRow(todo.excelRowId, excelRow);
        console.log('[updateTodoStatus] Synced to Excel successfully');
      } catch (error) {
        console.error('[updateTodoStatus] Failed to sync to Excel:', error);
        // Don't fail the entire operation - database is source of truth
      }
    }

    // Queue notification
    if (todo.assignedTo) {
      await queueNotification({
        type: 'in_app',
        recipient: todo.assignedTo,
        subject: 'Task Status Updated',
        message: `Task ${todo.jobNumber}-${todo.releaseNumber}-${todo.palletNumber} status changed to ${status}`,
        todoId: todo.id,
      });
    }

    revalidatePath('/');

    return {
      success: true,
      data: updated[0],
    };
  } catch (error) {
    console.error('[updateTodoStatus] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update todo status',
    };
  }
}

/**
 * Assigns a todo to a user
 */
export async function assignTodo(id: string, assignedTo: string): Promise<TodoActionResult<Todo>> {
  try {
    console.log('[assignTodo] Assigning todo:', id, 'to:', assignedTo);

    const updated = await db
      .update(todos)
      .set({
        assignedTo,
        updatedAt: new Date(),
      })
      .where(eq(todos.id, id))
      .returning();

    if (updated.length === 0) {
      return {
        success: false,
        error: 'Todo not found',
      };
    }

    const todo = updated[0];

    // Sync to Excel
    if (todo.excelRowId) {
      try {
        const excelRow = todoToExcelRow(todo);
        await updateExcelRow(todo.excelRowId, excelRow);
      } catch (error) {
        console.error('[assignTodo] Failed to sync to Excel:', error);
      }
    }

    // Queue notification
    await queueNotification({
      type: 'in_app',
      recipient: assignedTo,
      subject: 'New Task Assigned',
      message: `You have been assigned task: ${todo.jobNumber}-${todo.releaseNumber}-${todo.palletNumber}`,
      todoId: todo.id,
    });

    revalidatePath('/');

    return {
      success: true,
      data: updated[0],
    };
  } catch (error) {
    console.error('[assignTodo] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign todo',
    };
  }
}

/**
 * Updates todo notes
 */
export async function updateTodoNotes(id: string, notes: string): Promise<TodoActionResult<Todo>> {
  try {
    console.log('[updateTodoNotes] Updating notes for todo:', id);

    const updated = await db
      .update(todos)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(eq(todos.id, id))
      .returning();

    if (updated.length === 0) {
      return {
        success: false,
        error: 'Todo not found',
      };
    }

    const todo = updated[0];

    // Sync to Excel
    if (todo.excelRowId) {
      try {
        const excelRow = todoToExcelRow(todo);
        await updateExcelRow(todo.excelRowId, excelRow);
      } catch (error) {
        console.error('[updateTodoNotes] Failed to sync to Excel:', error);
      }
    }

    revalidatePath('/');

    return {
      success: true,
      data: updated[0],
    };
  } catch (error) {
    console.error('[updateTodoNotes] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update notes',
    };
  }
}

/**
 * Triggers manual sync from Excel to database
 * Useful for initial setup or recovery
 */
export async function syncFromExcel(): Promise<TodoActionResult<{ synced: number }>> {
  try {
    console.log('[syncFromExcel] Starting manual sync...');

    // This will trigger the webhook processor logic
    // Import and use the sync logic
    const { processWebhookNotification } = await import('@/lib/services/webhook-processor');

    // Create a synthetic notification to trigger sync
    await processWebhookNotification({
      subscriptionId: 'manual-sync',
      changeType: 'updated',
      resource: 'manual',
    });

    revalidatePath('/');

    return {
      success: true,
      data: { synced: 1 },
    };
  } catch (error) {
    console.error('[syncFromExcel] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync from Excel',
    };
  }
}

/**
 * Gets todo statistics
 */
export async function getTodoStats(): Promise<
  TodoActionResult<{
    total: number;
    new: number;
    inProgress: number;
    done: number;
  }>
> {
  try {
    const allTodos = await db.select().from(todos).where(eq(todos.deleted, false));

    const stats = {
      total: allTodos.length,
      new: allTodos.filter((t) => t.status === 'new').length,
      inProgress: allTodos.filter((t) => t.status === 'in_progress').length,
      done: allTodos.filter((t) => t.status === 'done').length,
    };

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error('[getTodoStats] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    };
  }
}
