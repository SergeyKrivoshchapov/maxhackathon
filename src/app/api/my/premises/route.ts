// src/app/api/my/premises/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { residencies, premises, houses } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await getProfileFromRequest();
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const rows = await db
    .select({
      residencyId: residencies.id,
      verified: residencies.verified,
      premiseId: premises.id,
      premiseNumber: premises.number,
      houseId: houses.id,
      houseAddress: houses.address,
    })
    .from(residencies)
    .leftJoin(premises, eq(residencies.premiseId, premises.id))
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .where(eq(residencies.profileId, profile.id));

  return NextResponse.json(rows);
}

const bodySchema = z.object({
  premiseId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const profile = await getProfileFromRequest();
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { premiseId } = parsed.data;

  // Проверить, что помещение существует
  const [premise] = await db
    .select()
    .from(premises)
    .where(eq(premises.id, premiseId));

  if (!premise) {
    return NextResponse.json({ error: 'premise not found' }, { status: 404 });
  }

  // Проверить, что ещё не привязано
  const [existing] = await db
    .select()
    .from(residencies)
    .where(
      and(
        eq(residencies.profileId, profile.id),
        eq(residencies.premiseId, premiseId)
      )
    );

  if (existing) {
    return NextResponse.json({ error: 'already linked' }, { status: 409 });
  }

  const [created] = await db
    .insert(residencies)
    .values({
      profileId: profile.id,
      premiseId,
      verified: false,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}