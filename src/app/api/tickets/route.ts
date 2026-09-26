import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { tickets, categories, profiles } from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';
import { notifyUser } from '@/lib/notify';

export const runtime = 'nodejs';

export async function GET() {
  const profile = await getProfileFromRequest();
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const rows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      slaDeadline: tickets.slaDeadline,
      categoryName: categories.name,
      assigneeFirstName: profiles.firstName,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.categoryId, categories.id))
    .leftJoin(profiles, eq(tickets.assigneeId, profiles.id))
    .where(eq(tickets.authorId, profile.id))
    .orderBy(desc(tickets.createdAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const profile = await getProfileFromRequest();
  if (!profile) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { categoryId, title, description, photos, priority } = await req.json();
  if (!categoryId || !title) {
    return NextResponse.json({ error: 'categoryId and title required' }, { status: 400 });
  }

  const [cat] = await db
    .select({ sla: categories.defaultSlaHours })
    .from(categories)
    .where(eq(categories.id, categoryId));

  const deadline = new Date(Date.now() + (cat?.sla ?? 24) * 3600_000);

  const [ticket] = await db
    .insert(tickets)
    .values({
      authorId: profile.id,
      categoryId,
      title,
      description: description ?? null,
      photos: photos ?? [],
      priority: priority ?? 'normal',
      slaDeadline: deadline,
    })
    .returning();

  await notifyUser(profile.id, `Обращение принято: «${title}»`);
  return NextResponse.json(ticket);
}