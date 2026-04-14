import { auth } from '@/auth';

/**
 * Get the numeric user ID from the current server-side session.
 * Returns null if not authenticated.
 */
export async function getSessionUserId(): Promise<number | null> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ? parseInt(id, 10) : null;
}
