import Link from "next/link";
import { Users, ReceiptText } from "lucide-react";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeGroupBalances } from "@/lib/balances";
import { formatINR } from "@/lib/format";

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

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
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

  const groupIds = memberships.map((m) => m.group.id);

  const [groupBalancesRaw, recentExpenses] = await Promise.all([
    Promise.all(
      memberships.map(async ({ group }) => {
        const balances = await computeGroupBalances(group.id);
        const mine = balances.find((b) => b.userId === user!.id);
        return { groupId: group.id, balance: mine?.netBalance ?? 0 };
      })
    ),
    groupIds.length > 0
      ? prisma.expense.findMany({
          where: { group_id: { in: groupIds } },
          include: {
            group: { select: { id: true, name: true } },
            payer: { select: { id: true, name: true } },
          },
          orderBy: { created_at: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const totalBalance = groupBalancesRaw.reduce((sum, g) => sum + g.balance, 0);
  const balanceByGroup = Object.fromEntries(
    groupBalancesRaw.map((g) => [g.groupId, g.balance])
  );

  return (
    <div>
      {/* Hero card — blue gradient */}
      <div
        className="mb-8 rounded-2xl p-6 text-white"
        style={{ background: "linear-gradient(135deg, #1B7DF0 0%, #0EA5E9 100%)" }}
      >
        <p className="text-sm font-medium text-white/70">Overall balance</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-extrabold tabular-nums">
              {Math.abs(totalBalance) <= 0.005
                ? "All settled up 🎉"
                : totalBalance > 0
                ? `+${formatINR(totalBalance)}`
                : `-${formatINR(Math.abs(totalBalance))}`}
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

      {/* Header row */}
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
        <>
          {/* Groups — full-width list rows */}
          <ul className="mt-4 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
            {memberships.map(({ group }, idx) => {
              const bal = balanceByGroup[group.id] ?? 0;
              const color = groupColor(group.name);
              return (
                <li
                  key={group.id}
                  className={idx > 0 ? "border-t border-[#E5E7EB]" : undefined}
                >
                  <Link
                    href={`/groups/${group.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-[#F7F8FA]"
                  >
                    {/* Colored 40px square avatar */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {group.name[0].toUpperCase()}
                    </div>

                    {/* Center: name + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-[#1A1A2E]">
                        {group.name}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#6B7280]">
                        <Users className="mr-1 inline h-3 w-3" />
                        {group._count.members}{" "}
                        {group._count.members === 1 ? "member" : "members"}
                        <span className="mx-1.5">·</span>
                        <span className="font-mono">#{group.invite_code}</span>
                      </p>
                    </div>

                    {/* Right: balance */}
                    <div className="text-right">
                      {Math.abs(bal) > 0.005 ? (
                        <>
                          <p
                            className={`text-[18px] font-bold tabular-nums ${
                              bal > 0 ? "text-[#10B981]" : "text-[#EF4444]"
                            }`}
                          >
                            {formatINR(Math.abs(bal))}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {bal > 0 ? "you are owed" : "you owe"}
                          </p>
                        </>
                      ) : (
                        <span className="rounded-full bg-[#10B981]/10 px-2.5 py-1 text-xs font-medium text-[#10B981]">
                          settled ✓
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Recent Activity */}
          {recentExpenses.length > 0 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1A1A2E]">
                  Recent Activity
                </h2>
                <Link
                  href={`/groups/${memberships[0].group.id}?tab=activity`}
                  className="text-xs font-medium text-[#1B7DF0] hover:underline"
                >
                  View all →
                </Link>
              </div>
              <ul className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
                {recentExpenses.map((expense, idx) => {
                  const isMyExpense = expense.payer.id === user!.id;
                  return (
                    <li
                      key={expense.id}
                      className={idx > 0 ? "border-t border-[#E5E7EB]" : undefined}
                    >
                      <Link
                        href={`/groups/${expense.group.id}`}
                        className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#F7F8FA]"
                      >
                        <ReceiptText className="h-4 w-4 shrink-0 text-[#6B7280]" />
                        <p className="min-w-0 flex-1 truncate text-sm text-[#1A1A2E]">
                          <span className="font-medium">{expense.group.name}</span>
                          <span className="text-[#6B7280]">
                            {" "}· {expense.title} · {expense.payer.name} paid ·{" "}
                            {timeAgo(expense.created_at)}
                          </span>
                        </p>
                        <span
                          className={`shrink-0 text-sm font-semibold tabular-nums ${
                            isMyExpense ? "text-[#10B981]" : "text-[#6B7280]"
                          }`}
                        >
                          {formatINR(Number(expense.total_amount))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
