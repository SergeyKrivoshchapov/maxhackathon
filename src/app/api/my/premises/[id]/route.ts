// src/app/api/my/premises/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { residencies } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const profile = await getProfileFromRequest();
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  await db
    .delete(residencies)
    .where(
      and(
        eq(residencies.id, id),
        eq(residencies.profileId, profile.id)
      )
    );

  return NextResponse.json({ ok: true });
}