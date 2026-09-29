// src/app/api/uk/stats/route.ts
import { NextResponse } from 'next/server';
import { and, count, eq, lt, ne, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { tickets, premises, houses } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET() {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  if (!['uk', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Дома этой УК
  const myHouses = await db
    .select({ id: houses.id })
    .from(houses)
    .where(eq(houses.ukId, me.id));

  const houseIds = myHouses.map((h) => h.id);

  if (houseIds.length === 0) {
    return NextResponse.json({
      new: 0, in_progress: 0, overdue: 0, done_today: 0,
    });
  }

  // Помещения этих домов
  const premisesList = await db
    .select({ id: premises.id })
    .from(premises)
    .where(inArray(premises.houseId, houseIds));

  const premiseIds = premisesList.map((p) => p.id);

  if (premiseIds.length === 0) {
    return NextResponse.json({
      new: 0, in_progress: 0, overdue: 0, done_today: 0,
    });
  }

  const whereHouse = inArray(tickets.premiseId, premiseIds);

  const [newCount] = await db
    .select({ c: count() })
    .from(tickets)
    .where(and(whereHouse, eq(tickets.status, 'new')));

  const [inProgressCount] = await db
    .select({ c: count() })
    .from(tickets)
    .where(and(whereHouse, eq(tickets.status, 'in_progress')));

  const [overdueCount] = await db
    .select({ c: count() })
    .from(tickets)
    .where(
      and(
        whereHouse,
        lt(tickets.slaDeadline, new Date()),
        ne(tickets.status, 'done'),
        ne(tickets.status, 'rejected')
      )
    );

  return NextResponse.json({
    new: Number(newCount?.c ?? 0),
    in_progress: Number(inProgressCount?.c ?? 0),
    overdue: Number(overdueCount?.c ?? 0),
  });
}