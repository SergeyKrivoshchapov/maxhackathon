// src/app/api/uk/tickets/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tickets, ticketEvents, ticketMessages } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { notifyTicketStatusChanged } from '@/lib/notify';

export const runtime = 'nodejs';

const statusSchema = z.object({
  status: z.enum(['accepted', 'in_progress', 'done', 'rejected', 'escalated']),
  comment: z.string().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Авторизация — функция БЕЗ аргументов
  const profile = await getProfileFromRequest();
  if (!profile) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  // 2. Роль
  if (!['uk', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 3. Валидация
  const parsed = statusSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { status, comment } = parsed.data;

  // 4. Загрузить заявку
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, id));

  if (!ticket) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // 5. Обновление в транзакции: статус + событие + сообщение
  const closedAt = ['done', 'rejected'].includes(status) ? new Date() : null;

  const [updated] = await db.transaction(async (tx) => {
    const [t] = await tx
      .update(tickets)
      .set({ status, updatedAt: new Date(), closedAt })
      .where(eq(tickets.id, id))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: id,
      actorId: profile.id,
      fromStatus: ticket.status,
      toStatus: status,
      comment: comment ?? null,
    });

    if (comment) {
      await tx.insert(ticketMessages).values({
        ticketId: id,
        authorId: profile.id,
        body: comment,
      });
    }

    return [t];
  });

  // 6. Уведомление автору в MAX
  try {
    await notifyTicketStatusChanged(ticket.authorId, ticket.title, status, comment);
  } catch (e) {
    console.error('[notify] failed', e);
  }

  return NextResponse.json(updated);
}