"use client";

import { useState } from "react";
import { CheckCircle, Clock } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { SettleModal } from "./settle-modal";
import { formatINR } from "@/lib/format";
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

type ModalState = {
  toUserId: string;
  toName: string;
  amount: number;
  isLast: boolean;
};

export function BalancesTab({
  groupId,
  currentUserId,
  balances,
  suggested,
  history,
}: Props) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const allZero = balances.every((b) => Math.abs(b.netBalance) <= 0.005);

  const totalOwed = balances
    .filter((b) => b.netBalance > 0.005)
    .reduce((s, b) => s + b.netBalance, 0);
  const totalOwe = balances
    .filter((b) => b.netBalance < -0.005)
    .reduce((s, b) => s + Math.abs(b.netBalance), 0);

  return (
    <div className="space-y-8">
      {/* Net summary cards */}
      {!allZero && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#10B981]/20 bg-[#10B981]/8 px-4 py-3">
            <p className="text-xs text-[#6B7280]">Total owed to group</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#10B981]">
              {formatINR(totalOwed)}
            </p>
          </div>
          <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/8 px-4 py-3">
            <p className="text-xs text-[#6B7280]">Total owed by group</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#EF4444]">
              {formatINR(totalOwe)}
            </p>
          </div>
        </div>
      )}

      {/* Net Balances — no avatar circles, just names */}
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
                className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 transition hover:shadow-sm"
              >
                <span className="text-sm font-medium text-[#1A1A2E]">
                  {b.name}
                  {b.userId === currentUserId && (
                    <span className="ml-1 font-normal text-[#6B7280]">(you)</span>
                  )}
                </span>
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
                    ? `+${formatINR(b.netBalance)}`
                    : b.netBalance < -0.005
                    ? `-${formatINR(Math.abs(b.netBalance))}`
                    : "settled ✓"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Suggested Settlements — full-sentence rows, no avatar bubbles */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          Suggested Settlements
        </h2>
        {allZero || suggested.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#10B981]/20 bg-[#10B981]/8 px-4 py-4">
            <CheckCircle className="h-5 w-5 shrink-0 text-[#10B981]" />
            <p className="text-sm font-medium text-[#10B981]">
              Everyone is settled up — nothing to pay! 🎉
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {suggested.map((s, i) => {
              const isMe = s.from === currentUserId;
              const fromLabel = isMe ? "You" : s.fromName;
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5 transition hover:shadow-sm"
                >
                  <p className="text-sm text-[#1A1A2E]">
                    <span className="font-semibold">{fromLabel}</span>
                    <span className="text-[#6B7280]"> pay{isMe ? "" : "s"} </span>
                    <span className="font-semibold">{s.toName}</span>
                    <span className="ml-1.5 font-bold tabular-nums text-[#1A1A2E]">
                      {formatINR(s.amount)}
                    </span>
                  </p>
                  {isMe && (
                    <button
                      onClick={() =>
                        setModal({
                          toUserId: s.to,
                          toName: s.toName,
                          amount: s.amount,
                          isLast: suggested.length === 1,
                        })
                      }
                      className="rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0F766E]"
                    >
                      Settle Up
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Settlement History — names only, no letter avatars */}
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
                    {formatINR(h.amount)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                    <Clock className="h-3 w-3" />
                    {new Date(h.settledAt).toLocaleDateString("en-IN", {
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

      <AnimatePresence>
        {modal && (
          <SettleModal
            key="settle"
            groupId={groupId}
            toUserId={modal.toUserId}
            toName={modal.toName}
            amount={modal.amount}
            isLastSettlement={modal.isLast}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
