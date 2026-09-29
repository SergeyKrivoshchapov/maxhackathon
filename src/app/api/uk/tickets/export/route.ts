import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import {
  tickets, categories, houses, premises, profiles,
} from '@/db/schema';
import { getProfileFromRequest } from '@/lib/max-auth';

export const runtime = 'nodejs';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новое',
  accepted: 'Принято',
  in_progress: 'В работе',
  done: 'Выполнено',
  rejected: 'Отклонено',
  escalated: 'Эскалировано',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  emergency: 'Авария',
};

function esc(value: any): string {
  if (value == null) return '';
  const s = String(value).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${s}"`;
}

export async function GET(req: NextRequest) {
  const me = await getProfileFromRequest();
  if (!me) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  if (!['uk', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const myHouses = await db
    .select({ id: houses.id })
    .from(houses)
    .where(eq(houses.ukId, me.id));

  const houseIds = myHouses.map((h) => h.id);
  if (houseIds.length === 0) {
    return new NextResponse('нет данных', { status: 200 });
  }

  const premiseIds = await db
    .select({ id: premises.id })
    .from(premises)
    .where(inArray(premises.houseId, houseIds));

  const ids = premiseIds.map((p) => p.id);
  if (ids.length === 0) {
    return new NextResponse('нет данных', { status: 200 });
  }

  const conditions: any[] = [inArray(tickets.premiseId, ids)];
  if (from) conditions.push(gte(tickets.createdAt, new Date(from)));
  if (to) conditions.push(lte(tickets.createdAt, new Date(to)));

  const rows = await db
    .select({
      id: tickets.id,
      createdAt: tickets.createdAt,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      slaDeadline: tickets.slaDeadline,
      closedAt: tickets.closedAt,
      categoryName: categories.name,
      houseAddress: houses.address,
      premiseNumber: premises.number,
      authorName: profiles.firstName,
      assigneeName: profiles.lastName,
    })
    .from(tickets)
    .leftJoin(categories, eq(tickets.categoryId, categories.id))
    .leftJoin(premises, eq(tickets.premiseId, premises.id))
    .leftJoin(houses, eq(premises.houseId, houses.id))
    .leftJoin(profiles, eq(tickets.authorId, profiles.id))
    .where(and(...conditions))
    .orderBy(desc(tickets.createdAt));

  // Формируем CSV
  const headers = [
    'ID', 'Дата создания', 'Адрес', 'Квартира', 'Категория',
    'Заголовок', 'Описание', 'Статус', 'Приоритет',
    'Автор', 'Исполнитель', 'SLA', 'Дата закрытия',
  ];

  const lines = [headers.map(esc).join(';')];

  for (const r of rows) {
    lines.push([
      r.id,
      r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : '',
      r.houseAddress,
      r.premiseNumber,
      r.categoryName,
      r.title,
      r.description,
      STATUS_LABELS[r.status] ?? r.status,
      PRIORITY_LABELS[r.priority] ?? r.priority,
      r.authorName,
      r.assigneeName,
      r.slaDeadline ? new Date(r.slaDeadline).toLocaleString('ru-RU') : '',
      r.closedAt ? new Date(r.closedAt).toLocaleString('ru-RU') : '',
    ].map(esc).join(';'));
  }

  // BOM для Excel
  const csv = '\uFEFF' + lines.join('\r\n');

  const filename = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}