import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { tickets } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { changeTicketStatus } from '@/lib/change-ticket-status';
import { eq } from 'drizzle-orm';

const statusSchema = z.object({
  status: z.enum(['accepted', 'in_progress', 'done', 'rejected', 'escalated']),
  comment: z.string().max(1000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { profile } = auth;

  // Только УК и админ
  if (!['uk', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const updated = await changeTicketStatus(id, parsed.data.status, profile.id, parsed.data.comment);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
