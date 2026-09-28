// src/app/api/houses/route.ts
import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { houses } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await getProfileFromRequest();
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const rows = await db
    .select({
      id: houses.id,
      address: houses.address,
      region: houses.region,
    })
    .from(houses)
    .orderBy(desc(houses.address))
    .limit(100);

  return NextResponse.json(rows);
}