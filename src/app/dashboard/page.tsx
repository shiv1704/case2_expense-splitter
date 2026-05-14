import Link from "next/link";
import { Users } from "lucide-react";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeGroupBalances } from "@/lib/balances";

const GROUP_COLORS = [
  "#1B7DF0",
  "#10B981",
  "#7C3AED",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
];

function groupColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) % GROUP_COLORS.length;
  return GROUP_COLORS[Math.abs(hash)];
}

export default async function DashboardPage() {
  const user = await getAuthUser();

  const memberships = await prisma.groupMember.findMany({
    where: { user_id: user!.id },
    include: {
      group: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { joined_at: "desc" },
  });

  const groupBalances = await Promise.all(
    memberships.map(async ({ group }) => {
      const balances = await computeGroupBalances(group.id);
      const mine = balances.find((b) => b.userId === user!.id);
      return { groupId: group.id, balance: mine?.netBalance ?? 0 };
    })
  );

  const totalBalance = groupBalances.reduce((sum, g) => sum + g.balance, 0);
  const balanceByGroup = Object.fromEntries(
    groupBalances.map((g) => [g.groupId, g.balance])
  );

  return (
    <div>
      {/* Hero card — always blue gradient, balance shown inside */}
      <div
        className="mb-8 rounded-2xl p-6 text-white"
        style={{
          background: "linear-gradient(135deg, #1B7DF0 0%, #0EA5E9 100%)",
        }}
      >
        <p className="text-sm font-medium text-white/70">Overall balance</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-extrabold tabular-nums">
              {Math.abs(totalBalance) <= 0.005
                ? "All settled up 🎉"
                : totalBalance > 0
                ? `+$${totalBalance.toFixed(2)}`
                : `-$${Math.abs(totalBalance).toFixed(2)}`}
            </p>
            {Math.abs(totalBalance) > 0.005 && (
              <p className="mt-1 text-sm text-white/70">
                {totalBalance > 0 ? "you are owed" : "you owe"}
              </p>
            )}
          </div>
          {memberships.length > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold">{memberships.length}</p>
              <p className="text-xs text-white/70">
                {memberships.length === 1 ? "group" : "groups"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Your groups</h1>
        <div className="flex gap-2">
          <Link
            href="/groups/join"
            className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6B7280] transition hover:bg-white hover:text-[#1A1A2E]"
          >
            Join group
          </Link>
          <Link
            href="/groups/new"
            className="rounded-lg bg-[#1B7DF0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1567CC]"
          >
            + Create group
          </Link>
        </div>
      </div>

      {memberships.length === 0 ? (
        /* Empty state */
        <div className="mt-16 flex flex-col items-center gap-5 text-center">
          <div className="text-6xl">🏠</div>
          <div>
            <p className="text-lg font-semibold text-[#1A1A2E]">No groups yet</p>
            <p className="mt-1 text-sm text-[#6B7280]">
              Create a group or join one with an invite code
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/groups/join"
              className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#6B7280] hover:bg-[#F7F8FA]"
            >
              Join with invite code
            </Link>
            <Link
              href="/groups/new"
              className="rounded-lg bg-[#1B7DF0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1567CC]"
            >
              Create your first group
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ group }) => {
            const bal = balanceByGroup[group.id] ?? 0;
            const color = groupColor(group.name);
            return (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 transition hover:-translate-y-0.5 hover:border-transparent hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    {/* Colored avatar square */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {group.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#1A1A2E]">
                        {group.name}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-[#6B7280]">
                        <Users className="h-3 w-3" />
                        {group._count.members}{" "}
                        {group._count.members === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#F7F8FA] pt-3">
                    <span className="font-mono text-xs text-[#6B7280]">
                      #{group.invite_code}
                    </span>
                    {Math.abs(bal) > 0.005 ? (
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          bal > 0 ? "text-[#10B981]" : "text-[#EF4444]"
                        }`}
                      >
                        {bal > 0
                          ? `+$${bal.toFixed(2)}`
                          : `-$${Math.abs(bal).toFixed(2)}`}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#10B981]/10 px-2 py-0.5 text-xs font-medium text-[#10B981]">
                        settled ✓
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
