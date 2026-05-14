"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, RefreshCw, Pause, Play, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  getRecurringExpenses,
  pauseRecurring,
  resumeRecurring,
  deleteRecurringSeries,
  type RecurringExpense,
} from "@/app/actions/recurring";
import { formatINR } from "@/lib/format";

const RULE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  YEARLY: "Yearly",
};

type Props = {
  groupId: string;
  onClose: () => void;
};

export function ManageRecurringModal({ groupId, onClose }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<RecurringExpense[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load on mount
  useState(() => {
    getRecurringExpenses(groupId).then(({ data }) => {
      setItems(data);
      setLoading(false);
    });
  });

  function handlePause(id: string) {
    startTransition(async () => {
      const result = await pauseRecurring(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recurring paused");
        setItems((prev) =>
          prev?.map((it) => (it.id === id ? { ...it, next_due_date: null } : it)) ?? null
        );
        router.refresh();
      }
    });
  }

  function handleResume(id: string, rule: string) {
    // Compute next occurrence from today
    const d = new Date();
    if (rule === "MONTHLY") d.setMonth(d.getMonth() + 1);
    else if (rule === "YEARLY") d.setFullYear(d.getFullYear() + 1);
    else d.setDate(d.getDate() + (rule === "WEEKLY" ? 7 : 14));
    const nextIso = d.toISOString();

    startTransition(async () => {
      const result = await resumeRecurring(id, nextIso);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recurring resumed");
        setItems((prev) =>
          prev?.map((it) => (it.id === id ? { ...it, next_due_date: nextIso } : it)) ?? null
        );
        router.refresh();
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteRecurringSeries(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recurring series removed");
        setItems((prev) => prev?.filter((it) => it.id !== id) ?? null);
        setConfirmDelete(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <motion.div
        key="mgr-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <motion.div
          key="mgr-modal"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 28, stiffness: 380 }}
          className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-[#1B7DF0]" />
              <h2 className="text-lg font-bold text-[#1A1A2E]">Recurring expenses</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F7F8FA]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex items-center justify-center py-12 text-sm text-[#6B7280]">
                Loading…
              </div>
            )}

            {!loading && items?.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="text-4xl">🔄</div>
                <p className="text-sm text-[#6B7280]">
                  No recurring expenses in this group.
                </p>
              </div>
            )}

            {!loading && items && items.length > 0 && (
              <ul className="space-y-3">
                {items.map((item) => {
                  const isPaused = !item.next_due_date;
                  const nextFormatted = item.next_due_date
                    ? new Date(item.next_due_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-[#E5E7EB] bg-white p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1B7DF0]/10 text-base">
                          🔄
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#1A1A2E]">{item.title}</p>
                          <p className="mt-0.5 text-xs text-[#6B7280]">
                            {formatINR(item.total_amount)} ·{" "}
                            {RULE_LABELS[item.recurrence_rule] ?? item.recurrence_rule} ·{" "}
                            paid by {item.payer_name}
                          </p>
                          {isPaused ? (
                            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              ⏸ Paused
                            </span>
                          ) : (
                            <p className="mt-0.5 text-xs text-[#6B7280]">
                              Next: <span className="font-medium text-[#1A1A2E]">{nextFormatted}</span>
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isPaused ? (
                            <button
                              onClick={() => handleResume(item.id, item.recurrence_rule)}
                              disabled={pending}
                              title="Resume"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#10B981] transition hover:bg-[#F7F8FA] disabled:opacity-40"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePause(item.id)}
                              disabled={pending}
                              title="Pause"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition hover:bg-[#F7F8FA] disabled:opacity-40"
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDelete(item.id)}
                            disabled={pending}
                            title="Delete series"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#EF4444] transition hover:bg-red-50 disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div
              key="del-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => setConfirmDelete(null)}
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div
                key="del-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              >
                <h3 className="text-base font-bold text-[#1A1A2E]">Delete recurring series?</h3>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Stops future auto-generation. Past expenses are kept.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-medium text-[#6B7280] transition hover:bg-[#F7F8FA]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDelete)}
                    disabled={pending}
                    className="flex-1 rounded-xl bg-[#EF4444] py-2.5 text-sm font-semibold text-white transition hover:bg-[#DC2626] disabled:opacity-50"
                  >
                    {pending ? "Removing…" : "Delete series"}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
