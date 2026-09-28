// src/app/api/uk/assignees/route.ts
import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET() {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });
  if (!['uk', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      role: profiles.role,
    })
    .from(profiles)
    .where(inArray(profiles.role, ['uk', 'contractor', 'admin']));

  return NextResponse.json(rows);
}