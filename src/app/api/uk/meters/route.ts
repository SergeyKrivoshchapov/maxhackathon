import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  meters, meterReadings, premises, houses, profiles,
} from '@/db/schema';
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

  const meterRows = await db
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
    .where(inArray(meters.premiseId, premiseIds));

  // Загрузить последние показания для всех счётчиков
  const meterIds = meterRows.map((m) => m.id);
  const lastReadings: Record<string, any> = {};

  if (meterIds.length > 0) {
    // Получаем все показания, сортируем по дате, оставляем первые
    const readings = await db
      .select({
        meterId: meterReadings.meterId,
        value: meterReadings.value,
        readingDate: meterReadings.readingDate,
        authorName: profiles.firstName,
      })
      .from(meterReadings)
      .leftJoin(profiles, eq(meterReadings.authorId, profiles.id))
      .where(inArray(meterReadings.meterId, meterIds))
      .orderBy(desc(meterReadings.readingDate));

    for (const r of readings) {
      if (!lastReadings[r.meterId]) lastReadings[r.meterId] = r;
    }
  }

  // Собираем по квартире
  const now = new Date();
  const DAY = 86400_000;

  const premisesMap: Record<string, any> = {};

  for (const m of meterRows) {
    const key = m.premiseId;
    if (!premisesMap[key]) {
      premisesMap[key] = {
        premiseId: m.premiseId,
        premiseNumber: m.premiseNumber,
        houseAddress: m.houseAddress,
        meters: [],
        lastReadingDate: null,
        status: 'ok' as 'ok' | 'warning' | 'stale',
      };
    }

    const last = lastReadings[m.id];
    const daysSince = last
      ? Math.floor((now.getTime() - new Date(last.readingDate).getTime()) / DAY)
      : null;

    let meterStatus: 'ok' | 'warning' | 'stale' = 'ok';
    if (daysSince == null) meterStatus = 'stale';
    else if (daysSince > 60) meterStatus = 'stale';
    else if (daysSince > 35) meterStatus = 'warning';

    premisesMap[key].meters.push({
      id: m.id,
      type: m.type,
      unit: m.unit,
      lastValue: last?.value ?? null,
      lastDate: last?.readingDate ?? null,
      lastAuthor: last?.authorName ?? null,
      daysSince,
      status: meterStatus,
    });

    // Обновляем худший статус квартиры
    if (meterStatus === 'stale') premisesMap[key].status = 'stale';
    else if (meterStatus === 'warning' && premisesMap[key].status === 'ok') {
      premisesMap[key].status = 'warning';
    }

    // Обновляем самую свежую дату
    if (last && (!premisesMap[key].lastReadingDate ||
        new Date(last.readingDate) > new Date(premisesMap[key].lastReadingDate))) {
      premisesMap[key].lastReadingDate = last.readingDate;
    }
  }

  // Сортируем: сначала просроченные, потом по адресу
  const result = Object.values(premisesMap).sort((a: any, b: any) => {
    const order = { stale: 0, warning: 1, ok: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.houseAddress.localeCompare(b.houseAddress) ||
           a.premiseNumber.localeCompare(b.premiseNumber);
  });

  // Сводка
  const summary = {
    total: result.length,
    stale: result.filter((p: any) => p.status === 'stale').length,
    warning: result.filter((p: any) => p.status === 'warning').length,
    ok: result.filter((p: any) => p.status === 'ok').length,
  };

  return NextResponse.json({ summary, premises: result });
}