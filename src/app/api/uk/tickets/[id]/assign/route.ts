// src/app/api/uk/tickets/[id]/assign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { tickets, ticketEvents, profiles } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { notifyUser } from '@/lib/notify';

export const runtime = 'nodejs';

const bodySchema = z.object({
  assigneeId: z.string().uuid().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  if (!['uk', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { assigneeId } = parsed.data;

  // проверяем, что исполнитель существует
  if (assigneeId) {
    const [assignee] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, assigneeId));
    if (!assignee) {
      return NextResponse.json({ error: 'assignee not found' }, { status: 404 });
    }
  }

  const [updated] = await db
    .update(tickets)
    .set({ assigneeId, updatedAt: new Date() })
    .where(eq(tickets.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await db.insert(ticketEvents).values({
    ticketId: id,
    actorId: me.id,
    comment: assigneeId ? 'Назначен исполнитель' : 'Снято назначение',
  });

  if (assigneeId) {
    await notifyUser(assigneeId, `Вам назначена заявка: ${updated.title}`);
  }

  return NextResponse.json(updated);
}