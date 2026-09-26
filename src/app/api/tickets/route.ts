// src/app/api/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  tickets,
  ticketEvents,
  categories,
  residencies,
  profiles,
  premises,
  houses,
} from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { notifyUser } from '@/lib/notify';   // ← проверь имя модуля

export const runtime = 'nodejs';

// ─── Схема валидации ────────────────────────────────────────
const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  categoryId: z.number().int(),
  premiseId: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'high', 'emergency']).default('normal'),
  photos: z.array(z.string().url()).optional(),
});

// ─── GET /api/tickets ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const profile = await getProfileFromRequest();
  if (!profile) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let whereClause;
  if (profile.role === 'resident') {
    whereClause = eq(tickets.authorId, profile.id);
  } else if (profile.role === 'uk' || profile.role === 'admin') {
    whereClause = undefined;
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const finalWhere =
    status && whereClause
      ? and(whereClause, eq(tickets.status, status as any))
      : whereClause;

  const rows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      photos: tickets.photos,
      createdAt: tickets.createdAt,
      slaDeadline: tickets.slaDeadline,
      closedAt: tickets.closedAt,
      authorId: tickets.authorId,
      categoryId: tickets.categoryId,
      categoryName: categories.name,
      categoryCode: categories.code,
      premiseId: tickets.premiseId,
      premiseNumber: premises.number,
      houseAddress: houses.address,
      authorFirstName: profiles.firstName,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.categoryId, categories.id))
    .leftJoin(premises, eq(tickets.premiseId, premises.id))
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .leftJoin(profiles, eq(tickets.authorId, profiles.id))
    .where(finalWhere as any)
    .orderBy(desc(tickets.createdAt))
    .limit(50);

  return NextResponse.json(rows);
}

// ─── POST /api/tickets ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const profile = await getProfileFromRequest();
  if (!profile) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  // 1. Валидация
  const body = await req.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, categoryId, premiseId, priority, photos } =
    parsed.data;

  // 2. Проверка прав на помещение
  if (premiseId) {
    const [residency] = await db
      .select()
      .from(residencies)
      .where(
        and(
          eq(residencies.profileId, profile.id),
          eq(residencies.premiseId, premiseId)
        )
      );
    if (!residency) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // 3. Категория
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId));

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 400 });
  }

  const slaDeadline = new Date(
    Date.now() + (category.defaultSlaHours ?? 24) * 3600_000
  );

  // 4. Транзакция: тикет + событие
  const [ticket] = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(tickets)
      .values({
        authorId: profile.id,
        premiseId: premiseId ?? null,
        categoryId,
        title,
        description: description ?? null,
        photos: photos ?? null,
        priority,
        slaDeadline,
        status: 'new',
      })
      .returning();

    await tx.insert(ticketEvents).values({
      ticketId: t.id,
      actorId: profile.id,
      toStatus: 'new',
    });

    return [t];
  });

  // 5. Автоназначение исполнителя
  if (category.responsibleRole) {
    const [assignee] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.role, category.responsibleRole));

    if (assignee) {
      await db
        .update(tickets)
        .set({ assigneeId: assignee.id })
        .where(eq(tickets.id, ticket.id));
    }
  }

  // 6. Уведомление УК при аварии
  if (priority === 'emergency') {
    let address = 'не указан';
    if (premiseId) {
      const [premise] = await db
        .select({ address: houses.address })
        .from(premises)
        .leftJoin(houses, eq(premises.houseId, houses.id))
        .where(eq(premises.id, premiseId));
      if (premise?.address) address = premise.address;
    }

    const ukUsers = await db
      .select({ id: profiles.id, maxUserId: profiles.maxUserId })
      .from(profiles)
      .where(eq(profiles.role, 'uk'));

    // ⚠️ здесь зависит от сигнатуры notifyUser — см. п. 2
    for (const u of ukUsers) {
      if (u.maxUserId) {
        await notifyUser(u.maxUserId.toString(), `🚨 АВАРИЯ: ${title}\nАдрес: ${address}`);
      }
    }
  }

  // 7. Уведомление автору
  if (profile.maxUserId) {
    await notifyUser(
      profile.maxUserId.toString(),
      `Заявка «${title}» зарегистрирована. Срок — ${category.defaultSlaHours ?? 24} ч.`
    );
  }

  return NextResponse.json(ticket, { status: 201 });
}