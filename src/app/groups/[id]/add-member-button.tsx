"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, UserPlus, Search, Check, Copy, Loader2, BookUser } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { searchUsers, addMemberToGroup, type UserSearchResult } from "@/app/actions/members";

// Web Contact Picker API — only available on Android Chrome 80+
declare global {
  interface Navigator {
    contacts?: {
      select(
        props: string[],
        opts?: { multiple?: boolean }
      ): Promise<Array<{ name?: string[]; email?: string[] }>>;
    };
  }
}

type Props = {
  groupId: string;
  inviteCode: string;
};

export function AddMemberButton({ groupId, inviteCode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState(false);
  const [contactsSupported, setContactsSupported] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setContactsSupported(typeof navigator !== "undefined" && !!navigator.contacts);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery("");
      setResults([]);
      setAddedIds(new Set());
    }
  }, [open]);

  const runSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(() => {
        startSearch(async () => {
          const { results: res } = await searchUsers(groupId, q);
          setResults(res);
        });
      }, 280);
    },
    [groupId]
  );

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    runSearch(v);
  }

  async function handleContactPicker() {
    if (!navigator.contacts) return;
    try {
      const contacts = await navigator.contacts.select(["email", "name"], {
        multiple: false,
      });
      if (contacts.length > 0) {
        const email = contacts[0].email?.[0] ?? "";
        const name = contacts[0].name?.[0] ?? "";
        const prefill = email || name;
        setQuery(prefill);
        runSearch(prefill);
        inputRef.current?.focus();
      }
    } catch {
      // User cancelled picker — silently ignore
    }
  }

  function handleAdd(user: UserSearchResult) {
    startAdd(async () => {
      const result = await addMemberToGroup(groupId, user.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setAddedIds((prev) => new Set([...prev, user.id]));
        toast.success(`${user.name} added to the group`);
        router.refresh();
      }
    });
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      toast.success("Invite code copied!");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
      >
        <UserPlus className="h-4 w-4" />
        <span className="hidden sm:inline">Add member</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="am-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <motion.div
                key="am-modal"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ type: "spring", damping: 28, stiffness: 380 }}
                className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
              >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#1A1A2E]">Add members</h2>
                    <p className="text-xs text-[#6B7280]">
                      Search by name or email, or share the invite code
                    </p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F7F8FA]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-5 overflow-y-auto px-6 py-5">
                  {/* Search input row */}
                  <div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                        <input
                          ref={inputRef}
                          type="text"
                          value={query}
                          onChange={handleQueryChange}
                          placeholder="Name or email address…"
                          className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                        />
                      </div>
                      {contactsSupported && (
                        <button
                          type="button"
                          onClick={handleContactPicker}
                          title="Pick from device contacts"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#6B7280] transition hover:bg-[#F7F8FA] hover:text-[#1B7DF0]"
                        >
                          <BookUser className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Results */}
                    <div className="mt-2">
                      {searching && (
                        <div className="flex items-center gap-2 py-3 text-sm text-[#6B7280]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching…
                        </div>
                      )}

                      {!searching && query.trim().length >= 2 && results.length === 0 && (
                        <p className="py-3 text-sm text-[#6B7280]">
                          No app users found matching &ldquo;{query}&rdquo;.
                          <br />
                          Share the invite code below so they can join.
                        </p>
                      )}

                      {!searching && results.length > 0 && (
                        <ul className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                          {results.map((u, idx) => {
                            const isAdded = addedIds.has(u.id);
                            return (
                              <li
                                key={u.id}
                                className={`flex items-center gap-3 px-4 py-3 ${
                                  idx > 0 ? "border-t border-[#E5E7EB]" : ""
                                }`}
                              >
                                {/* Avatar initials */}
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B7DF0]/10 text-sm font-bold text-[#1B7DF0]">
                                  {u.name[0].toUpperCase()}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-[#1A1A2E]">
                                    {u.name}
                                  </p>
                                  <p className="truncate text-xs text-[#6B7280]">
                                    {u.email}
                                  </p>
                                </div>

                                {isAdded ? (
                                  <span className="flex items-center gap-1 rounded-full bg-[#10B981]/10 px-3 py-1 text-xs font-medium text-[#10B981]">
                                    <Check className="h-3 w-3" />
                                    Added
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleAdd(u)}
                                    disabled={adding}
                                    className="rounded-lg bg-[#1B7DF0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1567CC] disabled:opacity-50"
                                  >
                                    Add
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="relative flex items-center">
                    <div className="flex-1 border-t border-[#E5E7EB]" />
                    <span className="bg-white px-3 text-xs text-[#6B7280]">
                      or share invite code
                    </span>
                    <div className="flex-1 border-t border-[#E5E7EB]" />
                  </div>

                  {/* Invite code card */}
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] px-4 py-3">
                    <p className="mb-2 text-xs text-[#6B7280]">
                      Share this code with anyone — they&apos;ll join via{" "}
                      <strong className="text-[#1A1A2E]">Join group</strong> on
                      the dashboard.
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-2xl font-extrabold tracking-widest text-[#1A1A2E]">
                        {inviteCode}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#1A1A2E] transition hover:bg-[#F7F8FA]"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#10B981]" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy code
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
