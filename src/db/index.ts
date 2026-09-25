import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// На Vercel (serverless) ОБЯЗАТЕЛЬНО prepare: false для Supabase Pooler
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,              // критично для serverless
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });