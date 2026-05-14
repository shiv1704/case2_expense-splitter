"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { deleteGroup, leaveGroup, renameGroup } from "@/app/actions/groups";

type Props = {
  groupId: string;
  groupName: string;
  isCreator: boolean;
};

export function GroupSettings({ groupId, groupName, isCreator }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [newName, setNewName] = useState(groupName);
  const [pending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowRename(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGroup(groupId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Group deleted");
        router.push("/dashboard");
      }
    });
  }

  function handleLeave() {
    startTransition(async () => {
      const result = await leaveGroup(groupId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Left group");
        router.push("/dashboard");
      }
    });
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await renameGroup(groupId, newName.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Group renamed");
        setShowRename(false);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setShowRename(false); }}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-lg text-white transition hover:bg-white/20"
        aria-label="Group settings"
      >
        ⚙
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-11 z-50 min-w-[200px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
          >
            {showRename ? (
              <form onSubmit={handleRename} className="space-y-2 p-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1A1A2E] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
                  placeholder="Group name"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex-1 rounded-lg bg-[#1B7DF0] py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRename(false)}
                    className="flex-1 rounded-lg border border-[#E5E7EB] py-1.5 text-xs font-medium text-[#6B7280]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-1">
                <button
                  onClick={() => setShowRename(true)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[#1A1A2E] transition hover:bg-[#F7F8FA]"
                >
                  ✏️ <span>Edit group name</span>
                </button>
                <button
                  onClick={handleLeave}
                  disabled={pending}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[#1A1A2E] transition hover:bg-[#F7F8FA] disabled:opacity-50"
                >
                  🚪 <span>Leave group</span>
                </button>
                {isCreator && (
                  <>
                    <div className="mx-3 my-1 border-t border-[#E5E7EB]" />
                    <button
                      onClick={() => { setOpen(false); setShowDelete(true); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[#EF4444] transition hover:bg-red-50"
                    >
                      🗑️ <span>Delete group</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal — rendered outside the dropdown div */}
      <AnimatePresence>
        {showDelete && (
          <>
            <motion.div
              key="delete-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowDelete(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                key="delete-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 28, stiffness: 380 }}
                className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              >
                <h3 className="text-lg font-bold text-[#1A1A2E]">
                  Delete {groupName}?
                </h3>
                <p className="mt-2 text-sm text-[#6B7280]">
                  This will permanently delete all expenses and settlements.
                  This cannot be undone.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowDelete(false)}
                    className="flex-1 rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-medium text-[#6B7280] transition hover:bg-[#F7F8FA]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={pending}
                    className="flex-1 rounded-xl bg-[#EF4444] py-2.5 text-sm font-semibold text-white transition hover:bg-[#DC2626] disabled:opacity-50"
                  >
                    {pending ? "Deleting…" : "Delete group"}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
