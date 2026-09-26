import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tickets, ticketMessages } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { notifyUser } from '@/lib/notify';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const profile = await getProfileFromRequest();
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { body, attachments } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: 'body required' }, { status: 400 });
  }

  const [ticket] = await db
    .select({ authorId: tickets.authorId })
    .from(tickets)
    .where(eq(tickets.id, id));

  if (!ticket) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const [msg] = await db
    .insert(ticketMessages)
    .values({
      ticketId: id,
      authorId: profile.id,
      body,
      attachments: attachments ?? [],
    })
    .returning();

  if (ticket.authorId !== profile.id) {
    await notifyUser(ticket.authorId, `Новое сообщение по обращению`);
  }

  return NextResponse.json(msg);
}