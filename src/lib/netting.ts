/** A user's net position across all expenses in a group. */
export type BalanceEntry = {
  userId: string;
  name: string;
  /** Positive = this person is owed money. Negative = this person owes money. */
  netBalance: number;
};

/** A single directed payment that settles part of the debt graph. */
export type Settlement = {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
};

const EPSILON = 0.005; // treat amounts < ½ cent as zero (float guard)

/**
 * Returns the minimum-transaction list needed to settle all balances.
 *
 * Algorithm — greedy max-match:
 *  1. Split entries into creditors (positive) and debtors (negative).
 *  2. Sort both lists descending by absolute value.
 *  3. Match the largest creditor with the largest debtor.
 *  4. Emit a transaction for min(creditor, debtor).
 *  5. Reduce both; remove any that reach zero; re-sort; repeat.
 */
export function minimizeTransactions(balances: BalanceEntry[]): Settlement[] {
  const transactions: Settlement[] = [];

  const creditors: Array<{ userId: string; name: string; amount: number }> = [];
  const debtors: Array<{ userId: string; name: string; amount: number }> = [];

  for (const b of balances) {
    if (b.netBalance > EPSILON) {
      creditors.push({ userId: b.userId, name: b.name, amount: b.netBalance });
    } else if (b.netBalance < -EPSILON) {
      debtors.push({ userId: b.userId, name: b.name, amount: -b.netBalance });
    }
  }

  const byAmountDesc = (
    a: { amount: number },
    b: { amount: number }
  ): number => b.amount - a.amount;

  creditors.sort(byAmountDesc);
  debtors.sort(byAmountDesc);

  while (creditors.length > 0 && debtors.length > 0) {
    const creditor = creditors[0];
    const debtor = debtors[0];

    // Round to the nearest cent to avoid accumulating floating-point drift
    const amount =
      Math.round(Math.min(creditor.amount, debtor.amount) * 100) / 100;

    transactions.push({
      from: debtor.userId,
      fromName: debtor.name,
      to: creditor.userId,
      toName: creditor.name,
      amount,
    });

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < EPSILON) creditors.shift();
    if (debtor.amount < EPSILON) debtors.shift();

    // Re-sort so the next iteration still picks the largest remaining pair
    creditors.sort(byAmountDesc);
    debtors.sort(byAmountDesc);
  }

  return transactions;
}
