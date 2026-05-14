import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ShoppingCart, Home, Zap, Utensils, Wifi, Film,
  Car, Plane, ReceiptText, Users, Copy,
} from "lucide-react";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeGroupBalances } from "@/lib/balances";
import { minimizeTransactions } from "@/lib/netting";
import { AddExpenseForm } from "./add-expense-form";
import { BalancesTab } from "./balances-tab";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const SPLIT_LABEL: Record<string, string> = {
  EQUAL: "Equal",
  PERCENTAGE: "%",
  FIXED: "Fixed",
};

function getCategoryIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("rent") || t.includes("house") || t.includes("apartment")) return Home;
  if (t.includes("groceri") || t.includes("market") || t.includes("supermarket")) return ShoppingCart;
  if (t.includes("electric") || t.includes("power") || t.includes("utility")) return Zap;
  if (t.includes("dinner") || t.includes("lunch") || t.includes("breakfast") || t.includes("restaurant") || t.includes("pizza") || t.includes("food")) return Utensils;
  if (t.includes("internet") || t.includes("wifi") || t.includes("network")) return Wifi;
  if (t.includes("netflix") || t.includes("movie") || t.includes("hulu") || t.includes("streaming")) return Film;
  if (t.includes("uber") || t.includes("taxi") || t.includes("car") || t.includes("gas")) return Car;
  if (t.includes("flight") || t.includes("hotel") || t.includes("travel") || t.includes("airbnb")) return Plane;
  return ReceiptText;
}

function groupByMonth<T extends { created_at: Date }>(expenses: T[]) {
  const map = new Map<string, T[]>();
  for (const exp of expenses) {
    const key = new Date(exp.created_at).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
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

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      {/* Full-width header */}
      <div className="bg-gradient-to-br from-[#1B7DF0] to-[#1567CC] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard"
            className="mb-4 inline-block text-sm text-white/70 hover:text-white"
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
            {/* Invite code badge */}
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
              <div>
                <p className="text-xs font-medium text-white/60">Invite code</p>
                <p className="font-mono text-xl font-bold tracking-widest text-white">
                  {group.invite_code}
                </p>
              </div>
              <Copy className="h-4 w-4 text-white/60" />
            </div>
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

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-1 w-fit">
          {(["expenses", "balances"] as const).map((t) => (
            <Link
              key={t}
              href={`?tab=${t}`}
              className={`rounded-lg px-5 py-1.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-white text-[#1A1A2E] shadow-sm"
                  : "text-[#6B7280] hover:text-[#1A1A2E]"
              }`}
            >
              {t === "expenses" ? "Expenses" : "Balances"}
            </Link>
          ))}
        </div>

        {/* Tab content */}
        {tab === "balances" ? (
          <BalancesTab
            groupId={id}
            currentUserId={user!.id}
            balances={balances}
            suggested={suggested}
            history={history}
          />
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1B7DF0]/10">
                  <ReceiptText className="h-7 w-7 text-[#1B7DF0]" />
                </div>
                <p className="text-sm text-[#6B7280]">
                  No expenses yet. Add the first one above.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Array.from(monthGroups.entries()).map(([month, monthExpenses]) => (
                  <div key={month}>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                      {month}
                    </h3>
                    <ul className="space-y-3">
                      {monthExpenses.map((expense) => {
                        const Icon = getCategoryIcon(expense.title);
                        return (
                          <li
                            key={expense.id}
                            className="rounded-xl border border-[#E5E7EB] bg-white p-4 transition hover:shadow-sm"
                          >
                            <div className="flex flex-wrap items-start gap-3">
                              {/* Category icon */}
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B7DF0]/10">
                                <Icon className="h-5 w-5 text-[#1B7DF0]" />
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
    </div>
  );
}
