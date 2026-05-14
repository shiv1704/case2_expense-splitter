import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeGroupBalances } from "@/lib/balances";
import { minimizeTransactions } from "@/lib/netting";
import { AddExpenseForm } from "./add-expense-form";
import { BalancesTab } from "./balances-tab";
import { CopyInviteButton } from "./copy-invite-button";
import { ActivityTab, type ActivityEvent } from "./activity-tab";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const SPLIT_LABEL: Record<string, string> = {
  EQUAL: "Equal",
  PERCENTAGE: "%",
  FIXED: "Fixed",
};

function getCategoryEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("rent") || t.includes("house") || t.includes("apartment")) return "🏠";
  if (t.includes("groceri") || t.includes("market") || t.includes("supermarket")) return "🛒";
  if (t.includes("electric") || t.includes("power") || t.includes("utility")) return "⚡";
  if (t.includes("dinner") || t.includes("lunch") || t.includes("breakfast") || t.includes("restaurant") || t.includes("pizza") || t.includes("food")) return "🍕";
  if (t.includes("internet") || t.includes("wifi") || t.includes("network")) return "📡";
  if (t.includes("netflix") || t.includes("movie") || t.includes("hulu") || t.includes("streaming") || t.includes("tv")) return "📺";
  if (t.includes("uber") || t.includes("taxi") || t.includes("car") || t.includes("gas") || t.includes("petrol")) return "🚗";
  if (t.includes("flight") || t.includes("hotel") || t.includes("travel") || t.includes("airbnb")) return "✈️";
  if (t.includes("shop") || t.includes("amazon") || t.includes("mall")) return "🛍️";
  if (t.includes("medicine") || t.includes("pharmacy") || t.includes("doctor")) return "💊";
  if (t.includes("coffee") || t.includes("cafe") || t.includes("starbucks")) return "☕";
  return "🧾";
}

function groupByMonth<T extends { created_at: Date }>(expenses: T[]) {
  const map = new Map<string, T[]>();
  for (const exp of expenses) {
    const key = new Date(exp.created_at)
      .toLocaleDateString("en-US", { month: "long", year: "numeric" })
      .toUpperCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(exp);
  }
  return map;
}

