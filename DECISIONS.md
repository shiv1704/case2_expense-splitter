# DECISIONS.md — Pocket: Roommate Expense Splitter

## Assumptions

1. **Invite-code join, not email invite** — sharing a 6-character code is enough for a prototype. A real product would send an email invitation with a one-click accept link, but that requires an SMTP integration and adds scope without validating the core splitting logic.

2. **Netting recomputed live on every request** — balances are derived from the `expense_splits` ledger on each page load rather than cached. At the scale of a single flat (2–10 members, tens of expenses), a full recompute takes under 5 ms. Introducing a cached balance table would require invalidation logic and a migration, adding complexity that only pays off at much higher request volumes.

---

## Trade-offs

| Decision | Option chosen | Option rejected | Reason |
|---|---|---|---|
| **Database** | Supabase (Postgres) | MongoDB | Expense splits are inherently relational — an `expense_splits` row must reference both a valid `expense` and a valid `user`, and the sum of split amounts must equal the expense total. Foreign-key constraints and `DECIMAL(12,2)` precision enforce these invariants at the DB layer for free. A document store would push that validation entirely into application code, where it is easier to miss. |
| **Netting algorithm** | Greedy min-heap (O(n log n)) | Exact optimal (NP-hard subset-sum) | The greedy approach produces settlements that are within one transaction of optimal in practice, runs in O(n log n), and is easy to explain to a non-technical judge ("pair the biggest debtor with the biggest creditor, repeat"). The exact solution requires exponential-time subset enumeration and gives no meaningful benefit for groups of under ~20 people. |
| **Next.js routing** | App Router + Server Actions | Pages Router + API routes | App Router lets data fetching, auth checks, and balance computation happen in server components — no separate API layer to maintain, no client-side waterfalls, and `useTransition` + server actions give a clean request/response model for mutations without building REST endpoints by hand. |

---

## De-scoped

The following features were cut to keep the prototype shippable within the time constraint. Each is architecturally additive and documented so a future engineer can pick them up:

- **CSV / PDF export** — downloading a full statement for a group. A server route that streams a CSV from the `expenses` + `expense_splits` join is straightforward but was deprioritised against core splitting logic.
- **Push notifications** — alerting group members when a new expense is added. Requires a service worker, a push subscription store, and a transactional email or FCM integration — independently deployable but not core to validating the split and settle flow.

---

## What I'd do differently

**Add optimistic UI updates.** Currently every mutation (add expense, settle up, rename group) triggers a full server round-trip before the UI reflects the change. With `useOptimistic` (React 19 / Next.js 15), the list would update instantly and roll back only on error. For a list of expenses that can grow long, the latency difference is noticeable on slow connections.

**Add proper error boundaries.** The app has inline `toast.error()` feedback for action failures but no React `ErrorBoundary` components around the group page or balance tab. A DB timeout or unexpected Prisma error currently bubbles to a Next.js 500 page. Wrapping each major section in an error boundary with a "Reload" fallback would contain failures and keep the rest of the page functional.
