"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE } from "@/lib/session";

const DEMO_USERS = {
  alice:   { id: "11111111-1111-4111-8111-111111111111", email: "alice@demo.com",  name: "Alice"   },
  bob:     { id: "22222222-2222-4222-8222-222222222222", email: "bob@demo.com",     name: "Bob"     },
  charlie: { id: "33333333-3333-4333-8333-333333333333", email: "charlie@demo.com", name: "Charlie" },
} as const;

export async function loginAsDemo(key: keyof typeof DEMO_USERS) {
  const user = DEMO_USERS[key];
  const store = await cookies();
  store.set(DEMO_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });
  redirect("/dashboard");
}