export default async function GroupPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab = "expenses" } = await searchParams;

  const user = await getAuthUser();

  const [group, expenses, balances, settlementHistory] = await Promise.all([
    prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
          orderBy: { joined_at: "asc" },
        },
      },
    }),
    prisma.expense.findMany({
      where: { group_id: id },
      include: {
        payer: { select: { id: true, name: true } },
        splits: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { amount: "desc" },
        },
      },
      orderBy: { created_at: "desc" },
    }),
    computeGroupBalances(id),
    prisma.settlement.findMany({
      where: { group_id: id },
      include: {
        from: { select: { id: true, name: true } },
        to: { select: { id: true, name: true } },
      },
      orderBy: { settled_at: "desc" },
    }),
  ]);

  if (!group) notFound();

  const isMember = group.members.some((m) => m.user_id === user!.id);
  if (!isMember) redirect("/dashboard");

  const members = group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
  }));

  const suggested = minimizeTransactions(balances);

  const history = settlementHistory.map((s) => ({
    id: s.id,
    fromId: s.from.id,
    fromName: s.from.name,
    toId: s.to.id,
    toName: s.to.name,
    amount: Number(s.amount),
    settledAt: s.settled_at.toISOString(),
  }));

  const myBalance = balances.find((b) => b.userId === user!.id);
  const monthGroups = groupByMonth(expenses);

  const activityEvents: ActivityEvent[] = [
    ...expenses.map((e) => ({
      type: "expense" as const,
      id: e.id,
      title: e.title,
      payerName: e.payer.name,
      amount: Number(e.total_amount),
      date: e.created_at.toISOString(),
    })),
    ...settlementHistory.map((s) => ({
      type: "settlement" as const,
      id: s.id,
      fromName: s.from.name,
      toName: s.to.name,
      amount: Number(s.amount),
      date: s.settled_at.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const tabs = ["expenses", "balances", "activity"] as const;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      {/* Full-width blue gradient header */}
      <div className="bg-gradient-to-br from-[#1B7DF0] to-[#0EA5E9] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard"
            className="mb-4 inline-block text-sm text-white/70 transition hover:text-white"
          >
            ← Dashboard
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white">{group.name}</h1>
              <div className="mt-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-white/70" />
                <span className="text-sm text-white/80">
                  {group.members.length}{" "}
                  {group.members.length === 1 ? "member" : "members"}
                </span>
              </div>
            </div>
            <CopyInviteButton code={group.invite_code} />
          </div>

          {/* My balance chip */}
          {myBalance && Math.abs(myBalance.netBalance) > 0.005 && (
            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${
                myBalance.netBalance > 0
                  ? "bg-[#10B981]/20 text-[#6EE7B7]"
                  : "bg-[#EF4444]/20 text-[#FCA5A5]"
              }`}
            >
              {myBalance.netBalance > 0
                ? `You are owed $${myBalance.netBalance.toFixed(2)}`
                : `You owe $${Math.abs(myBalance.netBalance).toFixed(2)}`}
            </div>
          )}
        </div>
      </div>

      {/* Sticky tab bar */}
      <div className="sticky top-14 z-10 border-b border-[#E5E7EB] bg-white px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex gap-0">
            {tabs.map((t) => (
              <Link
                key={t}
                href={`?tab=${t}`}
                className={`px-5 py-3.5 text-sm font-medium transition border-b-2 ${
                  tab === t
                    ? "border-[#1B7DF0] text-[#1B7DF0]"
                    : "border-transparent text-[#6B7280] hover:text-[#1A1A2E]"
                }`}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Members */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Members
          </h2>
          <ul className="flex flex-wrap gap-2">
            {group.members.map(({ user: member }) => (
              <li
                key={member.id}
                className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1B7DF0]/10 text-xs font-bold text-[#1B7DF0]">
                  {member.name[0].toUpperCase()}
                </span>
                <span className="text-sm text-[#1A1A2E]">
                  {member.name}
                  {member.id === user!.id && (
                    <span className="ml-1 text-[#6B7280]">(you)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Tab content */}
        {tab === "balances" ? (
          <BalancesTab
            groupId={id}
            currentUserId={user!.id}
            balances={balances}
            suggested={suggested}
            history={history}
          />
        ) : tab === "activity" ? (
          <ActivityTab events={activityEvents} />
        ) : (
          <section>
            {/* Expenses header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
              </h2>
              <AddExpenseForm groupId={id} members={members} />
            </div>

            {expenses.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="text-5xl">🧾</div>
                <p className="text-sm text-[#6B7280]">
                  No expenses yet. Add the first one above.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Array.from(monthGroups.entries()).map(([month, monthExpenses]) => (
                  <div key={month}>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                      {month}
                    </h3>
                    <ul className="space-y-3">
                      {monthExpenses.map((expense) => {
                        const emoji = getCategoryEmoji(expense.title);
                        return (
                          <li
                            key={expense.id}
                            className="rounded-xl border border-[#E5E7EB] bg-white p-4 transition hover:shadow-sm"
                          >
                            <div className="flex flex-wrap items-start gap-3">
                              {/* Emoji category icon */}
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F8FA] text-xl">
                                {emoji}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <span className="font-semibold text-[#1A1A2E]">
                                      {expense.title}
                                    </span>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                                      <span>{expense.payer.name} paid</span>
                                      <span>·</span>
                                      <span>
                                        {new Date(expense.created_at).toLocaleDateString(
                                          "en-US",
                                          { month: "short", day: "numeric" }
                                        )}
                                      </span>
                                      <span>·</span>
                                      <span className="rounded bg-[#F7F8FA] px-1.5 py-0.5 font-medium text-[#6B7280]">
                                        {SPLIT_LABEL[expense.split_type]}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-lg font-bold tabular-nums text-[#1A1A2E]">
                                    ${Number(expense.total_amount).toFixed(2)}
                                  </span>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                                  {expense.splits.map((split) => (
                                    <div
                                      key={split.id}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span
                                        className={`truncate ${
                                          split.user.id === user!.id
                                            ? "font-semibold text-[#1B7DF0]"
                                            : "text-[#6B7280]"
                                        }`}
                                      >
                                        {split.user.name}
                                        {split.user.id === user!.id && (
                                          <span className="ml-1 font-normal text-[#6B7280]">
                                            (you)
                                          </span>
                                        )}
                                      </span>
                                      <span className="ml-2 shrink-0 tabular-nums text-[#1A1A2E]">
                                        ${Number(split.amount).toFixed(2)}
                                        {split.percentage !== null && (
                                          <span className="ml-1 text-[#6B7280]">
                                            ({Number(split.percentage).toFixed(0)}%)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* FAB — only on expenses tab */}
      {tab === "expenses" && (
        <AddExpenseForm groupId={id} members={members} variant="fab" />
      )}
    </div>
  );
}
