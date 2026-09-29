import { NextRequest, NextResponse } from 'next/server';
import { getProfileFromRequest } from '@/lib/max-auth';
import { reverseGeocode } from '@/lib/geocode';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const profile = await getProfileFromRequest();
  if (!profile) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'invalid coords' }, { status: 400 });
  }

  const result = await reverseGeocode(lat, lng);
  return NextResponse.json(result);
}