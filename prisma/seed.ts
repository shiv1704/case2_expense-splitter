/**
 * Seed script — "Flat 4B" demo group with realistic Indian expenses.
 * Run:  npx prisma db seed   or   npx tsx prisma/seed.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ALICE_ID   = "11111111-1111-4111-8111-111111111111";
const BOB_ID     = "22222222-2222-4222-8222-222222222222";
const CHARLIE_ID = "33333333-3333-4333-8333-333333333333";

const DEMO_USERS = [
  { id: ALICE_ID,   email: "alice@demo.com",   name: "Alice"   },
  { id: BOB_ID,     email: "bob@demo.com",      name: "Bob"     },
  { id: CHARLIE_ID, email: "charlie@demo.com",  name: "Charlie" },
] as const;

async function seedAuthUsers() {
  for (const u of DEMO_USERS) {
    await pool.query(
      `INSERT INTO auth.users (
         id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data,
         is_super_admin, is_sso_user, is_anonymous, created_at, updated_at
       ) VALUES (
         $1, 'authenticated', 'authenticated', $2,
         extensions.crypt($3, extensions.gen_salt('bf', 10)),
         now(),
         '{"provider":"email","providers":["email"]}', '{}',
         false, false, false, now(), now()
       ) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email, "demo1234"]
    );

    await pool.query(
      `INSERT INTO auth.identities (
         id, user_id, provider_id, provider, identity_data, created_at, updated_at
       ) VALUES (
         extensions.uuid_generate_v4(), $1, $2, 'email',
         jsonb_build_object('sub', $1::text, 'email', $2),
         now(), now()
       ) ON CONFLICT (provider, provider_id) DO NOTHING`,
      [u.id, u.email]
    );
  }
}

async function main() {
  console.log("🌱  Seeding Supabase auth users…");
  await seedAuthUsers();

  console.log("🌱  Seeding application data…");

  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: { id: u.id, email: u.email, name: u.name },
    });
  }

  const group = await prisma.group.upsert({
    where:  { invite_code: "DEMO42" },
    update: { name: "Flat 4B" },
    create: { name: "Flat 4B", invite_code: "DEMO42", created_by: ALICE_ID },
  });
  const gid = group.id;

  for (const u of DEMO_USERS) {
    await prisma.groupMember.upsert({
      where:  { group_id_user_id: { group_id: gid, user_id: u.id } },
      update: {},
      create: { group_id: gid, user_id: u.id },
    });
  }

  // Wipe old expenses so re-runs are idempotent
  await prisma.expense.deleteMany({ where: { group_id: gid } });

  // ── 1. Rent · Alice · EQUAL 3-way ─────────────────────────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: ALICE_ID,
      title: "Rent", total_amount: 27000, split_type: "EQUAL",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 9000 },
        { user_id: BOB_ID,     amount: 9000 },
        { user_id: CHARLIE_ID, amount: 9000 },
      ]},
    },
  });

  // ── 2. Groceries - Week 1 · Bob · EQUAL 3-way ─────────────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: BOB_ID,
      title: "Groceries - Week 1", total_amount: 1840, split_type: "EQUAL",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 613.34 },
        { user_id: BOB_ID,     amount: 613.33 },
        { user_id: CHARLIE_ID, amount: 613.33 },
      ]},
    },
  });

  // ── 3. Electricity bill · Charlie · EQUAL 3-way ───────────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: CHARLIE_ID,
      title: "Electricity bill", total_amount: 2340, split_type: "EQUAL",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 780 },
        { user_id: BOB_ID,     amount: 780 },
        { user_id: CHARLIE_ID, amount: 780 },
      ]},
    },
  });

  // ── 4. Zomato dinner · Alice · PERCENTAGE 50/30/20 ────────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: ALICE_ID,
      title: "Zomato dinner", total_amount: 1260, split_type: "PERCENTAGE",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 630,  percentage: 50 },
        { user_id: BOB_ID,     amount: 378,  percentage: 30 },
        { user_id: CHARLIE_ID, amount: 252,  percentage: 20 },
      ]},
    },
  });

  // ── 5. Internet bill · Bob · EQUAL 3-way ──────────────────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: BOB_ID,
      title: "Internet bill", total_amount: 999, split_type: "EQUAL",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 333 },
        { user_id: BOB_ID,     amount: 333 },
        { user_id: CHARLIE_ID, amount: 333 },
      ]},
    },
  });

  // ── 6. Washing powder & soap · Charlie · EQUAL 3-way ──────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: CHARLIE_ID,
      title: "Washing powder & soap", total_amount: 380, split_type: "EQUAL",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 126.67 },
        { user_id: BOB_ID,     amount: 126.67 },
        { user_id: CHARLIE_ID, amount: 126.66 },
      ]},
    },
  });

  // ── 7. Ola cab - airport · Alice · FIXED 550/350/200 ──────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: ALICE_ID,
      title: "Ola cab - airport", total_amount: 1100, split_type: "FIXED",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 550 },
        { user_id: BOB_ID,     amount: 350 },
        { user_id: CHARLIE_ID, amount: 200 },
      ]},
    },
  });

  // ── 8. Groceries - Week 2 · Bob · EQUAL 3-way ─────────────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: BOB_ID,
      title: "Groceries - Week 2", total_amount: 2100, split_type: "EQUAL",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 700 },
        { user_id: BOB_ID,     amount: 700 },
        { user_id: CHARLIE_ID, amount: 700 },
      ]},
    },
  });

  // ── 9. Gas cylinder · Charlie · EQUAL 3-way ───────────────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: CHARLIE_ID,
      title: "Gas cylinder", total_amount: 980, split_type: "EQUAL",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 326.67 },
        { user_id: BOB_ID,     amount: 326.67 },
        { user_id: CHARLIE_ID, amount: 326.66 },
      ]},
    },
  });

  // ── 10. Pizza night · Alice · EQUAL 3-way ─────────────────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: ALICE_ID,
      title: "Pizza night", total_amount: 1440, split_type: "EQUAL",
      splits: { create: [
        { user_id: ALICE_ID,   amount: 480 },
        { user_id: BOB_ID,     amount: 480 },
        { user_id: CHARLIE_ID, amount: 480 },
      ]},
    },
  });

  // ── Expected net balances ──────────────────────────────────────────────────
  //   Alice   paid 30,800  owes 13,539.68  → net +17,260.32
  //   Bob     paid  4,939  owes 13,087.67  → net  -8,148.67
  //   Charlie paid  3,700  owes 12,811.65  → net  -9,111.65
  //
  //   Suggested: Charlie → Alice ₹9,111.65 · Bob → Alice ₹8,148.67

  console.log("\n✅  Seed complete!");
  console.log(`   Group : "${group.name}"  (invite code: ${group.invite_code})`);
  console.log("   Users :");
  for (const u of DEMO_USERS) {
    console.log(`     ${u.name.padEnd(8)} ${u.email}  password: demo1234`);
  }
  console.log("\n   Expected balances:");
  console.log("     Alice   → +₹17,260.32  (owed)");
  console.log("     Bob     → -₹8,148.67   (owes)");
  console.log("     Charlie → -₹9,111.65   (owes)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
