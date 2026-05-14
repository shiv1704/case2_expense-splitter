/**
 * One-time setup route: creates Supabase Auth accounts for the three demo
 * users so they can log in with email + password.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env (Supabase dashboard →
 * Settings → API → "service_role secret").
 *
 * ALSO: Go to Supabase Dashboard → Authentication → Providers → Email →
 * turn OFF "Confirm email" so sign-ups don't need email verification.
 *
 * Hit once after deploying: GET /api/setup-demo
 * Idempotent — safe to call multiple times.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

const DEMO_USERS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "alice@demo.com",
    name: "Alice",
    password: "demo1234",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "bob@demo.com",
    name: "Bob",
    password: "demo1234",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    email: "charlie@demo.com",
    name: "Charlie",
    password: "demo1234",
  },
];

export async function GET() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results = [];

  for (const demo of DEMO_USERS) {
    try {
      // Pin the UUID so it matches existing seeded data in Prisma.
      // The REST API accepts `id`; cast needed because the TS types omit it.
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        ...(demo as unknown as Record<string, unknown>),
        email_confirm: true,
      } as Parameters<typeof supabaseAdmin.auth.admin.createUser>[0]);

      const alreadyExists =
        error?.message?.toLowerCase().includes("already") ||
        error?.message?.toLowerCase().includes("duplicate");

      if (error && !alreadyExists) {
        results.push({ email: demo.email, status: "error", message: error.message });
        continue;
      }

      // Upsert Prisma record — use the UUID Supabase assigned (should equal demo.id).
      const authId = data?.user?.id ?? demo.id;
      await prisma.user.upsert({
        where: { id: authId },
        update: { email: demo.email, name: demo.name },
        create: { id: authId, email: demo.email, name: demo.name },
      });

      results.push({
        email: demo.email,
        status: alreadyExists ? "already_exists" : "created",
        id: authId,
      });
    } catch (err) {
      results.push({ email: demo.email, status: "error", message: String(err) });
    }
  }

  return NextResponse.json({ results });
}
