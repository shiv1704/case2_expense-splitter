import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const memberships = await prisma.groupMember.findMany({
    where: { user_id: user!.id },
    include: {
      group: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { joined_at: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Your groups</h1>
        <div className="flex gap-2">
          <Link
            href="/groups/join"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Join group
          </Link>
          <Link
            href="/groups/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Create group
          </Link>
        </div>
      </div>

      {memberships.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-zinc-500">You're not in any groups yet.</p>
          <div className="flex gap-2">
            <Link
              href="/groups/join"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Join with invite code
            </Link>
            <Link
              href="/groups/new"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Create your first group
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ group }) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-zinc-900 leading-snug">
                    {group.name}
                  </span>
                  <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-500">
                    {group.invite_code}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  {group._count.members}{" "}
                  {group._count.members === 1 ? "member" : "members"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
