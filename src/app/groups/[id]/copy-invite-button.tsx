"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import toast from "react-hot-toast";

export function CopyInviteButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Invite code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
    >
      <div>
        <p className="text-left text-xs font-medium text-white/60">Invite code</p>
        <p className="font-mono text-xl font-bold tracking-widest text-white">
          {code}
        </p>
      </div>
      {copied ? (
        <Check className="h-4 w-4 text-[#6EE7B7]" />
      ) : (
        <Copy className="h-4 w-4 text-white/60" />
      )}
    </button>
  );
}
