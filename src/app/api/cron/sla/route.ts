import { NextRequest, NextResponse } from 'next/server';
import { and, eq, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { tickets, ticketEvents, ticketMessages } from '@/db/schema';
import { notifyUser, notifySlaWarning } from '@/lib/notify';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Проверка секрета
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const now = new Date();
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);

  // ── 1. Предупреждение за час до SLA ─────────────────────
  const warning = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      assigneeId: tickets.assigneeId,
      slaDeadline: tickets.slaDeadline,
    })
    .from(tickets)
    .where(
      and(
        lt(tickets.slaDeadline, in1h),
        or(
          eq(tickets.status, 'new'),
          eq(tickets.status, 'accepted'),
          eq(tickets.status, 'in_progress')
        )
      )
    );

  let warned = 0;
  for (const t of warning) {
    if (t.assigneeId) {
      await notifySlaWarning(t.assigneeId, t.title, 1);
      warned++;
    }
  }

  // ── 2. Эскалация просроченных ───────────────────────────
  const overdue = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      authorId: tickets.authorId,
      assigneeId: tickets.assigneeId,
      status: tickets.status,
    })
    .from(tickets)
    .where(
      and(
        lt(tickets.slaDeadline, now),
        ne(tickets.status, 'done'),
        ne(tickets.status, 'rejected'),
        ne(tickets.status, 'escalated')
      )
    );

  let escalated = 0;
  for (const t of overdue) {
    await db.transaction(async (tx) => {
      await tx
        .update(tickets)
        .set({ status: 'escalated', updatedAt: new Date() })
        .where(eq(tickets.id, t.id));

      await tx.insert(ticketEvents).values({
        ticketId: t.id,
        actorId: null,
        fromStatus: t.status,
        toStatus: 'escalated',
        comment: 'Автоматическая эскалация: истёк срок SLA',
      });

      await tx.insert(ticketMessages).values({
        ticketId: t.id,
        authorId: null,
        body: '⚠️ Заявка эскалирована — истёк срок реакции по SLA',
        isSystem: true,
      });
    });

    // Уведомления
    try {
      if (t.assigneeId) {
        await notifyUser(
          t.assigneeId,
          `⚠️ SLA просрочен: заявка «${t.title}»`
        );
      }
      await notifyUser(
        t.authorId,
        `⚠️ Ваша заявка «${t.title}» эскалирована — руководство УК уведомлено`
      );
    } catch (e) {
      console.error('[cron/sla] notify failed', e);
    }

    escalated++;
  }

  return NextResponse.json({ warned, escalated, at: now.toISOString() });
}