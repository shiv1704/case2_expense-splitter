# Pocket — Roommate Expense Splitter

A web app where users create groups, add expenses with unequal splits, see minimized settlement balances, and settle up with a full audit trail. All data persists in Postgres (Supabase).

## Stack

- **Next.js 16** App Router + TypeScript
- **Tailwind CSS**
- **Supabase** — Postgres + Auth (magic link)
- **Prisma 7** ORM with `@prisma/adapter-pg`
- **Vercel** deployment

## Features

- Magic-link authentication (no passwords for end users)
- Create groups with shareable invite codes
- Add expenses with three split modes: Equal, Percentage, Fixed
- Greedy min-transaction netting algorithm — minimizes the number of payments needed to settle a group
- Settle Up button (visible only to the debtor) creates an auditable Settlement record
- Balance tab shows net positions, suggested settlements, and full payment history

## Demo group

| Email | Name | Password |
|---|---|---|
| jerry@demo.com | Alice | demo1234 |
| bob@demo.com | Bob | demo1234 |
| charlie@demo.com | Charlie | demo1234 |

Group: **Emirates 4B** · invite code `DEMO42`

## Getting started

```bash
npm install
npm run dev
```

## Running tests

```bash
npm test
```

The unit test suite covers the netting algorithm across two-person, three-person, multi-creditor/debtor, and floating-point edge cases.

## Seeding

The demo data is pre-seeded. To re-seed a fresh database:

```bash
npx prisma db seed
```

> Requires a direct Postgres connection on port 5432. If your network blocks it (common on Supabase free tier), apply `prisma/seed.ts` via the Supabase Dashboard SQL editor instead.

---

## Future: International Currency Handling

To support multi-currency groups, each expense would store a `currency` field and an `fx_rate_at_creation` (fetched from an ECB / fixer.io snapshot at the moment the expense is submitted). Balances settle in the group's **base currency**. Historic rates must be locked at expense creation time — never recomputed — to prevent balance drift as exchange rates move.

### Schema additions

```prisma
model Group {
  base_currency String @default("USD") // ISO 4217
}

model Expense {
  currency           String  @default("USD")
  fx_rate_at_creation Decimal @db.Decimal(18, 8)
  // rate = 1 unit of expense.currency expressed in group.base_currency
  // e.g. expense in JPY, group base USD → fx_rate ≈ 0.00670
}
```

### Netting impact

`computeGroupBalances` must multiply each split amount by `fx_rate_at_creation` before summing, so every contribution is expressed in the base currency before the greedy algorithm runs. Split amounts stored on `ExpenseSplit` remain in the original currency for display; only the balance aggregation converts them.

### Rate fetching

The FX rate is fetched server-side inside the `addExpense` server action — never client-side — to prevent manipulation. ECB provides free daily rates with EUR as the base; Open Exchange Rates / fixer.io cover arbitrary base currencies on paid tiers.

### Why lock at creation

Recomputing historic rates when exchange rates move would cause a group's total balance to drift over time without any new expenses being added — members could end up owing different amounts week to week for the same trip. Locking the rate makes the ledger append-only and auditable, matching how accounting systems handle multi-currency transactions.
