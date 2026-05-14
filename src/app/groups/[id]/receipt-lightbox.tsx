"use client";

import { useEffect } from "react";
import { X, Download, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  url: string;
  filename: string;
  onClose: () => void;
};

function isPdf(url: string, filename: string) {
  return url.toLowerCase().includes(".pdf") || filename.toLowerCase().endsWith(".pdf");
}

export function ReceiptLightbox({ url, filename, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pdf = isPdf(url, filename);

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Toolbar */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="max-w-xs truncate text-sm font-medium text-white/80">
            {filename}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download={filename}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            {pdf && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex flex-1 items-center justify-center overflow-auto p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {pdf ? (
            <iframe
              src={url}
              className="h-full w-full max-w-3xl rounded-lg bg-white"
              title={filename}
            />
          ) : (
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
              src={url}
              alt={filename}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
