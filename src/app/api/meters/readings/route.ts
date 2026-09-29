import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { meterReadings, meters, residencies } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

const schema = z.object({
  meterId: z.string().uuid(),
  value: z.number().positive(),
  readingDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { meterId, value, readingDate } = parsed.data;

  // Проверить, что счётчик принадлежит моему помещению
  const [meter] = await db
    .select()
    .from(meters)
    .where(eq(meters.id, meterId));

  if (!meter) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const [res] = await db
    .select()
    .from(residencies)
    .where(and(
      eq(residencies.profileId, me.id),
      eq(residencies.premiseId, meter.premiseId)
    ));

  if (!res) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const [reading] = await db
    .insert(meterReadings)
    .values({
      meterId,
      value: String(value),
      readingDate: readingDate ? new Date(readingDate) : new Date(),
      authorId: me.id,
    })
    .returning();

  return NextResponse.json(reading, { status: 201 });
}

export async function GET(req: NextRequest) {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const url = new URL(req.url);
  const meterId = url.searchParams.get('meterId');
  if (!meterId) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.meterId, meterId))
    .orderBy(desc(meterReadings.readingDate))
    .limit(50);

  return NextResponse.json(rows);
}