import Link from "next/link";
import { getAuthUser } from "@/lib/session";
import { signOut } from "@/app/actions/auth";

export async function Navbar() {
  const user = await getAuthUser();

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/dashboard"
          className="text-xl font-extrabold tracking-tight text-[#1B7DF0]"
        >
          Pocket
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#6B7280] sm:block">
              {user.name}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B7DF0]/10 text-sm font-bold text-[#1B7DF0]">
              {user.name[0].toUpperCase()}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#6B7280] transition hover:bg-[#F7F8FA] hover:text-[#1A1A2E]"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
