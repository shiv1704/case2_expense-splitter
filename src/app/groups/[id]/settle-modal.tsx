"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { settleUp } from "@/app/actions/settlements";
import { formatINR } from "@/lib/format";

type Props = {
  groupId: string;
  toUserId: string;
  toName: string;
  amount: number;
  isLastSettlement: boolean;
  onClose: () => void;
};

const UPI_APPS = [
  { name: "GPay",    bg: "#4285F4", label: "G" },
  { name: "PhonePe", bg: "#5F259F", label: "P" },
  { name: "Paytm",   bg: "#002970", label: "T" },
] as const;

export function SettleModal({
  groupId,
  toUserId,
  toName,
  amount,
  isLastSettlement,
  onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  function handleUpiClick() {
    const upiId = `${toName.toLowerCase().replace(/\s+/g, "")}@okaxis`;
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(toName)}&am=${amount.toFixed(2)}&cu=INR`;
    window.location.href = upiUrl;
    setTimeout(() => setAwaitingConfirmation(true), 3000);
  }

  function handleSettle() {
    startTransition(async () => {
      const result = await settleUp(groupId, toUserId, amount);
      if (result.error) {
        toast.error(result.error);
      } else {
        if (isLastSettlement) {
          import("canvas-confetti").then(({ default: confetti }) => {
            confetti({ particleCount: 220, spread: 80, origin: { y: 0.6 } });
          });
        }
        toast.success("Settled up ✓");
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <>
      <motion.div
        key="settle-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <motion.div
          key="settle-modal"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 28, stiffness: 380 }}
          className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
            <h2 className="text-lg font-bold text-[#1A1A2E]">Settle up</h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F7F8FA]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 p-6">
            {/* Amount + recipient */}
            <div className="rounded-xl bg-[#F7F8FA] py-5 text-center">
              <p className="text-sm text-[#6B7280]">You pay</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#1A1A2E]">
                {formatINR(amount)}
              </p>
              <p className="mt-1 text-sm text-[#6B7280]">
                to{" "}
                <span className="font-semibold text-[#1A1A2E]">{toName}</span>
              </p>
            </div>

            <AnimatePresence mode="wait">
              {awaitingConfirmation ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <p className="text-center text-sm font-semibold text-[#1A1A2E]">
                    Did you complete the payment?
                  </p>
                  <button
                    onClick={handleSettle}
                    disabled={pending}
                    className="w-full rounded-xl bg-[#10B981] py-3 text-sm font-semibold text-white transition hover:bg-[#059669] disabled:opacity-50"
                  >
                    {pending ? "Recording…" : "Yes, mark as settled ✓"}
                  </button>
                  <button
                    onClick={() => setAwaitingConfirmation(false)}
                    className="w-full rounded-xl border border-[#E5E7EB] py-3 text-sm font-medium text-[#6B7280] transition hover:bg-[#F7F8FA]"
                  >
                    No, go back
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="upi"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* UPI app buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    {UPI_APPS.map(({ name, bg, label }) => (
                      <button
                        key={name}
                        onClick={handleUpiClick}
                        style={{ backgroundColor: bg }}
                        className="flex flex-col items-center gap-2 rounded-xl py-4 text-white transition hover:opacity-90 active:scale-95"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg font-extrabold">
                          {label}
                        </span>
                        <span className="text-xs font-semibold">{name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="relative flex items-center">
                    <div className="flex-1 border-t border-[#E5E7EB]" />
                    <span className="bg-white px-3 text-xs text-[#6B7280]">or</span>
                    <div className="flex-1 border-t border-[#E5E7EB]" />
                  </div>

                  {/* Manual settle */}
                  <button
                    onClick={handleSettle}
                    disabled={pending}
                    className="w-full rounded-xl border border-[#E5E7EB] py-3 text-sm font-medium text-[#1A1A2E] transition hover:bg-[#F7F8FA] disabled:opacity-50"
                  >
                    {pending ? "Recording…" : "Mark as Settled Manually"}
                  </button>

                  <p className="text-center text-xs leading-relaxed text-[#6B7280]">
                    UPI buttons open your payment app. Pocket does not process or
                    verify payments.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
}
