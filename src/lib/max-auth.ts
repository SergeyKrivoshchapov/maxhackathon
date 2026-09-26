import { db } from '@/db';
import { profiles } from '@/db/schema';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { verifyJwt } from './jwt';
import { NextRequest } from 'next/server';

export type MaxUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

export function verifyInitData(
  initData: string,
  botToken: string
): { ok: boolean; user?: MaxUser; authDate?: number } {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false };

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calc = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  const ok = crypto.timingSafeEqual(
    Buffer.from(calc, 'hex'),
    Buffer.from(hash, 'hex')
  );
  if (!ok) return { ok: false };

  const userRaw = params.get('user');
  const user = userRaw ? (JSON.parse(userRaw) as MaxUser) : undefined;
  const authDate = Number(params.get('auth_date') ?? 0);

  if (Date.now() / 1000 - authDate > 86400) return { ok: false };

  return { ok: true, user, authDate };
}

export async function getProfileFromRequest() {
  const token = (await cookies()).get('app_token')?.value;
  if (!token) return null;

  const payload = verifyJwt(token, process.env.APP_JWT_SECRET!);
  if (!payload?.sub) return null;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, payload.sub as string));

  return profile ?? null;
}