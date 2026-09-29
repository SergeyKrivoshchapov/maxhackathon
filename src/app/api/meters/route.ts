import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { meters, residencies } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET() {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  // Все мои помещения
  const myRes = await db
    .select({ premiseId: residencies.premiseId })
    .from(residencies)
    .where(eq(residencies.profileId, me.id));

  const premiseIds = myRes.map((r) => r.premiseId);
  if (premiseIds.length === 0) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(meters)
    .where(inArray(meters.premiseId, premiseIds));

  return NextResponse.json(rows);
}