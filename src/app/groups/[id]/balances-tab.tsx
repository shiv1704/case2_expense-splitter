"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { settleUp } from "@/app/actions/settlements";
import type { BalanceEntry, Settlement } from "@/lib/netting";

type HistoryRecord = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  settledAt: string;
};

type Props = {
  groupId: string;
  currentUserId: string;
  balances: BalanceEntry[];
  suggested: Settlement[];
  history: HistoryRecord[];
};

function SettleButton({
  groupId,
  toUserId,
  amount,
}: {
  groupId: string;
  toUserId: string;
  amount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSettle() {
    startTransition(async () => {
      const result = await settleUp(groupId, toUserId, amount);
      if (result.error) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleSettle}
      disabled={pending}
      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
    >
      {pending ? "Settling…" : "Settle Up"}
    </button>
  );
}

export function BalancesTab({
  groupId,
  currentUserId,
  balances,
  suggested,
  history,
}: Props) {
  const allZero = balances.every((b) => b.netBalance === 0);

  return (
    <div className="space-y-8">
      {/* Net Balances */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Net Balances
        </h2>
        {balances.length === 0 ? (
          <p className="text-sm text-zinc-400">No members found.</p>
        ) : (
          <ul className="space-y-2">
            {balances.map((b) => (
              <li
                key={b.userId}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-zinc-700">
                  {b.name}
                  {b.userId === currentUserId && (
                    <span className="ml-1 text-zinc-400">(you)</span>
                  )}
                </span>
                <span
                  className={`tabular-nums text-sm font-semibold ${
                    b.netBalance > 0
                      ? "text-emerald-600"
                      : b.netBalance < 0
                      ? "text-red-500"
                      : "text-zinc-400"
                  }`}
                >
                  {b.netBalance > 0
                    ? `+$${b.netBalance.toFixed(2)}`
                    : b.netBalance < 0
                    ? `-$${Math.abs(b.netBalance).toFixed(2)}`
                    : "settled"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Suggested Settlements */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Suggested Settlements
        </h2>
        {allZero || suggested.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Everyone is settled up. Nothing to pay.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggested.map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
              >
                <div className="text-sm text-zinc-700">
                  <span className="font-semibold">{s.fromName}</span>
                  <span className="mx-2 text-zinc-400">→</span>
                  <span className="font-semibold">{s.toName}</span>
                  <span className="ml-3 tabular-nums font-bold text-zinc-900">
                    ${s.amount.toFixed(2)}
                  </span>
                </div>
                {s.from === currentUserId && (
                  <SettleButton
                    groupId={groupId}
                    toUserId={s.to}
                    amount={s.amount}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Settlement History */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          History
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-400">No settlements recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm"
              >
                <div className="text-zinc-700">
                  <span className="font-semibold">
                    {h.fromId === currentUserId ? "You" : h.fromName}
                  </span>
                  <span className="mx-2 text-zinc-400">paid</span>
                  <span className="font-semibold">
                    {h.toId === currentUserId ? "you" : h.toName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-bold text-zinc-900">
                    ${h.amount.toFixed(2)}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(h.settledAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
