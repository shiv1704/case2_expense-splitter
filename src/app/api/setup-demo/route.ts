/**
 * One-time (idempotent) setup route: ensures demo users exist in Supabase Auth.
 *
 * GET /api/setup-demo        — creates / resets demo accounts
 * GET /api/setup-demo?debug  — shows raw admin API responses for diagnosis
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in env.
 * NOTE: Supabase Dashboard → Authentication → Providers → Email → turn OFF
 * "Confirm email" so new sign-ups don't need email verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_USERS = [
  { id: "11111111-1111-4111-8111-111111111111", email: "alice@demo.com",   name: "Alice",   password: "demo1234" },
  { id: "22222222-2222-4222-8222-222222222222", email: "bob@demo.com",     name: "Bob",     password: "demo1234" },
  { id: "33333333-3333-4333-8333-333333333333", email: "charlie@demo.com", name: "Charlie", password: "demo1234" },
];

function adminHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
}

function adminUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/${path}`;
}

export async function GET(req: NextRequest) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  // Debug mode: show raw responses without making changes
  if (req.nextUrl.searchParams.has("debug")) {
    const debug = [];
    for (const demo of DEMO_USERS) {
      const getRes = await fetch(adminUrl(`users/${demo.id}`), { headers: adminHeaders() });
      const getBody = await getRes.json();
      debug.push({ email: demo.email, id: demo.id, status: getRes.status, body: getBody });
    }
    return NextResponse.json({ debug });
  }

  const results = [];

  for (const demo of DEMO_USERS) {
    try {
      // Try creating first (POST pins UUID via body)
      const postRes = await fetch(adminUrl("users"), {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ id: demo.id, email: demo.email, password: demo.password, email_confirm: true }),
      });
      const postBody = await postRes.json() as Record<string, unknown>;

      if (postRes.ok) {
        await prisma.user.upsert({
          where:  { id: demo.id },
          update: { email: demo.email, name: demo.name },
          create: { id: demo.id, email: demo.email, name: demo.name },
        });
        results.push({ email: demo.email, status: "created" });
        continue;
      }

      // User exists — update via PUT
      const putRes = await fetch(adminUrl(`users/${demo.id}`), {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({ email: demo.email, password: demo.password, email_confirm: true }),
      });
      const putBody = await putRes.json() as Record<string, unknown>;

      if (!putRes.ok) {
        results.push({
          email: demo.email,
          status: "error",
          createStatus: postRes.status,
          createError: postBody,
          putStatus: putRes.status,
          putError: putBody,
        });
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
