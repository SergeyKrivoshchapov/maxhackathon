// src/app/api/uk/meters/route.ts
import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { meters, premises, houses } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET() {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  if (!['uk', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const myHouses = await db
    .select({ id: houses.id })
    .from(houses)
    .where(eq(houses.ukId, me.id));

  const houseIds = myHouses.map((h) => h.id);
  if (houseIds.length === 0) return NextResponse.json([]);

  const myPremises = await db
    .select({
      id: premises.id,
      number: premises.number,
      houseAddress: houses.address,
    })
    .from(premises)
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .where(inArray(premises.houseId, houseIds));

  const premiseIds = myPremises.map((p) => p.id);
  if (premiseIds.length === 0) return NextResponse.json([]);

  const rows = await db
    .select({
      id: meters.id,
      type: meters.type,
      unit: meters.unit,
      premiseId: meters.premiseId,
      premiseNumber: premises.number,
      houseAddress: houses.address,
    })
    .from(meters)
    .leftJoin(premises, eq(meters.premiseId, premises.id))
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .where(inArray(meters.premiseId, premiseIds))
    .limit(500);

  // Группировка по дому → квартире
  const grouped: Record<string, any> = {};
  for (const r of rows) {
    const key = `${r.houseAddress}|${r.premiseNumber}`;
    if (!grouped[key]) {
      grouped[key] = {
        houseAddress: r.houseAddress,
        premiseNumber: r.premiseNumber,
        meters: [],
      };
    }
    grouped[key].meters.push({
      id: r.id,
      type: r.type,
      unit: r.unit,
    });
  }

  return NextResponse.json(Object.values(grouped));
}