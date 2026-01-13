import { pgTable, text, timestamp, boolean, uuid, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Todo Tasks Table
 * Stores tasks derived from Excel rows in OneDrive/SharePoint
 * Maps to the Excel Table structure with task_id as stable identifier
 */
export const todos = pgTable(
  'todos',
  {
    // Primary key - stable UUID that survives Excel edits
    id: uuid('id').primaryKey().defaultRandom(),

    // Task identifier from Excel (should be a UUID column in Excel)
    taskId: text('task_id').notNull().unique(),

    // Pallet information (matches existing PalletTask structure)
    jobNumber: text('job_number').notNull(),
    releaseNumber: text('release_number').notNull(),
    palletNumber: text('pallet_number').notNull(),
    size: text('size').notNull(),
    elevation: text('elevation').notNull(),

    // Task status (new / in_progress / done)
    status: text('status', { enum: ['new', 'in_progress', 'done'] }).notNull().default('new'),

    // Assignment and scheduling
    assignedTo: text('assigned_to'),
    dueDate: timestamp('due_date', { withTimezone: true }),

    // Additional fields from Excel
    accList: text('acc_list').default(''),
    shippedDate: text('shipped_date'),
    notes: text('notes').default(''),

    // Excel metadata
    excelRowId: text('excel_row_id'), // Graph API row ID for direct updates
    excelRowIndex: integer('excel_row_index'), // Row number in Excel

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    // Soft delete flag
    deleted: boolean('deleted').notNull().default(false),
  },
  (table) => ({
    // Indexes for efficient queries
    taskIdIdx: index('task_id_idx').on(table.taskId),
    statusIdx: index('status_idx').on(table.status),
    assignedToIdx: index('assigned_to_idx').on(table.assignedTo),
    jobReleaseIdx: index('job_release_idx').on(table.jobNumber, table.releaseNumber),
  })
);

/**
 * Webhook Subscriptions Table
 * Tracks active Microsoft Graph webhook subscriptions
 * Used for subscription lifecycle management (create, renew, delete)
 */
export const webhookSubscriptions = pgTable(
  'webhook_subscriptions',
  {
    // Primary key - Microsoft Graph subscription ID
    id: text('id').primaryKey(),

    // Subscription details
    resource: text('resource').notNull(), // e.g., "/me/drive/items/{item-id}/workbook/worksheets/{sheet-id}"
    changeType: text('change_type').notNull(), // e.g., "updated"
    notificationUrl: text('notification_url').notNull(),
    clientState: text('client_state').notNull(), // For verification

    // Subscription lifecycle
    expirationDateTime: timestamp('expiration_date_time', { withTimezone: true }).notNull(),
    createdDateTime: timestamp('created_date_time', { withTimezone: true }).notNull().defaultNow(),

    // Status tracking
    active: boolean('active').notNull().default(true),
    lastRenewed: timestamp('last_renewed', { withTimezone: true }),
    renewalAttempts: integer('renewal_attempts').notNull().default(0),

    // Error tracking
    lastError: text('last_error'),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  },
  (table) => ({
    // Indexes for subscription management
    activeIdx: index('active_idx').on(table.active),
    expirationIdx: index('expiration_idx').on(table.expirationDateTime),
  })
);

/**
 * Webhook Notifications Log Table
 * Stores incoming webhook notifications for debugging and audit trail
 * Helps track changes and troubleshoot issues
 */
export const webhookNotifications = pgTable(
  'webhook_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Subscription reference
    subscriptionId: text('subscription_id').notNull(),

    // Notification details
    changeType: text('change_type').notNull(),
    resource: text('resource').notNull(),
    resourceData: text('resource_data'), // JSON string of changed data

    // Processing status
    processed: boolean('processed').notNull().default(false),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),

    // Timestamps
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Indexes for querying notifications
    subscriptionIdIdx: index('subscription_id_idx').on(table.subscriptionId),
    processedIdx: index('processed_idx').on(table.processed),
    receivedAtIdx: index('received_at_idx').on(table.receivedAt),
  })
);

/**
 * Notification Queue Table
 * Stores pending notifications (SMS, email, in-app) to be sent
 * Supports retry logic and delivery tracking
 */
export const notificationQueue = pgTable(
  'notification_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Notification details
    type: text('type', { enum: ['sms', 'email', 'in_app'] }).notNull(),
    recipient: text('recipient').notNull(), // Phone number, email, or user ID
    subject: text('subject'),
    message: text('message').notNull(),

    // Related todo (optional)
    todoId: uuid('todo_id').references(() => todos.id, { onDelete: 'set null' }),

    // Delivery status
    status: text('status', { enum: ['pending', 'sent', 'failed'] }).notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  },
  (table) => ({
    // Indexes for processing queue
    statusIdx: index('notification_status_idx').on(table.status),
    nextRetryIdx: index('next_retry_idx').on(table.nextRetryAt),
  })
);

/**
 * Define relations between tables
 */
export const todosRelations = relations(todos, ({ many }) => ({
  notifications: many(notificationQueue),
}));

export const notificationQueueRelations = relations(notificationQueue, ({ one }) => ({
  todo: one(todos, {
    fields: [notificationQueue.todoId],
    references: [todos.id],
  }),
}));

/**
 * Type exports for TypeScript
 */
export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
export type WebhookNotification = typeof webhookNotifications.$inferSelect;
export type NewWebhookNotification = typeof webhookNotifications.$inferInsert;
export type NotificationQueueItem = typeof notificationQueue.$inferSelect;
export type NewNotificationQueueItem = typeof notificationQueue.$inferInsert;
