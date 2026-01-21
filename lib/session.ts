import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId: number;
  name: string;
  role: 'admin' | 'user';
  isLoggedIn: boolean;
}

const isProduction = process.env.NODE_ENV === 'production';
const devFallbackSecret = 'dev-session-secret-change-me-please-32-chars';
const resolvedSessionSecret = process.env.SESSION_SECRET ?? (isProduction ? undefined : devFallbackSecret);

if (!resolvedSessionSecret) {
  throw new Error('SESSION_SECRET is not set. Add it to .env.local before running the app.');
}

if (!process.env.SESSION_SECRET && !isProduction) {
  console.warn('[session] SESSION_SECRET is missing. Using a development-only fallback secret.');
}

const sessionOptions = {
  password: resolvedSessionSecret,
  cookieName: 'pallet-tracker-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    throw new Error('Not authenticated');
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.role !== 'admin') {
    throw new Error('Admin access required');
  }
  return session;
}
