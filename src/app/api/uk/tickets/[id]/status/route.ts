// src/app/api/uk/tickets/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { tickets, ticketEvents, ticketMessages } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { notifyUser } from '@/lib/notify';

export const runtime = 'nodejs';

const bodySchema = z.object({
  status: z.enum(['new', 'accepted', 'in_progress', 'done', 'rejected', 'escalated']),
  comment: z.string().max(1000).optional(),
});

const LABELS: Record<string, string> = {
  new: 'Новая',
  accepted: 'Принята',
  in_progress: 'В работе',
  done: 'Выполнена',
  rejected: 'Отклонена',
  escalated: 'Эскалирована',
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  if (!['uk', 'admin', 'contractor'].includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { status, comment } = parsed.data;

  const [ticket] = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, id));

  if (!ticket) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const closedAt = ['done', 'rejected'].includes(status) ? new Date() : null;

  const [updated] = await db.transaction(async (tx) => {
    const [t] = await tx
      .update(tickets)
      .set({ status, updatedAt: new Date(), closedAt })
      .where(eq(tickets.id, id))
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: id,
      actorId: me.id,
      fromStatus: ticket.status,
      toStatus: status,
      comment: comment ?? null,
    });

    if (comment) {
      await tx.insert(ticketMessages).values({
        ticketId: id,
        authorId: me.id,
        body: comment,
      });
    }

    return [t];
  });

  // уведомление автору
  await notifyUser(
    ticket.authorId,
    `Заявка «${ticket.title}»: ${LABELS[status]}`
  );

  return NextResponse.json(updated);
}