"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { addExpense } from "@/app/actions/expenses";

type Member = { id: string; name: string };
type SplitType = "EQUAL" | "PERCENTAGE" | "FIXED";

type Props = {
  groupId: string;
  members: Member[];
};

function initEqualPcts(members: Member[]): Record<string, string> {
  const base = Math.floor(100 / members.length);
  const rem = 100 - base * members.length;
  return Object.fromEntries(
    members.map((m, i) => [m.id, String(i === 0 ? base + rem : base)])
  );
}

export function AddExpenseForm({ groupId, members }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [totalAmount, setTotalAmount] = useState("");
  const [pcts, setPcts] = useState<Record<string, string>>(() =>
    initEqualPcts(members)
  );
  const [fixed, setFixed] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((m) => [m.id, ""]))
  );

  function resetForm() {
    setSplitType("EQUAL");
    setTotalAmount("");
    setPcts(initEqualPcts(members));
    setFixed(Object.fromEntries(members.map((m) => [m.id, ""])));
    setError(null);
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  const parsedTotal = parseFloat(totalAmount) || 0;
  const pctTotal = members.reduce(
    (s, m) => s + parseFloat(pcts[m.id] || "0"),
    0
  );
  const fixedTotal = members.reduce(
    (s, m) => s + parseFloat(fixed[m.id] || "0"),
    0
  );
  const pctValid = Math.abs(pctTotal - 100) <= 0.01;
  const fixedValid = parsedTotal > 0 && Math.abs(fixedTotal - parsedTotal) <= 0.01;

  function buildSplitsPayload() {
    if (splitType === "EQUAL") {
      const amount = parsedTotal / members.length;
      return members.map((m) => ({ user_id: m.id, amount, percentage: null }));
    }
    if (splitType === "PERCENTAGE") {
      return members.map((m) => {
        const pct = parseFloat(pcts[m.id] || "0");
        return {
          user_id: m.id,
          amount: (pct / 100) * parsedTotal,
          percentage: pct,
        };
      });
    }
    return members.map((m) => ({
      user_id: m.id,
      amount: parseFloat(fixed[m.id] || "0"),
      percentage: null,
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!parsedTotal || parsedTotal <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    if (splitType === "PERCENTAGE" && !pctValid) {
      setError(`Percentages must sum to 100 — currently ${pctTotal.toFixed(1)}%`);
      return;
    }
    if (splitType === "FIXED" && !fixedValid) {
      setError(
        `Amounts must sum to $${parsedTotal.toFixed(2)} — currently $${fixedTotal.toFixed(2)}`
      );
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("splits_json", JSON.stringify(buildSplitsPayload()));

    startTransition(async () => {
      const result = await addExpense(groupId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        handleClose();
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-lg bg-[#1B7DF0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1567CC]"
      >
        <Plus className="h-4 w-4" />
        Add expense
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
                <h2 className="text-lg font-bold text-[#1A1A2E]">Add expense</h2>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F7F8FA] hover:text-[#1A1A2E]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <form
                onSubmit={handleSubmit}
                className="space-y-5 overflow-y-auto px-6 py-5"
              >
                {error && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
                    {error}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label
                    htmlFor="exp-title"
                    className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
                  >
                    Title
                  </label>
                  <input
                    id="exp-title"
                    name="title"
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Groceries"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label
                    htmlFor="exp-amount"
                    className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
                  >
                    Total amount
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6B7280]">
                      $
                    </span>
                    <input
                      id="exp-amount"
                      name="total_amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] py-2.5 pl-7 pr-3 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                    />
                  </div>
                </div>

                {/* Paid by */}
                <div>
                  <label
                    htmlFor="exp-paid-by"
                    className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
                  >
                    Paid by
                  </label>
                  <select
                    id="exp-paid-by"
                    name="paid_by"
                    required
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1A1A2E] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Split type toggle */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#1A1A2E]">
                    Split type
                  </label>
                  <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[#E5E7EB] text-sm">
                    {(["EQUAL", "PERCENTAGE", "FIXED"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSplitType(t)}
                        className={`py-2 text-center font-medium transition ${
                          splitType === t
                            ? "bg-[#1B7DF0] text-white"
                            : "text-[#6B7280] hover:bg-[#F7F8FA]"
                        }`}
                      >
                        {t[0] + t.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="split_type" value={splitType} />
                </div>

                {/* EQUAL preview */}
                {splitType === "EQUAL" && parsedTotal > 0 && (
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-4 py-3 space-y-1.5">
                    {members.map((m) => (
                      <div key={m.id} className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">{m.name}</span>
                        <span className="font-semibold tabular-nums text-[#1A1A2E]">
                          ${(parsedTotal / members.length).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* PERCENTAGE inputs */}
                {splitType === "PERCENTAGE" && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-[#1A1A2E]">
                        Percentages
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          pctValid ? "text-[#10B981]" : "text-amber-500"
                        }`}
                      >
                        {pctTotal.toFixed(1)}% / 100%
                      </span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-[#1A1A2E]">
                            {m.name}
                          </span>
                          <div className="relative w-28">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={pcts[m.id]}
                              onChange={(e) =>
                                setPcts((p) => ({ ...p, [m.id]: e.target.value }))
                              }
                              className={`w-full rounded-lg border py-1.5 pl-3 pr-7 text-right text-sm focus:outline-none focus:ring-2 ${
                                pctValid
                                  ? "border-[#E5E7EB] focus:border-[#1B7DF0] focus:ring-[#1B7DF0]/20"
                                  : "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                              }`}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">
                              %
                            </span>
                          </div>
                          {parsedTotal > 0 && (
                            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-[#6B7280]">
                              ${((parseFloat(pcts[m.id] || "0") / 100) * parsedTotal).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FIXED inputs */}
                {splitType === "FIXED" && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-[#1A1A2E]">
                        Amounts
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          fixedValid ? "text-[#10B981]" : "text-amber-500"
                        }`}
                      >
                        ${fixedTotal.toFixed(2)} / ${parsedTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-[#1A1A2E]">
                            {m.name}
                          </span>
                          <div className="relative w-28">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">
                              $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={fixed[m.id]}
                              onChange={(e) =>
                                setFixed((a) => ({ ...a, [m.id]: e.target.value }))
                              }
                              className={`w-full rounded-lg border py-1.5 pl-6 pr-3 text-right text-sm focus:outline-none focus:ring-2 ${
                                fixedValid
                                  ? "border-[#E5E7EB] focus:border-[#1B7DF0] focus:ring-[#1B7DF0]/20"
                                  : "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                              }`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-lg bg-[#1B7DF0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1567CC] disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Save expense"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
