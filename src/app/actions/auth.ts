"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function signIn(formData: FormData) {
  const email    = (formData.get("email")    as string).trim();
  const password = (formData.get("password") as string).trim();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Invalid email or password")}`);
  }

  try {
    await prisma.user.upsert({
      where:  { email: data.user.email! },
      update: {},
      create: {
        id:    data.user.id,
        email: data.user.email!,
        name:  data.user.email!.split("@")[0],
      },
    });
  } catch {
    // Non-fatal — user may already exist; continue
  }

  redirect("/dashboard");
}

export async function register(formData: FormData) {
  const name     = (formData.get("name")     as string).trim();
  const email    = (formData.get("email")    as string).trim();
  const password = (formData.get("password") as string);

  if (!name)
    redirect(`/register?error=${encodeURIComponent("Name is required")}`);
  if (!email)
    redirect(`/register?error=${encodeURIComponent("Email is required")}`);
  if (!password || password.length < 8)
    redirect(`/register?error=${encodeURIComponent("Password must be at least 8 characters")}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    redirect(`/register?error=${encodeURIComponent(error?.message ?? "Registration failed")}`);
  }

  try {
    await prisma.user.upsert({
      where:  { email },
      update: { name },
      create: { id: data.user.id, email, name },
    });
  } catch {
    redirect(`/register?error=${encodeURIComponent("Database error creating user")}`);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const store = await cookies();
  store.delete("pocket-demo");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
