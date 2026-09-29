// src/app/api/uk/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { tickets, categories, houses, premises, profiles } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  if (!['uk', 'admin', 'contractor'].includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');
  const overdue = url.searchParams.get('overdue') === '1';
  const unassigned = url.searchParams.get('unassigned') === '1';
  const sort = url.searchParams.get('sort') ?? 'new';

  // дома, которые обслуживает эта УК
  const myHouses = await db
    .select({ id: houses.id })
    .from(houses)
    .where(eq(houses.ukId, me.id));

  const houseIds = myHouses.map((h) => h.id);

  // если УК без домов — показываем пусто (не даём доступ ко всем)
  if (me.role === 'uk' && houseIds.length === 0) {
    return NextResponse.json([]);
  }

  const conditions: any[] = [];

  if (me.role === 'uk' && houseIds.length > 0) {
    // фильтр по домам УК (через premises.houseId)
    const premiseIdsForHouses = await db
      .select({ id: premises.id })
      .from(premises)
      .where(inArray(premises.houseId, houseIds));

    const ids = premiseIdsForHouses.map((p) => p.id);
    if (ids.length > 0) {
      conditions.push(inArray(tickets.premiseId, ids));
    } else {
      return NextResponse.json([]);
    }
  }

  if (status) conditions.push(eq(tickets.status, status as any));
  if (priority) conditions.push(eq(tickets.priority, priority as any));
  if (unassigned) conditions.push(isNull(tickets.assigneeId));
  if (overdue) {
    conditions.push(lt(tickets.slaDeadline, new Date()));
    conditions.push(
      or(
        eq(tickets.status, 'new'),
        eq(tickets.status, 'accepted'),
        eq(tickets.status, 'in_progress'),
        eq(tickets.status, 'escalated')
      ) as any
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const orderBy = (() => {
    switch (sort) {
      case 'sla':
        return asc(tickets.slaDeadline);
      case 'priority':
        // emergency > high > normal > low
        return desc(sql`
          case
            when ${tickets.priority} = 'emergency' then 4
            when ${tickets.priority} = 'high' then 3
            when ${tickets.priority} = 'normal' then 2
            else 1
          end
        `);
      default:
        return desc(tickets.createdAt);
    }
  })();

  const rows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      slaDeadline: tickets.slaDeadline,
      categoryName: categories.name,
      categoryCode: categories.code,
      houseAddress: houses.address,
      premiseNumber: premises.number,
      authorFirstName: profiles.firstName,
      assigneeId: tickets.assigneeId,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.categoryId, categories.id))
    .leftJoin(premises, eq(tickets.premiseId, premises.id))
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .leftJoin(profiles, eq(tickets.authorId, profiles.id))
    .where(where as any)
    .orderBy(orderBy)
    .limit(100);

  return NextResponse.json(rows);
}