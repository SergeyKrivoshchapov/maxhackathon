import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';

// ─── Низкоуровневая отправка в MAX по maxUserId ────────────
async function sendMaxMessage(maxUserId: number, text: string) {
  if (!process.env.MAX_BOT_TOKEN) {
    console.warn('[notify] MAX_BOT_TOKEN not set');
    return;
  }

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
      const body = await res.text().catch(() => '');
      console.warn('[notify] MAX API failed', res.status, body);
    }
  } catch (e) {
    console.error('[notify] send failed', e);
  }
}

// ─── Публичная функция: принимает profileId (UUID) ─────────
export async function notifyUser(profileId: string, text: string) {
  if (!profileId) return;

  // защита от случайной передачи maxUserId вместо profileId
  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId);

  if (!looksLikeUuid) {
    console.error(
      '[notify] BUG: notifyUser called with non-UUID:',
      profileId,
      '— should be profileId, not maxUserId'
    );
    return;
  }

  const [p] = await db
    .select({ maxUserId: profiles.maxUserId })
    .from(profiles)
    .where(eq(profiles.id, profileId));

  if (!p?.maxUserId) return;
  await sendMaxMessage(p.maxUserId, text);
}

// ─── Прямая отправка по maxUserId (когда он уже есть) ──────
export async function notifyMaxUserId(maxUserId: number, text: string) {
  if (!maxUserId || maxUserId <= 0) return;
  await sendMaxMessage(maxUserId, text);
}

// ─── Шаблоны ───────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  accepted: 'Принята',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
  escalated: 'Эскалирована',
};

export async function notifyTicketCreated(
  profileId: string,
  ticketTitle: string,
  slaHours: number
) {
  await notifyUser(
    profileId,
    `✅ Заявка «${ticketTitle}» зарегистрирована. Срок — ${slaHours} ч.`
  );
}

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