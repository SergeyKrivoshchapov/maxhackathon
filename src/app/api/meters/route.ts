import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { meterReadings, meters, profiles, residencies } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const url = new URL(req.url);
  const meterId = url.searchParams.get('meterId');
  if (!meterId) return NextResponse.json([]);

  // Проверка доступа
  const [meter] = await db.select().from(meters).where(eq(meters.id, meterId));
  if (!meter) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const [res] = await db
    .select()
    .from(residencies)
    .where(and(
      eq(residencies.profileId, me.id),
      eq(residencies.premiseId, meter.premiseId)
    ));

  const isStaff = ['uk', 'admin'].includes(me.role);
  if (!res && !isStaff) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: meterReadings.id,
      value: meterReadings.value,
      readingDate: meterReadings.readingDate,
      authorId: meterReadings.authorId,
      authorName: profiles.firstName,
    })
    .from(meterReadings)
    .leftJoin(profiles, eq(meterReadings.authorId, profiles.id))
    .where(eq(meterReadings.meterId, meterId))
    .orderBy(desc(meterReadings.readingDate))
    .limit(50);

  // Считаем потребление между показаниями
  const withConsumption = rows.map((r, i) => {
    const prev = rows[i + 1]; // предыдущее (старше)
    const current = Number(r.value);
    const previous = prev ? Number(prev.value) : null;
    return {
      ...r,
      consumption: previous != null && current > previous
        ? +(current - previous).toFixed(3)
        : null,
    };
  });

  return NextResponse.json(withConsumption);
}