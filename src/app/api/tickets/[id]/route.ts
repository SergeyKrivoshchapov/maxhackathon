import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tickets } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { eq } from 'drizzle-orm';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await getProfileFromRequest(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { profile } = auth;

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, params.id),
    with: {
      category: true,
      premise: { with: { house: true } },
      author: true,
      assignee: true,
      messages: { orderBy: (m, { asc }) => [asc(m.createdAt)] },
      events: { orderBy: (e, { asc }) => [asc(e.createdAt)] },
    },
  });

  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAuthor = ticket.authorId === profile.id;
  const isStaff = ['uk', 'admin'].includes(profile.role);
  if (!isAuthor && !isStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(ticket);
}
