// src/app/api/houses/[id]/premises/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { premises } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const profile = await getProfileFromRequest();
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const rows = await db
    .select({
      id: premises.id,
      number: premises.number,
      type: premises.type,
      area: premises.area,
    })
    .from(premises)
    .where(eq(premises.houseId, id))
    .orderBy(asc(premises.number));

  return NextResponse.json(rows);
}