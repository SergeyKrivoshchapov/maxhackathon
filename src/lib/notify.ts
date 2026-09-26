// src/lib/notify.ts
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';

export async function notifyUser(profileId: string, text: string) {
  const [p] = await db
    .select({ maxUserId: profiles.maxUserId })
    .from(profiles)
    .where(eq(profiles.id, profileId));

  if (!p) return;

  try {
    await fetch(
      `https://botapi.max.ru/messages?access_token=${process.env.MAX_BOT_TOKEN}&user_id=${p.maxUserId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }
    );
  } catch (e) {
    console.error('notify error', e);
  }
}