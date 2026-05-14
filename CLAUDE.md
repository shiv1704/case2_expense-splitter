@AGENTS.md
# Pocket — Roommate Expense Splitter

## What we are building
A web app where users create groups, add expenses with unequal splits, 
see minimized settlement balances, and settle up with an audit trail.
All data persists in Postgres (Supabase). Refresh must not lose data.

## The netting algorithm (CRITICAL)
Given a list of balances, minimize the number of transactions to settle.
Example: A paid 1200 (split 40/30/30 → A is owed 480 from B and 360 from C).
If B also owes C 100 separately, net it: B pays A 480, C pays A 260 (360-100).
Use a greedy min-heap approach: repeatedly match the largest creditor 
with the largest debtor until all balances are zero.

## Stack decisions
- Next.js 14 App Router + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth)
- Prisma ORM
- Deployed on Vercel

## Rules
- NEVER use in-memory state for balances. Always recompute from DB.
- Every settle-up must create an audit record in a settlements table.
- Unequal splits must be supported (percentage OR fixed amount).
- The demo must have a seeded group judges can log into.