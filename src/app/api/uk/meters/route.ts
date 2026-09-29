import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  meters, meterReadings, premises, houses, profiles,
} from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

type MeterStatus = 'ok' | 'warning' | 'stale';

type MeterInfo = {
  id: string;
  type: string;
  unit: string | null;
  lastValue: string | null;
  lastDate: string | null;
  lastAuthor: string | null;
  daysSince: number | null;
  status: MeterStatus;
};

type PremiseInfo = {
  premiseId: string;
  premiseNumber: string;
  houseAddress: string;
  meters: MeterInfo[];
  lastReadingDate: string | null;
  status: MeterStatus;
};

export async function GET() {
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
  if (houseIds.length === 0) {
    return NextResponse.json({
      summary: { total: 0, stale: 0, warning: 0, ok: 0 },
      premises: [],
    });
  }

  // Помещения
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
  if (premiseIds.length === 0) {
    return NextResponse.json({
      summary: { total: 0, stale: 0, warning: 0, ok: 0 },
      premises: [],
    });
  }

  // Счётчики
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

  // Последние показания
  const meterIds = meterRows.map((m) => m.id);
  const lastReadings: Record<string, {
    value: string;
    readingDate: Date;
    authorName: string | null;
  }> = {};

  if (meterIds.length > 0) {
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
      if (!lastReadings[r.meterId] && r.readingDate) {
        lastReadings[r.meterId] = {
          value: r.value,
          readingDate: r.readingDate,
          authorName: r.authorName,
        };
      }
    }
  }

  const now = new Date();
  const DAY = 86400_000;

  const premisesMap: Record<string, PremiseInfo> = {};

  for (const m of meterRows) {
    const key = m.premiseId;
    if (!premisesMap[key]) {
      premisesMap[key] = {
        premiseId: m.premiseId,
        premiseNumber: m.premiseNumber ?? '',
        houseAddress: m.houseAddress ?? '',
        meters: [],
        lastReadingDate: null,
        status: 'ok',
      };
    }

    const last = lastReadings[m.id];
    const daysSince = last
      ? Math.floor((now.getTime() - new Date(last.readingDate).getTime()) / DAY)
      : null;

    let meterStatus: MeterStatus = 'ok';
    if (daysSince == null) meterStatus = 'stale';
    else if (daysSince > 60) meterStatus = 'stale';
    else if (daysSince > 35) meterStatus = 'warning';

    premisesMap[key].meters.push({
      id: m.id,
      type: m.type,
      unit: m.unit,
      lastValue: last?.value ?? null,
      lastDate: last?.readingDate?.toISOString() ?? null,
      lastAuthor: last?.authorName ?? null,
      daysSince,
      status: meterStatus,
    });

    if (meterStatus === 'stale') {
      premisesMap[key].status = 'stale';
    } else if (meterStatus === 'warning' && premisesMap[key].status === 'ok') {
      premisesMap[key].status = 'warning';
    }

    if (
      last &&
      (!premisesMap[key].lastReadingDate ||
        new Date(last.readingDate) > new Date(premisesMap[key].lastReadingDate))
    ) {
      premisesMap[key].lastReadingDate = last.readingDate.toISOString();
    }
  }

  // Сортировка
  const statusOrder: Record<MeterStatus, number> = { stale: 0, warning: 1, ok: 2 };

  const result = Object.values(premisesMap).sort((a, b) => {
    const aOrder = statusOrder[a.status];
    const bOrder = statusOrder[b.status];
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (
      a.houseAddress.localeCompare(b.houseAddress) ||
      a.premiseNumber.localeCompare(b.premiseNumber)
    );
  });

  // Сводка
  const summary = {
    total: result.length,
    stale: result.filter((p) => p.status === 'stale').length,
    warning: result.filter((p) => p.status === 'warning').length,
    ok: result.filter((p) => p.status === 'ok').length,
  };

  return NextResponse.json({ summary, premises: result });
}