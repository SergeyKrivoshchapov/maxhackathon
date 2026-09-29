import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { meters, residencies } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const me = await getProfileFromRequest();
    if (!me) {
      console.log('[meters] unauth');
      return NextResponse.json({ error: 'unauth' }, { status: 401 });
    }

    console.log('[meters] user:', me.id, me.firstName);

    // Все мои помещения
    const myRes = await db
      .select({ premiseId: residencies.premiseId })
      .from(residencies)
      .where(eq(residencies.profileId, me.id));

    console.log('[meters] residencies:', myRes.length, myRes);

    if (myRes.length === 0) {
      console.log('[meters] no residencies, returning []');
      return NextResponse.json([]);
    }

    const premiseIds = myRes.map((r) => r.premiseId);

    // Счётчики этих помещений
    const rows = await db
      .select()
      .from(meters)
      .where(inArray(meters.premiseId, premiseIds));

    console.log('[meters] found meters:', rows.length, rows);

    return NextResponse.json(rows);
  } catch (e: any) {
    console.error('[meters] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}