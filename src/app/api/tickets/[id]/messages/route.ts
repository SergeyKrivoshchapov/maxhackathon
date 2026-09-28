// src/app/api/tickets/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tickets, ticketMessages, profiles } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { notifyNewMessage } from '@/lib/notify';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Автор
  const profile = await getProfileFromRequest();
  if (!profile) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  // 2. Валидация тела
  const json = await req.json();
  const body: string = (json?.body ?? '').trim();
  const attachments: string[] = Array.isArray(json?.attachments) ? json.attachments : [];

  if (!body) {
    return NextResponse.json({ error: 'body required' }, { status: 400 });
  }

  // 3. Проверить доступ к заявке
  const [ticket] = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      authorId: tickets.authorId,
      assigneeId: tickets.assigneeId,
      status: tickets.status,
    })
    .from(tickets)
    .where(eq(tickets.id, id));

  if (!ticket) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const isAuthor = ticket.authorId === profile.id;
  const isStaff = ['uk', 'admin', 'contractor'].includes(profile.role);

  if (!isAuthor && !isStaff) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (ticket.status === 'done' || ticket.status === 'rejected') {
    return NextResponse.json({ error: 'ticket closed' }, { status: 409 });
  }

  // 4. Сохранить сообщение
  const [msg] = await db
    .insert(ticketMessages)
    .values({
      ticketId: id,
      authorId: profile.id,
      body,
      attachments,
    })
    .returning();

  // 5. Уведомить вторую сторону
  try {
    if (isAuthor) {
      // житель написал → уведомить исполнителя или УК
      const recipientId = ticket.assigneeId ?? null;
      if (recipientId && recipientId !== profile.id) {
        await notifyNewMessage(
          recipientId,
          ticket.title,
          profile.firstName ?? 'Житель',
          body
        );
      }
    } else {
      // УК ответила → уведомить автора
      if (ticket.authorId !== profile.id) {
        await notifyNewMessage(
          ticket.authorId,
          ticket.title,
          profile.firstName ?? 'УК',
          body
        );
      }
    }
  } catch (e) {
    console.error('[messages] notify failed', e);
    // не ломаем ответ — сообщение сохранено
  }

  return NextResponse.json(msg, { status: 201 });
}