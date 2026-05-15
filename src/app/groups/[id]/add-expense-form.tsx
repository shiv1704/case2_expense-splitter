"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, RefreshCw, Paperclip, Camera, FolderOpen, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { addExpense, updateExpenseReceipt } from "@/app/actions/expenses";
import { uploadReceipt } from "@/lib/receipt-upload";
import { formatINR, formatAmount } from "@/lib/format";

type Member = { id: string; name: string };
type SplitType = "EQUAL" | "PERCENTAGE" | "FIXED";
type RecurrenceRule = "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "YEARLY";

const CURRENCIES = [
  { code: "INR", flag: "🇮🇳" },
  { code: "USD", flag: "🇺🇸" },
  { code: "AED", flag: "🇦🇪" },
  { code: "EUR", flag: "🇪🇺" },
  { code: "GBP", flag: "🇬🇧" },
  { code: "SGD", flag: "🇸🇬" },
  { code: "THB", flag: "🇹🇭" },
  { code: "JPY", flag: "🇯🇵" },
  { code: "CAD", flag: "🇨🇦" },
  { code: "AUD", flag: "🇦🇺" },
] as const;

type Props = {
  groupId: string;
  members: Member[];
  variant?: "button" | "fab";
};

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RULE_LABELS: Record<RecurrenceRule, string> = {
  MONTHLY: "Monthly",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  YEARLY: "Yearly",
};

type SmartSuggestion = {
  rule: RecurrenceRule;
  day: number;
  label: string;
} | null;

function detectRecurringSuggestion(title: string): SmartSuggestion {
  const t = title.toLowerCase();
  if (t.includes("rent") || t.includes("किराया"))
    return { rule: "MONTHLY", day: 1, label: "Rent is usually monthly" };
  if (t.includes("internet") || t.includes("wifi") || t.includes("broadband"))
    return { rule: "MONTHLY", day: 5, label: "Internet bills are usually monthly" };
  if (t.includes("electric") || t.includes("bijli") || t.includes("eb bill"))
    return { rule: "MONTHLY", day: 10, label: "Electricity bills are usually monthly" };
  if (t.includes("netflix") || t.includes("spotify") || t.includes("prime") || t.includes("subscription"))
    return { rule: "MONTHLY", day: 1, label: "Subscriptions are usually monthly" };
  if (t.includes("gas") || t.includes("cylinder") || t.includes("lpg"))
    return { rule: "MONTHLY", day: 15, label: "Gas refills are usually monthly" };
  return null;
}

