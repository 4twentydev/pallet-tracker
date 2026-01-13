import { z } from 'zod';

/**
 * Environment variable validation schema
 * Ensures all required configuration is present at runtime
 */
const envSchema = z.object({
  // Microsoft Graph API
  MICROSOFT_CLIENT_ID: z.string().min(1, 'Microsoft Client ID is required'),
  MICROSOFT_CLIENT_SECRET: z.string().min(1, 'Microsoft Client Secret is required'),
  MICROSOFT_TENANT_ID: z.string().min(1, 'Microsoft Tenant ID is required'),

  // Excel Configuration
  EXCEL_ITEM_PATH: z.string().optional(),
  EXCEL_WORKBOOK_ID: z.string().min(1, 'Excel Workbook ID is required'),
  EXCEL_WORKSHEET_NAME: z.string().default('PalletTracker'),
  EXCEL_TABLE_NAME: z.string().default('PalletTable'),

  // Webhook Configuration
  WEBHOOK_CLIENT_STATE: z.string().min(1, 'Webhook client state is required for verification'),
  WEBHOOK_NOTIFICATION_URL: z.string().url('Webhook notification URL must be a valid URL'),

  // Database
  DATABASE_URL: z.string().url('Database URL must be a valid connection string'),

  // Notification (Optional)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url('App URL must be a valid URL'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type Env = z.infer<typeof envSchema>;

/**
 * Validates and returns typed environment variables
 * Throws if validation fails
 */
export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

/**
 * Validated environment variables singleton
 * Import this to access typed env vars throughout the app
 */
export const env = getEnv();
