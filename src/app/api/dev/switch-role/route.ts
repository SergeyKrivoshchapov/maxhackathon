import { NextRequest, NextResponse } from 'next/server';
import { eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { profiles, houses } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

const schema = z.object({
  role: z.enum(['uk', 'resident']),
});

export async function POST(req: NextRequest) {
  // 1. Защита: только при включённом флаге
  if (process.env.ALLOW_DEV_ENDPOINTS !== 'true') {
    return NextResponse.json(
      { error: 'dev endpoints disabled' },
      { status: 403 }
    );
  }

  // 2. Авторизация
  const profile = await getProfileFromRequest();
  if (!profile) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

  // 3. Валидация
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { role } = parsed.data;

  // 4. Меняем роль
  await db
    .update(profiles)
    .set({ role })
    .where(eq(profiles.id, profile.id));

  // 5. Логика с домами
  if (role === 'uk') {
    // Привязать все дома без УК
    await db
      .update(houses)
      .set({ ukId: profile.id })
  } else {
    // Отвязать дома, где этот УК был назначен
    await db
      .update(houses)
      .set({ ukId: null })
      .where(eq(houses.ukId, profile.id));
  }

  console.log(`[dev] role switched: ${profile.id} → ${role}`);

  return NextResponse.json({ ok: true, role });
}