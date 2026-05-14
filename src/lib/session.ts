import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type SessionUser = { id: string; email: string; name: string };

export const DEMO_COOKIE = "pocket-demo";

/** Read the current user from either a Supabase session or the demo cookie. */
export async function getAuthUser(): Promise<SessionUser | null> {
  // 1. Try Supabase session (real accounts)
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      // Look up real name from DB
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser) return { id: dbUser.id, email: dbUser.email, name: dbUser.name };
      return { id: user.id, email: user.email!, name: user.email!.split("@")[0] };
    }
  } catch {
    // Supabase client may throw if env vars are missing
  }

  // 2. Fall back to demo cookie
  const store = await cookies();
  const raw = store.get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}
