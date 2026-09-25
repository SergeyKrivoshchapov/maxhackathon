import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { verifyInitData } from '@/lib/max-auth';

const JWT_SECRET = new TextEncoder().encode(process.env.APP_JWT_SECRET!);

export async function POST(req: NextRequest) {
  const { initData } = await req.json();
  const check = verifyInitData(initData, process.env.MAX_BOT_TOKEN!);
  if (!check.ok || !check.user) {
    return NextResponse.json({ error: 'invalid initData' }, { status: 401 });
  }

  const u = check.user;

  // upsert профиля
  const [profile] = await db
    .insert(profiles)
    .values({
      maxUserId: u.id,
      username: u.username ?? null,
      firstName: u.first_name ?? null,
      lastName: u.last_name ?? null,
    })
    .onConflictDoUpdate({
      target: profiles.maxUserId,
      set: {
        username: u.username ?? null,
        firstName: u.first_name ?? null,
        lastName: u.last_name ?? null,
      },
    })
    .returning();

  const token = await new SignJWT({
    sub: profile.id,
    maxUserId: u.id,
    role: profile.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  (await cookies()).set('app_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ ok: true, profile });
}