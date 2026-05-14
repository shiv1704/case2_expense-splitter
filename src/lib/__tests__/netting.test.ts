import { describe, it, expect } from "vitest";
import { minimizeTransactions, type BalanceEntry } from "../netting";

// ─── helpers ────────────────────────────────────────────────────────────────

function totalSettled(settlements: ReturnType<typeof minimizeTransactions>) {
  return Math.round(
    settlements.reduce((s, t) => s + t.amount, 0) * 100
  ) / 100;
}

// ─── two-person ──────────────────────────────────────────────────────────────

describe("two-person simple case", () => {
  it("one person owes the other", () => {
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 100 },
      { userId: "B", name: "Bob", netBalance: -100 },
    ];
    const result = minimizeTransactions(balances);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual<(typeof result)[0]>({
      from: "B",
      fromName: "Bob",
      to: "A",
      toName: "Alice",
      amount: 100,
    });
  });

  it("partial amount (non-integer)", () => {
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 33.33 },
      { userId: "B", name: "Bob", netBalance: -33.33 },
    ];
    const [t] = minimizeTransactions(balances);
    expect(t.amount).toBe(33.33);
  });
});

// ─── already balanced ────────────────────────────────────────────────────────

describe("already-balanced group", () => {
  it("all zero balances → no transactions", () => {
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 0 },
      { userId: "B", name: "Bob", netBalance: 0 },
      { userId: "C", name: "Carol", netBalance: 0 },
    ];
    expect(minimizeTransactions(balances)).toEqual([]);
  });

  it("empty input → no transactions", () => {
    expect(minimizeTransactions([])).toEqual([]);
  });

  it("sub-cent dust balances are treated as zero", () => {
    // Floating-point noise — should not generate a transaction
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 0.001 },
      { userId: "B", name: "Bob", netBalance: -0.001 },
    ];
    expect(minimizeTransactions(balances)).toEqual([]);
  });
});

// ─── 3-person example from the CLAUDE.md spec ────────────────────────────────

describe("3-person example from spec brief", () => {
  /**
   * Expense: Alice paid $1200, split B=40 % ($480), A=30 % ($360), C=30 % ($360).
   * Net balances:
   *   Alice  = 1200 - 360 = +840  (paid; keeps own share)
   *   Bob    = -480         (owes Alice 40 %)
   *   Carol  = -360         (owes Alice 30 %)
   *
   * Single expense → algorithm just mirrors the direct debts.
   */
  it("single expense, no cross-debt netting needed", () => {
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 840 },
      { userId: "B", name: "Bob", netBalance: -480 },
      { userId: "C", name: "Carol", netBalance: -360 },
    ];

    const result = minimizeTransactions(balances);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      from: "B", fromName: "Bob",
      to: "A",   toName: "Alice",
      amount: 480,
    });
    expect(result).toContainEqual({
      from: "C", fromName: "Carol",
      to: "A",   toName: "Alice",
      amount: 360,
    });
    expect(totalSettled(result)).toBe(840);
  });

  /**
   * Second expense added: Carol paid $100, Bob = 100 % share.
   * ("B also owes C 100 separately" from the spec brief.)
   *
   * Updated net balances:
   *   Alice  = +840          (unchanged)
   *   Bob    = -480 - 100 = -580  (owes Alice 480 + owes Carol 100)
   *   Carol  = -360 + 100 = -260  (owes Alice 360, but receives 100 from Bob)
   *
   * Without netting: 3 transactions (Bob→Alice, Bob→Carol, Carol→Alice).
   * With net-balance greedy: 2 transactions — one less.
   *
   * NOTE: the CLAUDE.md brief states "B pays A 480" which is a typo;
   * the correct minimum-transaction settlement is Bob→Alice 580
   * because Bob's full net obligation is -580, not -480.
   */
  it("two expenses — cross-debt netting reduces 3 transactions to 2", () => {
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 840 },
      { userId: "B", name: "Bob", netBalance: -580 },
      { userId: "C", name: "Carol", netBalance: -260 },
    ];

    const result = minimizeTransactions(balances);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      from: "B", fromName: "Bob",
      to: "A",   toName: "Alice",
      amount: 580,
    });
    expect(result).toContainEqual({
      from: "C", fromName: "Carol",
      to: "A",   toName: "Alice",
      amount: 260,
    });
    expect(totalSettled(result)).toBe(840);
  });
});

// ─── multi-creditor / multi-debtor ───────────────────────────────────────────

describe("multiple creditors and debtors", () => {
  /**
   * A=+300, B=+200, C=−100, D=−400  (sum = 0 ✓)
   *
   * Greedy trace:
   *   Step 1: D(400) vs A(300) → D→A 300;  D=100, A=0
   *   Step 2: D(100) vs B(200) → D→B 100;  D=0,   B=100
   *   Step 3: C(100) vs B(100) → C→B 100;  C=0,   B=0
   * Result: 3 transactions, $500 total settled.
   */
  it("4-person, two creditors two debtors", () => {
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 300 },
      { userId: "B", name: "Bob", netBalance: 200 },
      { userId: "C", name: "Carol", netBalance: -100 },
      { userId: "D", name: "Dave", netBalance: -400 },
    ];

    const result = minimizeTransactions(balances);

    expect(result).toHaveLength(3);
    expect(totalSettled(result)).toBe(500);

    // All transactions must have a positive amount
    expect(result.every((t) => t.amount > 0)).toBe(true);

    // From must always be a debtor, To must always be a creditor
    const creditorIds = new Set(["A", "B"]);
    const debtorIds = new Set(["C", "D"]);
    for (const t of result) {
      expect(debtorIds.has(t.from)).toBe(true);
      expect(creditorIds.has(t.to)).toBe(true);
    }
  });

  /**
   * One debtor owes three creditors (equal fractional amounts).
   * D=-100, A=+33.33, B=+33.33, C=+33.34  (sum ≈ 0 within rounding)
   */
  it("one debtor settling with three creditors", () => {
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 33.33 },
      { userId: "B", name: "Bob", netBalance: 33.33 },
      { userId: "C", name: "Carol", netBalance: 33.34 },
      { userId: "D", name: "Dave", netBalance: -100 },
    ];

    const result = minimizeTransactions(balances);

    // All payments come FROM Dave
    expect(result.every((t) => t.from === "D")).toBe(true);
    // Total paid out equals total owed (within 1 cent rounding tolerance)
    expect(Math.abs(totalSettled(result) - 100)).toBeLessThan(0.01);
    expect(result).toHaveLength(3);
  });

  /**
   * Greedy always picks the globally largest pair, so it minimises
   * transaction count when an exact match exists.
   *
   * A=+50, B=+50, C=−50, D=−50 → optimal is 2 transactions (C→A, D→B).
   */
  it("symmetric debts settle in exactly 2 transactions", () => {
    const balances: BalanceEntry[] = [
      { userId: "A", name: "Alice", netBalance: 50 },
      { userId: "B", name: "Bob", netBalance: 50 },
      { userId: "C", name: "Carol", netBalance: -50 },
      { userId: "D", name: "Dave", netBalance: -50 },
    ];

    const result = minimizeTransactions(balances);
    expect(result).toHaveLength(2);
    expect(totalSettled(result)).toBe(100);
  });
});
