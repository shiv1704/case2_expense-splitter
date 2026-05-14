import Link from "next/link";
import { Users, Hash, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeGroupBalances } from "@/lib/balances";

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

  // Per-group balance for current user
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
      {/* Overall balance hero */}
      {memberships.length > 0 && (
        <div
          className={`mb-8 rounded-2xl p-6 ${
            totalBalance > 0.005
              ? "border border-[#10B981]/20 bg-[#10B981]/8"
              : totalBalance < -0.005
              ? "border border-[#EF4444]/20 bg-[#EF4444]/8"
              : "border border-[#E5E7EB] bg-white"
          }`}
        >
          <p className="text-sm font-medium text-[#6B7280]">Overall balance</p>
          <div className="mt-2 flex items-center gap-3">
            {totalBalance > 0.005 ? (
              <TrendingUp className="h-7 w-7 text-[#10B981]" />
            ) : totalBalance < -0.005 ? (
              <TrendingDown className="h-7 w-7 text-[#EF4444]" />
            ) : (
              <Minus className="h-7 w-7 text-[#6B7280]" />
            )}
            <p
              className={`text-3xl font-extrabold tabular-nums ${
                totalBalance > 0.005
                  ? "text-[#10B981]"
                  : totalBalance < -0.005
                  ? "text-[#EF4444]"
                  : "text-[#6B7280]"
              }`}
            >
              {totalBalance > 0.005
                ? `You are owed $${totalBalance.toFixed(2)}`
                : totalBalance < -0.005
                ? `You owe $${Math.abs(totalBalance).toFixed(2)}`
                : "All settled up"}
            </p>
          </div>
        </div>
      )}

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
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1B7DF0]/10">
            <Users className="h-8 w-8 text-[#1B7DF0]" />
          </div>
          <div>
            <p className="font-semibold text-[#1A1A2E]">No groups yet</p>
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
            return (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex flex-col gap-4 rounded-xl border border-[#E5E7EB] bg-white p-5 transition hover:border-[#1B7DF0]/30 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold leading-snug text-[#1A1A2E]">
                      {group.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 rounded bg-[#F7F8FA] px-2 py-0.5 font-mono text-xs text-[#6B7280]">
                      <Hash className="h-3 w-3" />
                      {group.invite_code}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                      <Users className="h-3.5 w-3.5" />
                      {group._count.members}{" "}
                      {group._count.members === 1 ? "member" : "members"}
                    </span>
                    {Math.abs(bal) > 0.005 ? (
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          bal > 0 ? "text-[#10B981]" : "text-[#EF4444]"
                        }`}
                      >
                        {bal > 0
                          ? `+$${bal.toFixed(2)}`
                          : `-$${Math.abs(bal).toFixed(2)}`}
                      </span>
                    ) : (
                      <span className="text-xs text-[#6B7280]">settled</span>
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
