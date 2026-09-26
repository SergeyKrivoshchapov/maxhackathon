import { NextResponse } from 'next/server';
import { db } from '@/db';
import { categories } from '@/db/schema';

export async function GET() {
  const list = await db.select().from(categories);
  return NextResponse.json(list, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
