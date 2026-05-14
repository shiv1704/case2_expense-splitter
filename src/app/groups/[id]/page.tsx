import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  PERCENTAGE: "Percentage",
  FIXED: "Fixed",
};

export default async function GroupPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab = "expenses" } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-zinc-900">{group.name}</h1>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2">
            <span className="text-xs font-medium text-zinc-500">Invite code</span>
            <span className="font-mono text-lg font-bold tracking-widest text-zinc-900">
              {group.invite_code}
            </span>
          </div>
        </div>
      </div>

      {/* Members */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Members · {group.members.length}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {group.members.map(({ user: member }) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
                {member.name[0].toUpperCase()}
              </span>
              <span className="text-sm text-zinc-700">
                {member.name}
                {member.id === user!.id && (
                  <span className="ml-1 text-zinc-400">(you)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 w-fit">
        {(["expenses", "balances"] as const).map((t) => (
          <Link
            key={t}
            href={`?tab=${t}`}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === t
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t === "expenses" ? "Expenses" : "Balances"}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Expenses · {expenses.length}
            </h2>
            <AddExpenseForm groupId={id} members={members} />
          </div>

          {expenses.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-400">
              No expenses yet. Add the first one above.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {expenses.map((expense) => (
                <li
                  key={expense.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-zinc-900">
                        {expense.title}
                      </span>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                        <span>{expense.payer.name} paid</span>
                        <span>·</span>
                        <span>
                          {new Date(expense.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </span>
                        <span>·</span>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600">
                          {SPLIT_LABEL[expense.split_type]}
                        </span>
                      </div>
                    </div>
                    <span className="text-lg font-bold tabular-nums text-zinc-900">
                      ${Number(expense.total_amount).toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {expense.splits.map((split) => (
                      <div
                        key={split.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate text-zinc-500">
                          {split.user.name}
                          {split.user.id === user!.id && (
                            <span className="ml-1 text-zinc-400">(you)</span>
                          )}
                        </span>
                        <span className="ml-2 shrink-0 tabular-nums text-zinc-700">
                          ${Number(split.amount).toFixed(2)}
                          {split.percentage !== null && (
                            <span className="ml-1 text-zinc-400">
                              ({Number(split.percentage).toFixed(0)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
