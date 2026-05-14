/**
 * Seed script for the "Emirates 4B" demo group.
 *
 * Auth users are seeded directly into auth.users via the pg pool so the
 * script is self-contained. The same fixed UUIDs are used for both the
 * Supabase auth records and the Prisma user records so magic-link login
 * and the app's data stay in sync.
 *
 * Run:  npx prisma db seed
 *   or: npx tsx prisma/seed.ts
 *
 * NOTE: If DATABASE_URL uses port 5432 and the host is unreachable from your
 * local network (Supabase free tier blocks direct connections from some ISPs),
 * the auth-user step will fail. In that case run the seed via Supabase MCP or
 * the Supabase Dashboard SQL editor. The app data can also be seeded that way.
 * The demo data has already been applied via Supabase MCP for the initial
 * deployment. Re-run this script only if the database is wiped.
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── fixed demo UUIDs ────────────────────────────────────────────────────────

const ALICE_ID   = "11111111-1111-4111-8111-111111111111"; // alice@demo.com
const BOB_ID     = "22222222-2222-4222-8222-222222222222"; // bob@demo.com
const CHARLIE_ID = "33333333-3333-4333-8333-333333333333"; // charlie@demo.com

const DEMO_USERS = [
  { id: ALICE_ID,   email: "alice@demo.com",  name: "Alice"   },
  { id: BOB_ID,     email: "bob@demo.com",     name: "Bob"     },
  { id: CHARLIE_ID, email: "charlie@demo.com", name: "Charlie" },
] as const;

// ─── auth seeding (idempotent via ON CONFLICT) ────────────────────────────────

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

// ─── app data seeding ─────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding Supabase auth users…");
  await seedAuthUsers();

  console.log("🌱  Seeding application data…");

  // Users (mirror the UUIDs from auth.users)
  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: { id: u.id, email: u.email, name: u.name },
    });
  }

  // Group
  const group = await prisma.group.upsert({
    where:  { invite_code: "DEMO42" },
    update: {},
    create: { name: "Emirates 4B", invite_code: "DEMO42", created_by: ALICE_ID },
  });
  const gid = group.id;

  // Members
  for (const u of DEMO_USERS) {
    await prisma.groupMember.upsert({
      where:  { group_id_user_id: { group_id: gid, user_id: u.id } },
      update: {},
      create: { group_id: gid, user_id: u.id },
    });
  }

  // Remove old seed expenses so re-runs stay clean
  await prisma.expense.deleteMany({ where: { group_id: gid } });

  // ── 1. Rent · Alice paid · EQUAL split ──────────────────────────────────────
  //    $12,000 ÷ 3 = $4,000 each
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: ALICE_ID,
      title: "Rent", total_amount: 12000, split_type: "EQUAL",
      splits: {
        create: [
          { user_id: ALICE_ID,   amount: 4000 },
          { user_id: BOB_ID,     amount: 4000 },
          { user_id: CHARLIE_ID, amount: 4000 },
        ],
      },
    },
  });

  // ── 2. Groceries · Bob paid · PERCENTAGE 50 / 30 / 20 ──────────────────────
  //    $850 × 50 % = $425  |  × 30 % = $255  |  × 20 % = $170
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: BOB_ID,
      title: "Groceries", total_amount: 850, split_type: "PERCENTAGE",
      splits: {
        create: [
          { user_id: ALICE_ID,   amount: 425.00, percentage: 50 },
          { user_id: BOB_ID,     amount: 255.00, percentage: 30 },
          { user_id: CHARLIE_ID, amount: 170.00, percentage: 20 },
        ],
      },
    },
  });

  // ── 3. Netflix · Charlie paid · EQUAL split ─────────────────────────────────
  //    $499 ÷ 3 → $166.34 + $166.33 + $166.33 (penny to first member)
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: CHARLIE_ID,
      title: "Netflix", total_amount: 499, split_type: "EQUAL",
      splits: {
        create: [
          { user_id: ALICE_ID,   amount: 166.34 },
          { user_id: BOB_ID,     amount: 166.33 },
          { user_id: CHARLIE_ID, amount: 166.33 },
        ],
      },
    },
  });

  // ── 4. Electricity · Alice paid · FIXED 400 / 400 / 400 ────────────────────
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: ALICE_ID,
      title: "Electricity", total_amount: 1200, split_type: "FIXED",
      splits: {
        create: [
          { user_id: ALICE_ID,   amount: 400 },
          { user_id: BOB_ID,     amount: 400 },
          { user_id: CHARLIE_ID, amount: 400 },
        ],
      },
    },
  });

  // ── 5. Dinner · Bob paid · PERCENTAGE 40 / 35 / 25 ─────────────────────────
  //    $2,100 × 40 % = $840  |  × 35 % = $735  |  × 25 % = $525
  await prisma.expense.create({
    data: {
      group_id: gid, paid_by: BOB_ID,
      title: "Dinner", total_amount: 2100, split_type: "PERCENTAGE",
      splits: {
        create: [
          { user_id: ALICE_ID,   amount: 840.00, percentage: 40 },
          { user_id: BOB_ID,     amount: 735.00, percentage: 35 },
          { user_id: CHARLIE_ID, amount: 525.00, percentage: 25 },
        ],
      },
    },
  });

  // ── Expected net balances ────────────────────────────────────────────────────
  //   Alice   paid 13,200  owes 5,831.34  → net +7,368.66
  //   Bob     paid  2,950  owes 5,556.33  → net -2,606.33
  //   Charlie paid    499  owes 5,261.33  → net -4,762.33 (≈ -4,762.34 w/ rounding)
  //
  //   Netting (greedy):  Charlie → Alice $4,762.33
  //                      Bob     → Alice $2,606.33
  //   ⇒ 2 transactions instead of 3

  console.log("\n✅  Seed complete!");
  console.log(`   Group : "${group.name}"  (invite code: ${group.invite_code})`);
  console.log("   Users :");
  for (const u of DEMO_USERS) {
    console.log(`     ${u.name.padEnd(8)} ${u.email}  password: demo1234`);
  }
  console.log("\n   Expected balances after seeding:");
  console.log("     Alice   → +$7,368.66  (owed money)");
  console.log("     Bob     → -$2,606.33  (owes money)");
  console.log("     Charlie → -$4,762.34  (owes money)");
  console.log("\n   Suggested settlements:");
  console.log("     Charlie → Alice  $4,762.34");
  console.log("     Bob     → Alice  $2,606.33");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
