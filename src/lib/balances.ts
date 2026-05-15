import { prisma } from "@/lib/prisma";
import type { BalanceEntry } from "@/lib/netting";

/**
 * Computes each group member's net balance across all expenses and settlements.
 *
 * Net balance = (sum of total_amount for expenses they paid)
 *             − (sum of split.amount for splits assigned to them)
 *             + (sum of settlement.amount where from_user = them)   // paying off debt
 *             − (sum of settlement.amount where to_user = them)     // receiving payoff
 *
 * Positive  → they are owed money by the group.
 * Negative  → they owe money to the group.
 */
export async function computeGroupBalances(
  groupId: string
): Promise<BalanceEntry[]> {
  const [members, expenses, settlements] = await Promise.all([
    prisma.groupMember.findMany({
      where: { group_id: groupId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.expense.findMany({
      where: { group_id: groupId },
      select: {
        paid_by: true,
        total_amount: true,
        fx_rate_at_creation: true,
        splits: { select: { user_id: true, amount: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { group_id: groupId },
      select: { from_user: true, to_user: true, amount: true },
    }),
  ]);

  const balanceMap = new Map<string, { name: string; balance: number }>();
  for (const m of members) {
    balanceMap.set(m.user.id, { name: m.user.name, balance: 0 });
  }

  for (const expense of expenses) {
    // Convert to group base currency before summing — rate is 1.0 for same-currency expenses
    const rate = Number(expense.fx_rate_at_creation);

    const payer = balanceMap.get(expense.paid_by);
    if (payer) payer.balance += Number(expense.total_amount) * rate;

    for (const split of expense.splits) {
      const member = balanceMap.get(split.user_id);
      if (member) member.balance -= Number(split.amount) * rate;
    }
  }

  for (const s of settlements) {
    const payer = balanceMap.get(s.from_user);
    if (payer) payer.balance += Number(s.amount);

    const receiver = balanceMap.get(s.to_user);
    if (receiver) receiver.balance -= Number(s.amount);
  }

  return Array.from(balanceMap.entries()).map(([userId, { name, balance }]) => ({
    userId,
    name,
    netBalance: Math.round(balance * 100) / 100,
  }));
}
