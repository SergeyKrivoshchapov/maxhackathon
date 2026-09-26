import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { tickets, ticketMessages } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { eq } from 'drizzle-orm';

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
  attachments: z.array(z.string().url()).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { profile } = auth;

  // Проверка доступа
  const ticket = await db.query.tickets.findFirst({ where: eq(tickets.id, id) });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAuthor = ticket.authorId === profile.id;
  const isStaff = ['uk', 'admin'].includes(profile.role);
  if (!isAuthor && !isStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [message] = await db
    .insert(ticketMessages)
    .values({
      ticketId: id,
      authorId: profile.id,
      body: parsed.data.body,
      attachments: parsed.data.attachments ?? null,
      isSystem: false,
    })
    .returning();

  return NextResponse.json(message, { status: 201 });
}
