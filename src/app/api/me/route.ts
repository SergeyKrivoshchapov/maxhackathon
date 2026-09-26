import { NextResponse } from 'next/server';
import { getProfileFromRequest } from '@/lib/max-auth';

export async function GET(req: Request) {
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, auth.profile.id),
    with: {
      residencies: {
        with: {
          premise: {
            with: { house: true },
          },
        },
      },
    },
  });

  return NextResponse.json(profile);
}
