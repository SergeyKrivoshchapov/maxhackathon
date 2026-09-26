import { NextResponse } from 'next/server';
import { z } from 'zod';
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
import { notifyUser } from '@/lib/max-bot';
import { and, desc, eq } from 'drizzle-orm';

// ─── Схема валидации входных данных ────────────────────────
const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  categoryId: z.number().int(),
  premiseId: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'high', 'emergency']).default('normal'),
  photos: z.array(z.string().url()).optional(),
});

// ─── GET /api/tickets — список заявок ──────────────────────
export async function GET(req: Request) {
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { profile } = auth;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  // Разграничение доступа по роли
  let whereClause;
  if (profile.role === 'resident') {
    // Житель видит только свои заявки
    whereClause = eq(tickets.authorId, profile.id);
  } else if (profile.role === 'uk' || profile.role === 'admin') {
    // УК/админ видят все заявки (для MVP).
    // Для продакшена — фильтр по домам, которые обслуживает УК.
    whereClause = undefined;
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const list = await db.query.tickets.findMany({
    where:
      status && whereClause
        ? and(whereClause, eq(tickets.status, status as any))
        : whereClause,
    orderBy: desc(tickets.createdAt),
    limit: 50,
    with: {
      category: true,
      premise: { with: { house: true } },
      author: true,
    },
  });

  return NextResponse.json(list);
}

// ─── POST /api/tickets — создание заявки ───────────────────
export async function POST(req: Request) {
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { profile } = auth;

  // 1. Валидация тела запроса
  const body = await req.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { title, description, categoryId, premiseId, priority, photos } =
    parsed.data;

  // 2. Проверка прав на помещение (если указано)
  if (premiseId) {
    const residency = await db.query.residencies.findFirst({
      where: and(
        eq(residencies.profileId, profile.id),
        eq(residencies.premiseId, premiseId),
      ),
    });
    if (!residency) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // 3. Получение категории для расчёта SLA и ответственной роли
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
  });
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 400 });
  }

  const slaDeadline = new Date(
    Date.now() + (category.defaultSlaHours ?? 24) * 3600_000,
  );

  // 4. Создание заявки + первого события в транзакции
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

  // 5. Автоназначение ответственного по роли категории
  if (category.responsibleRole) {
    const assignee = await db.query.profiles.findFirst({
      where: eq(profiles.role, category.responsibleRole),
    });
    if (assignee) {
      await db
        .update(tickets)
        .set({ assigneeId: assignee.id })
        .where(eq(tickets.id, ticket.id));
    }
  }

  // 6. Уведомление при аварии всем пользователям с ролью УК
  if (priority === 'emergency') {
    // Получаем адрес для уведомления
    let address = 'не указан';
    if (premiseId) {
      const premise = await db.query.premises.findFirst({
        where: eq(premises.id, premiseId),
        with: { house: true },
      });
      if (premise?.house?.address) {
        address = premise.house.address;
      }
    }

    const ukUsers = await db.query.profiles.findMany({
      where: eq(profiles.role, 'uk'),
    });

    for (const u of ukUsers) {
      if (u.maxUserId) {
        await notifyUser(
          u.maxUserId,
          `🚨 АВАРИЯ: ${title}\nАдрес: ${address}`,
        );
      }
    }
  }

  // 7. Уведомление автору о регистрации заявки
  if (profile.maxUserId) {
    await notifyUser(
      profile.maxUserId,
      `Заявка «${title}» зарегистрирована. Срок рассмотрения — ${category.defaultSlaHours ?? 24} ч.`,
    );
  }

  // 8. Возврат созданной заявки
  return NextResponse.json(ticket, { status: 201 });
}
