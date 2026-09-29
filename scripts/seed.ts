import { config } from 'dotenv';
config({ path: '.env.local' });

import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db';
import {
  profiles,
  houses,
  premises,
  categories,
  residencies,
} from '../src/db/schema';

// ─── Утилита: логирование ──────────────────────────────────
function log(msg: string) {
  console.log(`  ${msg}`);
}

function section(title: string) {
  console.log(`\n→ ${title}`);
}

// ─── 1. Категории ──────────────────────────────────────────
async function seedCategories() {
  section('Категории');

  const data = [
    { code: 'water_leak',    name: 'Авария: вода',           defaultSlaHours: 4,  responsibleRole: 'rso' as const },
    { code: 'heating',       name: 'Отопление',              defaultSlaHours: 8,  responsibleRole: 'rso' as const },
    { code: 'electricity',   name: 'Электрика',              defaultSlaHours: 8,  responsibleRole: 'rso' as const },
    { code: 'elevator',      name: 'Лифт',                   defaultSlaHours: 2,  responsibleRole: 'contractor' as const },
    { code: 'roof',          name: 'Кровля',                 defaultSlaHours: 48, responsibleRole: 'uk' as const },
    { code: 'garbage',       name: 'Мусор / уборка',         defaultSlaHours: 24, responsibleRole: 'uk' as const },
    { code: 'yard',          name: 'Придомовая территория',  defaultSlaHours: 72, responsibleRole: 'uk' as const },
    { code: 'intercom',      name: 'Домофон',                defaultSlaHours: 24, responsibleRole: 'uk' as const },
  ];

  await db.insert(categories).values(data).onConflictDoNothing();
  log(`✅ ${data.length} категорий`);
}

// ─── 2. Профили: УК, исполнители, тестовый житель ──────────
async function seedProfiles() {
  section('Профили');

  // maxUserId отрицательные — чтобы не пересекаться с реальными MAX-пользователями
  const seedProfiles = [
    { maxUserId: -1001, firstName: 'УК',     lastName: 'Центральная',  role: 'uk' as const },
    { maxUserId: -1002, firstName: 'УК',     lastName: 'Северная',     role: 'uk' as const },
    { maxUserId: -2001, firstName: 'Иван',   lastName: 'Слесарев',     role: 'contractor' as const },
    { maxUserId: -2002, firstName: 'Пётр',   lastName: 'Электрик',     role: 'contractor' as const },
    { maxUserId: -3001, firstName: 'Тест',   lastName: 'Житель',       role: 'resident' as const },
  ];

  for (const p of seedProfiles) {
    await db
      .insert(profiles)
      .values({
        maxUserId: p.maxUserId,
        firstName: p.firstName,
        lastName: p.lastName,
        role: p.role,
      })
      .onConflictDoNothing();
  }

  // Загружаем ID обратно
  const all = await db.select().from(profiles);
  const byMaxId = new Map(all.map((p) => [p.maxUserId, p]));

  log(`✅ ${seedProfiles.length} профилей`);

  return {
    uk1:       byMaxId.get(-1001),
    uk2:       byMaxId.get(-1002),
    worker1:   byMaxId.get(-2001),
    worker2:   byMaxId.get(-2002),
    resident:  byMaxId.get(-3001),
  };
}

// ─── 3. Дома ───────────────────────────────────────────────
async function seedHouses(uk1Id?: string, uk2Id?: string) {
  section('Дома');

  const data = [
    { address: 'г. Москва, ул. Ленина, д. 15',     region: 'Москва', ukId: uk1Id },
    { address: 'г. Москва, ул. Ленина, д. 17',     region: 'Москва', ukId: uk1Id },
    { address: 'г. Москва, ул. Пушкина, д. 8',     region: 'Москва', ukId: uk1Id },
    { address: 'г. Москва, пр. Мира, д. 42',       region: 'Москва', ukId: uk2Id },
    { address: 'г. Москва, ул. Гагарина, д. 3',    region: 'Москва', ukId: uk2Id },
  ];

  // Проверяем, какие уже есть
  const existing = await db.select({ address: houses.address }).from(houses);
  const existingAddresses = new Set(existing.map((h) => h.address));

  const toInsert = data.filter((h) => !existingAddresses.has(h.address));
  if (toInsert.length > 0) {
    await db.insert(houses).values(toInsert);
  }

  const all = await db.select().from(houses);
  log(`✅ ${all.length} домов (добавлено ${toInsert.length})`);

  return all;
}

// ─── 4. Квартиры ───────────────────────────────────────────
async function seedPremises() {
  section('Квартиры');

  const allHouses = await db.select().from(houses);
  let created = 0;

  for (const h of allHouses) {
    // Проверяем, сколько уже есть
    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(premises)
      .where(eq(premises.houseId, h.id));

    const current = Number(existing[0]?.count ?? 0);
    if (current >= 40) continue;

    const apartments = Array.from({ length: 40 }, (_, i) => ({
      houseId: h.id,
      number: String(i + 1),
      type: 'apartment' as const,
    }));

    await db.insert(premises).values(apartments).onConflictDoNothing();
    created += 40;
  }

  const total = await db.select({ count: sql<number>`count(*)` }).from(premises);
  log(`✅ ${Number(total[0]?.count ?? 0)} квартир (добавлено ${created})`);
}

// ─── 5. Привязать тестового жителя к квартире ──────────────
async function seedTestResidency(residentId?: string) {
  section('Тестовая привязка жителя');

  if (!residentId) {
    log('⚠️ resident не найден, пропускаем');
    return;
  }

  // Найти первую квартиру в первом доме
  const [firstHouse] = await db.select().from(houses).limit(1);
  if (!firstHouse) {
    log('⚠️ домов нет');
    return;
  }

  const [firstPremise] = await db
    .select()
    .from(premises)
    .where(eq(premises.houseId, firstHouse.id))
    .limit(1);

  if (!firstPremise) {
    log('⚠️ квартир нет');
    return;
  }

  await db
    .insert(residencies)
    .values({
      profileId: residentId,
      premiseId: firstPremise.id,
      verified: true,
    })
    .onConflictDoNothing();

  log(`✅ Тестовый житель привязан к ${firstHouse.address}, кв. ${firstPremise.number}`);
}

// ─── MAIN ──────────────────────────────────────────────────
async function main() {
  console.log('========================================');
  console.log('  Seed: стартовые данные');
  console.log('========================================');

  try {
    await seedCategories();
    const profs = await seedProfiles();
    await seedHouses(profs.uk1?.id, profs.uk2?.id);
    await seedPremises();
    await seedTestResidency(profs.resident?.id);

    console.log('\n========================================');
    console.log('  ✅ Seed завершён успешно');
    console.log('========================================');
    console.log('\nПрофили для теста (по maxUserId):');
    console.log('  -1001 — УК «Центральная» (роль uk)');
    console.log('  -1002 — УК «Северная» (роль uk)');
    console.log('  -2001 — Иван Слесарев (роль contractor)');
    console.log('  -2002 — Пётр Электрик (роль contractor)');
    console.log('  -3001 — Тест Житель (роль resident)');
    console.log('\nЧтобы стать УК, обнови свой профиль в БД:');
    console.log("  UPDATE profiles SET role='uk' WHERE max_user_id=<твой-id>;");
    console.log('');

    process.exit(0);
  } catch (e) {
    console.error('\n❌ Ошибка seed:', e);
    process.exit(1);
  }
}

main();