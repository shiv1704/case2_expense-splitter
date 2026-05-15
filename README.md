# Case 2: Pocket — Roommate Expense Splitter

**Live demo:** https://case2-expense-splitter.vercel.app
**Repo:** https://github.com/shiv1704/case2_expense-splitter
**Demo video:** *(to be added)*

---

## What this is

Pocket is a roommate expense-splitting web app. Users create groups, add expenses with equal or unequal splits, and see a minimized settlement plan — the fewest possible payments to bring everyone to zero. Every settle-up creates an auditable record. All data persists in Postgres (Supabase); a hard refresh never loses state.

Key features shipped:

- Email + password auth with a demo bypass (no sign-up required to evaluate)
- Groups with shareable invite codes
- Add members directly by searching existing app users (name or email), or via the Web Contact Picker API on Android
- Three split modes: Equal, Percentage, Fixed
- Greedy min-transaction netting algorithm — minimizes payments needed to settle
- Recurring expenses with lazy auto-generation on page load (Anchor + Drift pattern)
- Receipt photo upload via Supabase Storage (camera or file picker, 5 MB limit — requires the `receipts` bucket, see setup note below)
- Settle Up flow with UPI deep links (GPay / PhonePe / Paytm) and manual confirmation
- Full audit trail: Activity tab, settlement history
- Group settings: rename, leave, delete, manage recurring schedule

---

## How to run locally

```bash
git clone https://github.com/shiv1704/case2_expense-splitter
cd case2_expense-splitter
npm install
```

Create `.env.local` with your Supabase project credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
DATABASE_URL=postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

```bash
npx prisma generate
npm run dev
```

**Receipt uploads (optional):** go to Supabase Dashboard → Storage → New bucket → name `receipts` → enable **Public bucket** → Create. Without this step, expenses save normally and receipt upload shows a graceful error toast.

Open http://localhost:3000 and log in with the demo credentials below.

### Demo accounts (pre-seeded)

| Email | Password | Name |
|---|---|---|
| alice@demo.com | demo1234 | Alice |
| bob@demo.com | demo1234 | Bob |
| charlie@demo.com | demo1234 | Charlie |

Group: **Flat 4B** · invite code `DEMO42`

### Run tests

```bash
npm test
```

Covers the netting algorithm: two-person, three-person, multi-creditor/debtor, and floating-point edge cases.

---

## Stack

| Technology | Why |
|---|---|
| **Next.js 16** App Router + TypeScript | Server components eliminate a whole API layer — data fetching, auth checks, and balance computation run server-side with zero client waterfalls |
| **Supabase** (Postgres + Auth + Storage) | Managed Postgres with row-level security out of the box, plus Storage for receipt uploads and Auth for email/password without running a separate service |
| **Prisma ORM** | Type-safe queries with `@prisma/adapter-pg` for PgBouncer compatibility; schema-as-code keeps migrations reviewable in git |
| **Tailwind CSS** | Utility-first means no context-switching between files for layout tweaks; the constraint of a fixed palette keeps the design consistent |
| **Vercel** | Zero-config deploys from `git push`; Edge network puts the Next.js runtime close to users without any infrastructure work |

---

## What's NOT done

- **Email notifications** — no SMTP / transactional email wired up; members learn about new expenses only by visiting the app
- **Mobile app** — responsive web only; no React Native / Expo shell
- **CSV / PDF export** — expenses are visible in-app but cannot be downloaded
- **Multi-currency** — all amounts are in INR; no FX rate lookup or per-expense currency field
- **Push notifications** — no service worker or FCM integration
- **Recurring expense cron** — auto-generation runs lazily on page load, not on a server-side schedule; if no one visits the group, overdue expenses are not generated until the next visit

---

## In production I would also add

- **Email notifications on new expense** — fire a transactional email (Resend / SendGrid) to every group member when an expense is added or a settlement is recorded, so people stay informed without opening the app
- **Recurring expense automation** — replace the lazy page-load trigger with a proper cron job (Vercel Cron or a Supabase Edge Function on a schedule) so auto-generated expenses appear on time even if no one visits
- **Receipt photo upload improvements** — OCR the receipt (Google Cloud Vision / AWS Textract) to pre-fill the expense title and amount, reducing manual entry
- **Export CSV / PDF** — let members download a full statement for a group, useful at the end of a lease or a trip
- **Mobile app** — wrap the same backend in a React Native / Expo app with push notifications for new expenses and settlement reminders

---

## If this went international: currency conversion

Every expense would carry a `currency` field (ISO 4217) and an `fx_rate_at_creation` — the rate between that currency and the group's `base_currency`, fetched server-side at the moment the expense is submitted. The netting algorithm would stay unchanged; `computeGroupBalances` would multiply each split amount by its stored FX rate before summing, so every contribution is expressed in the base currency before the greedy min-heap runs.

**Why lock the rate at creation, not recompute it live:** recomputing with today's rates would cause a group's total balance to drift week to week without any new activity — members could owe different amounts for the same trip depending on when they check the app. Locking makes the ledger append-only and auditable, matching standard double-entry bookkeeping.

**Rate source:** ECB publishes free daily rates with EUR as base; Open Exchange Rates / Fixer.io support arbitrary base currencies on paid tiers. The fetch would live inside the `addExpense` server action — never client-side — so the rate cannot be manipulated by the browser.

**Schema additions required** (no breaking changes to existing tables):

```prisma
model Group {
  base_currency String @default("INR") // ISO 4217
}

model Expense {
  currency            String  @default("INR")
  fx_rate_at_creation Decimal @db.Decimal(18, 8)
  // 1 unit of expense.currency expressed in group.base_currency
  // e.g. expense in USD, group base INR → fx_rate ≈ 83.5
}
```
