import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSocket for development
if (process.env.NODE_ENV === 'development') {
  neonConfig.webSocketConstructor = ws;
}

// Lazy initialization of database connection
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Gets or creates a database connection
 * Uses connection pooling for optimal performance
 */
export function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const pool = new Pool({ connectionString });
    dbInstance = drizzle({ client: pool });
  }

  return dbInstance;
}

/**
 * Database instance for direct import
 * Use this in server components and API routes
 */
export const db = getDb();
