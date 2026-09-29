// src/app/api/tickets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import {
  tickets,
  ticketMessages,
  ticketEvents,
  profiles,
  categories,
  premises,
  houses,
} from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const profile = await getProfileFromRequest();
  if (!profile) {
    return NextResponse.json({ error: 'unauth' }, { status: 401 });
  }

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
      closedAt: tickets.closedAt,
      authorId: tickets.authorId,
      assigneeId: tickets.assigneeId,
      categoryName: categories.name,
      categoryCode: categories.code,
      // ← адрес
      premiseId: tickets.premiseId,
      premiseNumber: premises.number,
      houseId: houses.id,
      houseAddress: houses.address,
      lat: tickets.lat,
      lng: tickets.lng,
      locationAddress: tickets.locationAddress,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.categoryId, categories.id))
    .leftJoin(premises, eq(tickets.premiseId, premises.id))
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .where(eq(tickets.id, id));

  if (!ticket) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Доступ: автор или staff
  const isAuthor = ticket.authorId === profile.id;
  const isStaff = ['uk', 'admin', 'contractor'].includes(profile.role);

  if (!isAuthor && !isStaff) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const msgs = await db
    .select({
      id: ticketMessages.id,
      body: ticketMessages.body,
      attachments: ticketMessages.attachments,
      isSystem: ticketMessages.isSystem,
      createdAt: ticketMessages.createdAt,
      authorId: ticketMessages.authorId,
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

  return NextResponse.json({
    ticket,
    messages: msgs,
    events,
  });
}