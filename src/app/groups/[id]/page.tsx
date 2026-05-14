import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeGroupBalances } from "@/lib/balances";
import { minimizeTransactions } from "@/lib/netting";
import { formatINR } from "@/lib/format";
import { checkAndGenerateRecurring } from "@/lib/recurring";
import { AddExpenseForm } from "./add-expense-form";
import { BalancesTab } from "./balances-tab";
import { CopyInviteButton } from "./copy-invite-button";
import { GroupSettings } from "./group-settings";
import { ActivityTab, type ActivityEvent } from "./activity-tab";
import { ExpenseList, type ExpenseRow } from "./expense-list";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function GroupPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab = "expenses" } = await searchParams;

  const user = await getAuthUser();

  // Auto-generate any due recurring expenses before fetching
  await checkAndGenerateRecurring(id);

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

  // Build a lookup so auto-generated copies can show their parent's title
  const expenseById = new Map(expenses.map((e) => [e.id, e]));

  const expenseRows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    title: e.title,
    total_amount: Number(e.total_amount),
    split_type: e.split_type,
    created_at: e.created_at.toISOString(),
    is_recurring: e.is_recurring,
    parent_expense_id: e.parent_expense_id,
    recurrence_rule: e.recurrence_rule,
    next_due_date: e.next_due_date?.toISOString() ?? null,
    receipt_url: e.receipt_url,
    receipt_filename: e.receipt_filename,
    payer: { id: e.payer.id, name: e.payer.name },
    splits: e.splits.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      amount: Number(s.amount),
      percentage: s.percentage !== null ? Number(s.percentage) : null,
      user: { id: s.user.id, name: s.user.name },
    })),
    parentTitle: e.parent_expense_id
      ? (expenseById.get(e.parent_expense_id)?.title ?? undefined)
      : undefined,
  }));

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
  const isCreator = group.created_by === user!.id;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      {/* Full-width gradient header */}
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
            {/* Invite code + settings */}
            <div className="flex items-center gap-2">
              <CopyInviteButton code={group.invite_code} />
              <GroupSettings
                groupId={id}
                groupName={group.name}
                isCreator={isCreator}
              />
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
                ? `You are owed ${formatINR(myBalance.netBalance)}`
                : `You owe ${formatINR(Math.abs(myBalance.netBalance))}`}
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
        {/* Members — pills */}
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Members
          </h2>
          <ul className="flex flex-wrap gap-2">
            {group.members.map(({ user: member }) => (
              <li
                key={member.id}
                className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#1A1A2E]"
              >
                {member.name}
                {member.id === user!.id && (
                  <span className="ml-1 text-[#6B7280]">(you)</span>
                )}
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
              <ExpenseList expenses={expenseRows} currentUserId={user!.id} />
            )}
          </section>
        )}
      </div>

      {tab === "expenses" && (
        <AddExpenseForm groupId={id} members={members} variant="fab" />
      )}
    </div>
  );
}
