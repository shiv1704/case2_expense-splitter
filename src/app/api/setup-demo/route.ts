/**
 * One-time (idempotent) setup route: ensures the three demo users exist in
 * Supabase Auth with a known password so the email+password form works.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env (Supabase Dashboard →
 * Settings → API → "service_role secret").
 *
 * NOTE: Go to Supabase Dashboard → Authentication → Providers → Email →
 * turn OFF "Confirm email" so new sign-ups don't require email verification.
 * (Existing demo users are already confirmed, so this only affects new users.)
 *
 * Hit once after deploying: GET /api/setup-demo
 * Safe to call repeatedly — creates or resets each demo account.
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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results = [];

  for (const demo of DEMO_USERS) {
    try {
      // Try to create first (pins the UUID via the REST body)
      const { data: created, error: createErr } = await admin.auth.admin.createUser(
        { id: demo.id, email: demo.email, password: demo.password, email_confirm: true } as Parameters<
          typeof admin.auth.admin.createUser
        >[0]
      );

      if (!createErr) {
        // Newly created
        await prisma.user.upsert({
          where:  { id: demo.id },
          update: { email: demo.email, name: demo.name },
          create: { id: demo.id, email: demo.email, name: demo.name },
        });
        results.push({ email: demo.email, status: "created", id: created?.user?.id });
        continue;
      }

      // User already exists — update the password and email to ensure they're correct
      const { error: updateErr } = await admin.auth.admin.updateUserById(demo.id, {
        email: demo.email,
        password: demo.password,
        email_confirm: true,
      });

      if (updateErr) {
        results.push({ email: demo.email, status: "error", message: updateErr.message });
        continue;
      }

      await prisma.user.upsert({
        where:  { id: demo.id },
        update: { email: demo.email, name: demo.name },
        create: { id: demo.id, email: demo.email, name: demo.name },
      });

      results.push({ email: demo.email, status: "updated" });
    } catch (err) {
      results.push({ email: demo.email, status: "error", message: String(err) });
    }
  }

  return NextResponse.json({ results });
}
