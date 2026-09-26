// src/app/api/me/route.ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, residencies, premises, houses } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await getProfileFromRequest();
  if (!profile) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  const userResidencies = await db
    .select({
      residencyId: residencies.id,
      verified: residencies.verified,
      premiseId: premises.id,
      premiseNumber: premises.number,
      premiseType: premises.type,
      houseId: houses.id,
      houseAddress: houses.address,
      houseRegion: houses.region,
    })
    .from(residencies)
    .leftJoin(premises, eq(residencies.premiseId, premises.id))
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .where(eq(residencies.profileId, profile.id));

  return NextResponse.json({
    ...profile,
    residencies: userResidencies,
  });
}