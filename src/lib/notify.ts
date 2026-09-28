import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';

async function sendMaxMessage(maxUserId: number, text: string) {
  try {
    const res = await fetch(
      `https://botapi.max.ru/messages?access_token=${process.env.MAX_BOT_TOKEN}&user_id=${maxUserId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }
    );
    if (!res.ok) {
      console.warn('[notify] MAX API failed', res.status);
    }
  } catch (e) {
    console.error('[notify] send failed', e);
  }
}

export async function notifyUser(profileId: string, text: string) {
  const [p] = await db
    .select({ maxUserId: profiles.maxUserId })
    .from(profiles)
    .where(eq(profiles.id, profileId));

  if (!p?.maxUserId) return;
  await sendMaxMessage(p.maxUserId, text);
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  accepted: 'Принята',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
  escalated: 'Эскалирована',
};

export async function notifyTicketStatusChanged(
  profileId: string,
  ticketTitle: string,
  status: string,
  comment?: string | null
) {
  let text = `📋 Заявка «${ticketTitle}»: ${STATUS_LABELS[status] ?? status}`;
  if (comment) text += `\n💬 ${comment}`;
  await notifyUser(profileId, text);
}

export async function notifyNewMessage(
  profileId: string,
  ticketTitle: string,
  author: string,
  body: string
) {
  const preview = body.length > 100 ? body.slice(0, 100) + '…' : body;
  await notifyUser(
    profileId,
    `💬 Новое сообщение по заявке «${ticketTitle}»\n${author}: ${preview}`
  );
}

export async function notifyAssigned(
  profileId: string,
  ticketTitle: string,
  address?: string
) {
  let text = `🔧 Вам назначена заявка «${ticketTitle}»`;
  if (address) text += `\n📍 ${address}`;
  await notifyUser(profileId, text);
}