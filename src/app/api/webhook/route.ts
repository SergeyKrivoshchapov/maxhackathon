import { NextResponse } from 'next/server';
import { sendMaxMessage } from '@/lib/max-bot';
import { db } from '@/db';
import { profiles, tickets } from '@/db/schema';
import { changeTicketStatus } from '@/lib/change-ticket-status';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const secret = req.headers.get('x-max-bot-api-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { update_type } = body;

  // ─── bot_started: приветствие ───────────────────────────
  if (update_type === 'bot_started' && body.message?.chat?.id) {
    await sendMaxMessage(
      body.message.chat.id,
      'Добро пожаловать! Нажмите кнопку, чтобы подать заявку по дому.',
      [[{ text: '📝 Подать заявку', url: 'https://max.ru/your_bot?startapp=form' }]],
    );
  }

  // ─── message_callback: нажатие inline-кнопки ────────────
  if (update_type === 'message_callback' && body.callback) {
    const { callback_id, payload } = body.callback;

    // 1. Обязательно ответить на callback — иначе кнопка «зависнет»
    await fetch(`https://platform-api2.max.ru/answers?callback_id=${callback_id}`, {
      method: 'POST',
      headers: {
        Authorization: process.env.MAX_BOT_TOKEN!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notification: 'Принято' }),
    });

    // 2. Разбор payload. Формат: "take_ticket:<ticketId>" или JSON.
    //    Используем простой формат "action:ticketId".
    const [action, ticketId] = (payload ?? '').split(':');

    if (action === 'take_ticket' && ticketId) {
      // 3. Найти профиль УК по MAX user id из callback
      const maxUserId = body.callback.user?.user_id ?? body.callback.user_id;
      if (!maxUserId) {
        console.error('Webhook: no user id in callback');
        return NextResponse.json({ ok: true }); // MAX уже получил ответ
      }

      const ukProfile = await db.query.profiles.findFirst({
        where: eq(profiles.maxUserId, maxUserId),
      });

      if (!ukProfile || !['uk', 'admin'].includes(ukProfile.role)) {
        console.warn('Webhook: user is not UK/admin', maxUserId);
        return NextResponse.json({ ok: true });
      }

      // 4. Проверить, что заявка существует и ещё не в работе
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, ticketId),
      });

      if (!ticket) {
        console.warn('Webhook: ticket not found', ticketId);
        return NextResponse.json({ ok: true });
      }

      if (ticket.status !== 'new') {
        console.warn('Webhook: ticket already taken', ticketId, ticket.status);
        return NextResponse.json({ ok: true });
      }

      // 5. Назначить ответственного
      await db
        .update(tickets)
        .set({ assigneeId: ukProfile.id })
        .where(eq(tickets.id, ticketId));

      // 6. Сменить статус (внутри — запись в ticketEvents,
      //    системное сообщение и уведомление автору)
      try {
        await changeTicketStatus(
          ticketId,
          'in_progress',
          ukProfile.id,
          `Взял в работу: ${ukProfile.firstName ?? 'сотрудник УК'}`,
        );
      } catch (e) {
        console.error('changeTicketStatus failed:', e);
      }
    }
  }

  // MAX требует ответ 200 в течение 30 секунд
  return NextResponse.json({ ok: true });
}
