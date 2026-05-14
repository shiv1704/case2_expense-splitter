import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=Missing+auth+code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "Auth failed")}`
    );
  }

  const { id, email } = data.user;

  try {
    await prisma.user.upsert({
      where: { email: email! },
      update: {},
      create: { id, email: email!, name: email!.split("@")[0] },
    });
  } catch {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Database error saving new user")}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
