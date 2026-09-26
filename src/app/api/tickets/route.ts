import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tickets } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { and, desc, eq } from 'drizzle-orm';

export async function GET(req: Request) {
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { profile } = auth;
  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  const conditions = [eq(tickets.authorId, profile.id)];
  if (status) conditions.push(eq(tickets.status, status as any));

  const list = await db.query.tickets.findMany({
    where: and(...conditions),
    orderBy: desc(tickets.createdAt),
    limit: 50,
    with: {
      category: true,
      premise: { with: { house: true } },
    },
  });

  return NextResponse.json(list);
}

import { z } from 'zod';
import { ticketEvents, categories, residencies } from '@/db/schema';

const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  categoryId: z.number().int(),
  premiseId: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'high', 'emergency']).default('normal'),
  photos: z.array(z.string().url()).optional(),
});

export async function POST(req: Request) {
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { profile } = auth;

  const body = await req.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, categoryId, premiseId, priority, photos } = parsed.data;

  // Проверка прав на помещение
  if (premiseId) {
    const residency = await db.query.residencies.findFirst({
      where: and(
        eq(residencies.profileId, profile.id),
        eq(residencies.premiseId, premiseId),
      ),
    });
    if (!residency) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Расчёт SLA
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
  });
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 400 });

  const slaDeadline = new Date(Date.now() + (category.defaultSlaHours ?? 24) * 3600_000);

  // Транзакция: тикет + событие
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

  return NextResponse.json(ticket, { status: 201 });
}