function firstDueDate(rule: RecurrenceRule, day: number, startDate: Date): Date {
  const d = new Date(startDate);
  if (rule === "MONTHLY") {
    d.setDate(day);
    if (d <= startDate) d.setMonth(d.getMonth() + 1);
  } else if (rule === "WEEKLY") {
    d.setDate(d.getDate() + 7);
  } else if (rule === "BIWEEKLY") {
    d.setDate(d.getDate() + 14);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

function formatNextDue(rule: RecurrenceRule, day: number): string {
  const next = firstDueDate(rule, day, new Date());
  return next.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function initEqualPcts(mems: Member[]): Record<string, string> {
  if (mems.length === 0) return {};
  const base = Math.floor(100 / mems.length);
  const rem = 100 - base * mems.length;
  return Object.fromEntries(mems.map((m, i) => [m.id, String(i === 0 ? base + rem : base)]));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AddExpenseForm({ groupId, members, variant = "button" }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core fields
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [totalAmount, setTotalAmount] = useState("");
  const [payerId, setPayerId] = useState<string>(members[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(members.map((m) => m.id))
  );
  const [pcts, setPcts] = useState<Record<string, string>>(() => initEqualPcts(members));
  const [fixed, setFixed] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((m) => [m.id, ""]))
  );

  // Recurring fields
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>("MONTHLY");
  const [recurrenceDay, setRecurrenceDay] = useState(1);
  const [suggestion, setSuggestion] = useState<SmartSuggestion>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Currency fields
  const [currency, setCurrency] = useState("INR");
  const [fxPreview, setFxPreview] = useState<{ rate: number } | null>(null);
  const [fxFetching, setFxFetching] = useState(false);
  const fxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Receipt fields
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMembers = members.filter((m) => selectedIds.has(m.id));

  // Smart detection on title change
  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value;
    if (!isRecurring && !suggestionDismissed) {
      const s = detectRecurringSuggestion(title);
      setSuggestion(s);
    }
  }

  function acceptSuggestion() {
    if (!suggestion) return;
    setIsRecurring(true);
    setRecurrenceRule(suggestion.rule);
    setRecurrenceDay(suggestion.day);
    setSuggestion(null);
  }

  function resetForm() {
    setSplitType("EQUAL");
    setTotalAmount("");
    setPayerId(members[0]?.id ?? "");
    setSelectedIds(new Set(members.map((m) => m.id)));
    setPcts(initEqualPcts(members));
    setFixed(Object.fromEntries(members.map((m) => [m.id, ""])));
    setCurrency("INR");
    setFxPreview(null);
    setIsRecurring(false);
    setRecurrenceRule("MONTHLY");
    setRecurrenceDay(1);
    setSuggestion(null);
    setSuggestionDismissed(false);
    setReceiptFile(null);
    setReceiptPreviewUrl(null);
    setReceiptError(null);
    setUploadProgress(null);
    setError(null);
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handlePayerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setPayerId(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function toggleMember(id: string) {
    if (id === payerId) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      if (next.size <= 2) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    const newActive = members.filter((m) => next.has(m.id));
    setPcts(initEqualPcts(newActive));
  }

  function handleFileSelect(file: File) {
    setReceiptError(null);
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setReceiptError("Only images and PDFs are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptError("File must be under 5 MB");
      return;
    }
    setReceiptFile(file);
    if (file.type.startsWith("image/")) {
      setReceiptPreviewUrl(URL.createObjectURL(file));
    } else {
      setReceiptPreviewUrl(null);
    }
  }

  // Fetch FX preview whenever currency or amount changes (client-only, for display)
  useEffect(() => {
    if (fxDebounceRef.current) clearTimeout(fxDebounceRef.current);
    const amount = parseFloat(totalAmount) || 0;
    if (currency === "INR" || !amount) {
      setFxPreview(null);
      return;
    }
    fxDebounceRef.current = setTimeout(async () => {
      setFxFetching(true);
      try {
        const res = await fetch(`/api/fx?from=${currency}&to=INR`);
        if (res.ok) {
          const data = (await res.json()) as { rate: number };
          setFxPreview({ rate: data.rate });
        } else {
          setFxPreview(null);
        }
      } catch {
        setFxPreview(null);
      } finally {
        setFxFetching(false);
      }
    }, 400);
  }, [currency, totalAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  const parsedTotal = parseFloat(totalAmount) || 0;
  const pctTotal = activeMembers.reduce((s, m) => s + parseFloat(pcts[m.id] || "0"), 0);
  const fixedTotal = activeMembers.reduce((s, m) => s + parseFloat(fixed[m.id] || "0"), 0);
  const pctValid = Math.abs(pctTotal - 100) <= 0.01;
  const fixedValid = parsedTotal > 0 && Math.abs(fixedTotal - parsedTotal) <= 0.01;

  function buildSplitsPayload() {
    if (splitType === "EQUAL") {
      const amount = parsedTotal / activeMembers.length;
      return activeMembers.map((m) => ({ user_id: m.id, amount, percentage: null }));
    }
    if (splitType === "PERCENTAGE") {
      return activeMembers.map((m) => {
        const pct = parseFloat(pcts[m.id] || "0");
        return { user_id: m.id, amount: (pct / 100) * parsedTotal, percentage: pct };
      });
    }
    return activeMembers.map((m) => ({
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
    if (activeMembers.length < 2) {
      setError("At least 2 members must be included in the split");
      return;
    }
    if (splitType === "PERCENTAGE" && !pctValid) {
      setError(`Percentages must sum to 100 — currently ${pctTotal.toFixed(1)}%`);
      return;
    }
    if (splitType === "FIXED" && !fixedValid) {
      setError(`Amounts must sum to ${formatINR(parsedTotal)} — currently ${formatINR(fixedTotal)}`);
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("splits_json", JSON.stringify(buildSplitsPayload()));
    formData.set("is_recurring", String(isRecurring));
    if (isRecurring) {
      formData.set("recurrence_rule", recurrenceRule);
      formData.set("recurrence_day", String(recurrenceDay));
      const nextDue = firstDueDate(recurrenceRule, recurrenceDay, new Date());
      formData.set("next_due_date", nextDue.toISOString());
    }

    startTransition(async () => {
      const result = await addExpense(groupId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }

      // Upload receipt if selected
      if (receiptFile && result.expenseId) {
        setUploadProgress(0);
        const uploadResult = await uploadReceipt(
          receiptFile,
          groupId,
          result.expenseId,
          setUploadProgress
        );
        if (uploadResult.error) {
          toast.error(`Expense saved. Receipt upload failed: ${uploadResult.error}`);
        } else if (uploadResult.url) {
          await updateExpenseReceipt(result.expenseId, uploadResult.url, uploadResult.filename ?? "receipt");
        }
        setUploadProgress(null);
      }

      handleClose();
      toast.success(isRecurring ? "Recurring expense added 🔄" : "Expense added ✓");
      router.refresh();
    });
  }

  const trigger =
    variant === "fab" ? (
      <button
        onClick={handleOpen}
        aria-label="Add expense"
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#1B7DF0] shadow-lg text-white transition hover:bg-[#1567CC] hover:shadow-xl active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>
    ) : (
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-lg bg-[#1B7DF0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1567CC]"
      >
        <Plus className="h-4 w-4" />
        Add expense
      </button>
    );

  return (
    <>
      {trigger}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={handleClose}
            />

            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <motion.div
                key="modal"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ type: "spring", damping: 28, stiffness: 380 }}
                className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
              >
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
                <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto px-6 py-5">
                  {error && (
                    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
                      {error}
                    </div>
                  )}

                  {/* Title */}
                  <div>
                    <label htmlFor="exp-title" className="mb-1.5 block text-sm font-medium text-[#1A1A2E]">
                      Title
                    </label>
                    <input
                      id="exp-title"
                      name="title"
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Groceries"
                      onChange={handleTitleChange}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                    />
                  </div>

                  {/* Smart suggestion banner */}
                  <AnimatePresence>
                    {suggestion && !isRecurring && !suggestionDismissed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                          <p className="text-sm text-[#1A1A2E]">
                            💡 {suggestion.label}. Set as recurring?
                          </p>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={acceptSuggestion}
                              className="rounded-lg bg-[#1B7DF0] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1567CC]"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSuggestion(null); setSuggestionDismissed(true); }}
                              className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-xs font-medium text-[#6B7280] hover:bg-[#F7F8FA]"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Amount + Currency */}
                  <div>
                    <label htmlFor="exp-amount" className="mb-1.5 block text-sm font-medium text-[#1A1A2E]">
                      Total amount
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6B7280]">
                          {currency === "INR" ? "₹" : currency}
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
                          className="w-full rounded-lg border border-[#E5E7EB] py-2.5 pl-10 pr-3 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                        />
                      </div>
                      {/* Currency selector */}
                      <select
                        value={currency}
                        onChange={(e) => { setCurrency(e.target.value); setFxPreview(null); }}
                        className="w-28 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2.5 text-sm text-[#1A1A2E] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                      >
                        {CURRENCIES.map(({ code, flag }) => (
                          <option key={code} value={code}>{flag} {code}</option>
                        ))}
                      </select>
                    </div>
                    <input type="hidden" name="currency" value={currency} />

                    {/* Live FX preview (display only — actual rate fetched server-side) */}
                    {currency !== "INR" && parsedTotal > 0 && (
                      <p className="mt-1.5 text-xs text-[#6B7280]">
                        {fxFetching ? (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Fetching rate…
                          </span>
                        ) : fxPreview ? (
                          <>
                            ≈ {formatINR(parsedTotal * fxPreview.rate)} in group currency
                            <span className="ml-1 text-[#9CA3AF]">
                              (1 {currency} = ₹{fxPreview.rate.toFixed(2)})
                            </span>
                          </>
                        ) : (
                          "Rate unavailable — will be fetched at submission"
                        )}
                      </p>
                    )}
                  </div>

                  {/* Paid by */}
                  <div>
                    <label htmlFor="exp-paid-by" className="mb-1.5 block text-sm font-medium text-[#1A1A2E]">
                      Paid by
                    </label>
                    <select
                      id="exp-paid-by"
                      name="paid_by"
                      required
                      value={payerId}
                      onChange={handlePayerChange}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#1A1A2E] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Split between — member checkboxes */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#1A1A2E]">
                      Split between
                      <span className="ml-1.5 text-xs font-normal text-[#6B7280]">
                        ({activeMembers.length} of {members.length})
                      </span>
                    </label>
                    <div className="space-y-1.5 rounded-xl border border-[#E5E7EB] p-3">
                      {members.map((m) => {
                        const isPayer = m.id === payerId;
                        const isChecked = selectedIds.has(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[#F7F8FA] ${isPayer ? "cursor-default" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isPayer}
                              onChange={() => toggleMember(m.id)}
                              className="h-4 w-4 rounded border-[#E5E7EB] accent-[#1B7DF0]"
                            />
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B7DF0]/10 text-xs font-bold text-[#1B7DF0]">
                              {m.name[0].toUpperCase()}
                            </span>
                            <span className="flex-1 text-sm text-[#1A1A2E]">{m.name}</span>
                            {isPayer && (
                              <span className="rounded-full bg-[#1B7DF0]/10 px-2 py-0.5 text-xs font-medium text-[#1B7DF0]">
                                payer
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
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
                      {activeMembers.map((m) => (
                        <div key={m.id} className="flex justify-between text-sm">
                          <span className="text-[#6B7280]">{m.name}</span>
                          <span className="font-semibold tabular-nums text-[#1A1A2E]">
                            {formatAmount(parsedTotal / activeMembers.length, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PERCENTAGE inputs */}
                  {splitType === "PERCENTAGE" && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-[#1A1A2E]">Percentages</span>
                        <span className={`text-xs font-semibold tabular-nums ${pctValid ? "text-[#10B981]" : "text-amber-500"}`}>
                          {pctTotal.toFixed(1)}% / 100%
                        </span>
                      </div>
                      <div className="space-y-2">
                        {activeMembers.map((m) => (
                          <div key={m.id} className="flex items-center gap-3">
                            <span className="min-w-0 flex-1 truncate text-sm text-[#1A1A2E]">{m.name}</span>
                            <div className="relative w-28">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={pcts[m.id] ?? ""}
                                onChange={(e) => setPcts((p) => ({ ...p, [m.id]: e.target.value }))}
                                className={`w-full rounded-lg border py-1.5 pl-3 pr-7 text-right text-sm focus:outline-none focus:ring-2 ${
                                  pctValid
                                    ? "border-[#E5E7EB] focus:border-[#1B7DF0] focus:ring-[#1B7DF0]/20"
                                    : "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                                }`}
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">%</span>
                            </div>
                            {parsedTotal > 0 && (
                              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-[#6B7280]">
                                {formatINR((parseFloat(pcts[m.id] || "0") / 100) * parsedTotal)}
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
                        <span className="text-sm font-medium text-[#1A1A2E]">Amounts</span>
                        <span className={`text-xs font-semibold tabular-nums ${fixedValid ? "text-[#10B981]" : "text-amber-500"}`}>
                          {formatAmount(fixedTotal, currency)} / {formatAmount(parsedTotal, currency)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {activeMembers.map((m) => (
                          <div key={m.id} className="flex items-center gap-3">
                            <span className="min-w-0 flex-1 truncate text-sm text-[#1A1A2E]">{m.name}</span>
                            <div className="relative w-28">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280]">{currency === "INR" ? "₹" : currency}</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={fixed[m.id] ?? ""}
                                onChange={(e) => setFixed((a) => ({ ...a, [m.id]: e.target.value }))}
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

                  {/* ── Recurring toggle ─────────────────────────────────── */}
                  <div className="rounded-xl border border-[#E5E7EB] p-4">
                    <label className="flex cursor-pointer items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-[#6B7280]" />
                        <span className="text-sm font-medium text-[#1A1A2E]">
                          Make this a recurring expense
                        </span>
                      </div>
                      <div
                        onClick={() => setIsRecurring((v) => !v)}
                        className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${
                          isRecurring ? "bg-[#1B7DF0]" : "bg-[#E5E7EB]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            isRecurring ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </div>
                    </label>

                    <AnimatePresence>
                      {isRecurring && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 space-y-3 border-t border-[#E5E7EB] pt-4">
                            {/* Frequency */}
                            <div className="flex items-center gap-3">
                              <span className="w-24 shrink-0 text-sm text-[#6B7280]">Repeats</span>
                              <select
                                value={recurrenceRule}
                                onChange={(e) => setRecurrenceRule(e.target.value as RecurrenceRule)}
                                className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A2E] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                              >
                                {(Object.keys(RULE_LABELS) as RecurrenceRule[]).map((r) => (
                                  <option key={r} value={r}>{RULE_LABELS[r]}</option>
                                ))}
                              </select>
                            </div>

                            {/* Day picker */}
                            {recurrenceRule === "MONTHLY" && (
                              <div className="flex items-center gap-3">
                                <span className="w-24 shrink-0 text-sm text-[#6B7280]">On day</span>
                                <select
                                  value={recurrenceDay}
                                  onChange={(e) => setRecurrenceDay(Number(e.target.value))}
                                  className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A2E] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                                >
                                  {DAYS_OF_MONTH.map((d) => (
                                    <option key={d} value={d}>
                                      {d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"} of the month
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {(recurrenceRule === "WEEKLY" || recurrenceRule === "BIWEEKLY") && (
                              <div className="flex items-center gap-3">
                                <span className="w-24 shrink-0 text-sm text-[#6B7280]">On</span>
                                <select
                                  value={recurrenceDay}
                                  onChange={(e) => setRecurrenceDay(Number(e.target.value))}
                                  className="flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A2E] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                                >
                                  {DAYS_OF_WEEK.map((d, i) => (
                                    <option key={d} value={i}>{d}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Next charge preview */}
                            <div className="rounded-lg bg-[#F7F8FA] px-3 py-2 text-sm">
                              <span className="text-[#6B7280]">🔄 Next charge: </span>
                              <span className="font-medium text-[#1A1A2E]">
                                {formatNextDue(recurrenceRule, recurrenceDay)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Receipt upload ───────────────────────────────────── */}
                  <div className="rounded-xl border border-[#E5E7EB] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-[#6B7280]" />
                      <span className="text-sm font-medium text-[#1A1A2E]">
                        Add Receipt <span className="font-normal text-[#6B7280]">(optional)</span>
                      </span>
                    </div>

                    {receiptFile ? (
                      <div className="space-y-2">
                        {receiptPreviewUrl && (
                          <img
                            src={receiptPreviewUrl}
                            alt="Receipt preview"
                            className="max-h-40 w-full rounded-lg object-contain bg-[#F7F8FA]"
                          />
                        )}
                        {!receiptPreviewUrl && (
                          <div className="flex h-16 items-center justify-center rounded-lg bg-[#F7F8FA]">
                            <span className="text-2xl">📄</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-[#F7F8FA] px-3 py-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-[#1A1A2E]">
                            {receiptFile.name}
                          </span>
                          <span className="shrink-0 text-xs text-[#6B7280]">
                            {formatFileSize(receiptFile.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setReceiptFile(null); setReceiptPreviewUrl(null); }}
                            className="shrink-0 text-[#6B7280] hover:text-[#EF4444]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {uploadProgress !== null && (
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                            <div
                              className="h-full rounded-full bg-[#1B7DF0] transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {/* Camera */}
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex flex-col items-center gap-2 rounded-xl border border-[#E5E7EB] py-4 text-sm text-[#6B7280] transition hover:border-[#1B7DF0] hover:bg-[#F7F8FA] hover:text-[#1B7DF0]"
                        >
                          <Camera className="h-5 w-5" />
                          <span className="text-xs font-medium">Camera</span>
                        </button>
                        {/* Files */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center gap-2 rounded-xl border border-[#E5E7EB] py-4 text-sm text-[#6B7280] transition hover:border-[#1B7DF0] hover:bg-[#F7F8FA] hover:text-[#1B7DF0]"
                        >
                          <FolderOpen className="h-5 w-5" />
                          <span className="text-xs font-medium">Files</span>
                        </button>
                      </div>
                    )}

                    {receiptError && (
                      <p className="mt-2 text-xs text-[#EF4444]">{receiptError}</p>
                    )}

                    {/* Hidden inputs */}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(f);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(f);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-lg bg-[#1B7DF0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1567CC] disabled:opacity-50"
                  >
                    {isPending
                      ? uploadProgress !== null
                        ? `Uploading receipt… ${uploadProgress}%`
                        : "Saving…"
                      : "Save expense"}
                  </button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
