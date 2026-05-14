/**
 * One-time (idempotent) setup route: ensures the three demo users exist in
 * Supabase Auth with a known password so the email+password form works.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env (Supabase Dashboard →
 * Settings → API → "service_role secret").
 *
 * NOTE: Go to Supabase Dashboard → Authentication → Providers → Email →
 * turn OFF "Confirm email" so new sign-ups don't require email verification.
 *
 * Hit once after deploying: GET /api/setup-demo
 * Safe to call repeatedly — upserts each demo account via the Admin REST API.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USERS = [
  { id: "11111111-1111-4111-8111-111111111111", email: "alice@demo.com",   name: "Alice",   password: "demo1234" },
  { id: "22222222-2222-4222-8222-222222222222", email: "bob@demo.com",     name: "Bob",     password: "demo1234" },
  { id: "33333333-3333-4333-8333-333333333333", email: "charlie@demo.com", name: "Charlie", password: "demo1234" },
];

async function adminFetch(path: string, method: string, body: object) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/${path}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json() as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const results = [];

  for (const demo of DEMO_USERS) {
    try {
      // Try to create first (pins the UUID via the Admin REST API body)
      const create = await adminFetch("users", "POST", {
        id: demo.id,
        email: demo.email,
        password: demo.password,
        email_confirm: true,
      });

      if (!create.ok) {
        // User likely already exists — update password + email instead
        const update = await adminFetch(`users/${demo.id}`, "PUT", {
          email: demo.email,
          password: demo.password,
          email_confirm: true,
        });

        if (!update.ok) {
          results.push({
            email: demo.email,
            status: "error",
            message: (update.json.msg ?? update.json.message ?? JSON.stringify(update.json)) as string,
          });
          continue;
        }
      }

      // Ensure Prisma User row matches
      await prisma.user.upsert({
        where:  { id: demo.id },
        update: { email: demo.email, name: demo.name },
        create: { id: demo.id, email: demo.email, name: demo.name },
      });

      results.push({ email: demo.email, status: create.ok ? "created" : "updated" });
    } catch (err) {
      results.push({ email: demo.email, status: "error", message: String(err) });
    }
  }

  return NextResponse.json({ results });
}
