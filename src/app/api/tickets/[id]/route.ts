import { NextRequest, NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import {
  tickets, ticketMessages, ticketEvents, profiles, categories,
} from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // ← Promise
) {
  const { id } = await params;                       // ← await

  const profile = await getProfileFromRequest();     // ← без req
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const [ticket] = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      photos: tickets.photos,
      createdAt: tickets.createdAt,
      slaDeadline: tickets.slaDeadline,
      authorId: tickets.authorId,
      categoryName: categories.name,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.categoryId, categories.id))
    .where(eq(tickets.id, id));

  if (!ticket) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (ticket.authorId !== profile.id && profile.role === 'resident') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const msgs = await db
    .select({
      id: ticketMessages.id,
      body: ticketMessages.body,
      attachments: ticketMessages.attachments,
      isSystem: ticketMessages.isSystem,
      createdAt: ticketMessages.createdAt,
      authorName: profiles.firstName,
    })
    .from(ticketMessages)
    .leftJoin(profiles, eq(ticketMessages.authorId, profiles.id))
    .where(eq(ticketMessages.ticketId, id))
    .orderBy(asc(ticketMessages.createdAt));

  const events = await db
    .select()
    .from(ticketEvents)
    .where(eq(ticketEvents.ticketId, id))
    .orderBy(asc(ticketEvents.createdAt));

  return NextResponse.json({ ticket, messages: msgs, events });
}