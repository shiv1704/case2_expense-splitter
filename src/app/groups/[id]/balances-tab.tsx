"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle, Clock } from "lucide-react";
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
  toName,
  amount,
}: {
  groupId: string;
  toUserId: string;
  toName: string;
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
      className="rounded-lg bg-[#F97316] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#EA6C0A] disabled:opacity-50"
    >
      {pending ? "Settling…" : `Pay ${toName}`}
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
  const allZero = balances.every((b) => Math.abs(b.netBalance) <= 0.005);

  return (
    <div className="space-y-8">
      {/* Net Balances */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          Net Balances
        </h2>
        {balances.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No members found.</p>
        ) : (
          <ul className="space-y-2">
            {balances.map((b) => (
              <li
                key={b.userId}
                className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B7DF0]/10 text-sm font-bold text-[#1B7DF0]">
                    {b.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-[#1A1A2E]">
                    {b.name}
                    {b.userId === currentUserId && (
                      <span className="ml-1 text-[#6B7280]">(you)</span>
                    )}
                  </span>
                </div>
                <span
                  className={`tabular-nums text-sm font-semibold ${
                    b.netBalance > 0.005
                      ? "text-[#10B981]"
                      : b.netBalance < -0.005
                      ? "text-[#EF4444]"
                      : "text-[#6B7280]"
                  }`}
                >
                  {b.netBalance > 0.005
                    ? `+$${b.netBalance.toFixed(2)}`
                    : b.netBalance < -0.005
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
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          Suggested Settlements
        </h2>
        {allZero || suggested.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#10B981]/20 bg-[#10B981]/8 px-4 py-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-[#10B981]" />
            <p className="text-sm font-medium text-[#10B981]">
              Everyone is settled up — nothing to pay!
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {suggested.map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-[#1A1A2E]">{s.fromName}</span>
                  <ArrowRight className="h-4 w-4 text-[#6B7280]" />
                  <span className="font-semibold text-[#1A1A2E]">{s.toName}</span>
                  <span className="ml-1 font-bold tabular-nums text-[#1A1A2E]">
                    ${s.amount.toFixed(2)}
                  </span>
                </div>
                {s.from === currentUserId && (
                  <SettleButton
                    groupId={groupId}
                    toUserId={s.to}
                    toName={s.toName}
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
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          History
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-[#6B7280]">No settlements recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2 text-[#1A1A2E]">
                  <CheckCircle className="h-4 w-4 shrink-0 text-[#10B981]" />
                  <span className="font-semibold">
                    {h.fromId === currentUserId ? "You" : h.fromName}
                  </span>
                  <span className="text-[#6B7280]">paid</span>
                  <span className="font-semibold">
                    {h.toId === currentUserId ? "you" : h.toName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold tabular-nums text-[#1A1A2E]">
                    ${h.amount.toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                    <Clock className="h-3 w-3" />
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
