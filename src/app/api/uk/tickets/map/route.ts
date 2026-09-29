import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { tickets, houses, premises } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET(_: NextRequest) {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  if (!['uk', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Дома УК
  const myHouses = await db
    .select({ id: houses.id })
    .from(houses)
    .where(eq(houses.ukId, me.id));

  const houseIds = myHouses.map((h) => h.id);
  if (houseIds.length === 0) return NextResponse.json([]);

  // Помещения этих домов
  const premiseIds = await db
    .select({ id: premises.id })
    .from(premises)
    .where(inArray(premises.houseId, houseIds));

  const ids = premiseIds.map((p) => p.id);
  if (ids.length === 0) return NextResponse.json([]);

  // Заявки с координатами
  const rows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      lat: tickets.lat,
      lng: tickets.lng,
      locationAddress: tickets.locationAddress,
      houseAddress: houses.address,
      premiseNumber: premises.number,
    })
    .from(tickets)
    .leftJoin(premises, eq(tickets.premiseId, premises.id))
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .where(
      and(
        inArray(tickets.premiseId, ids),
        isNotNull(tickets.lat),
        isNotNull(tickets.lng)
      )
    )
    .limit(500);

  return NextResponse.json(rows);
}