import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/db';
import { categories } from '../src/db/schema';

async function main() {
  await db.insert(categories).values([
    { code: 'water_leak',     name: 'Авария: вода',              defaultSlaHours: 4,  responsibleRole: 'rso' },
    { code: 'heating',        name: 'Отопление',                 defaultSlaHours: 8,  responsibleRole: 'rso' },
    { code: 'electricity',    name: 'Электрика',                 defaultSlaHours: 8,  responsibleRole: 'rso' },
    { code: 'elevator',       name: 'Лифт',                      defaultSlaHours: 2,  responsibleRole: 'contractor' },
    { code: 'roof',           name: 'Кровля',                    defaultSlaHours: 48, responsibleRole: 'uk' },
    { code: 'garbage',        name: 'Мусор / уборка',            defaultSlaHours: 24, responsibleRole: 'uk' },
    { code: 'yard',           name: 'Придомовая территория',     defaultSlaHours: 72, responsibleRole: 'uk' },
    { code: 'intercom',       name: 'Домофон',                   defaultSlaHours: 24, responsibleRole: 'uk' },
    { code: 'pipe_leak',      name: 'Протечка трубы',            defaultSlaHours: 4,  responsibleRole: 'rso' },
    { code: 'windows_doors',  name: 'Окна / двери в подъезде',   defaultSlaHours: 72, responsibleRole: 'uk' },
  ]).onConflictDoNothing();

  console.log('✅ Categories seeded');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});