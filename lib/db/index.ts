import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import * as schema from './schema';

// Create drizzle instance with Vercel Postgres
export const db = drizzle(sql, { schema });

// Re-export schema for convenience
export * from './schema';
