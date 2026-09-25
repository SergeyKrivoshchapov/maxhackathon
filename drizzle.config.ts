import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';


export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!, // прямое подключение для миграций
  },
  verbose: true,
  strict: true,
});