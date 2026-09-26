import { NextResponse } from 'next/server';
import { getProfileFromRequest } from '@/lib/max-auth';

export async function GET(req: Request) {
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json(auth.profile);
}
