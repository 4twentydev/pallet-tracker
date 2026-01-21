'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { authenticateUser } from '@/lib/db/user-queries';

export async function login(formData: FormData) {
  const pin = formData.get('pin') as string;

  if (!pin) {
    return { error: 'PIN is required' };
  }

  const user = await authenticateUser(pin);

  if (!user) {
    return { error: 'Invalid PIN' };
  }

  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  session.role = user.role as 'admin' | 'user';
  session.isLoggedIn = true;
  await session.save();

  redirect('/');
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect('/');
}

export async function getSessionData() {
  try {
    const session = await getSession();
    return {
      isLoggedIn: session.isLoggedIn || false,
      name: session.name,
      role: session.role,
    };
  } catch (error) {
    console.error('[getSessionData] Failed to read session:', error);
    return {
      isLoggedIn: false,
      name: undefined,
      role: undefined,
    };
  }
}
