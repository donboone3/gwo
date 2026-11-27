"use client";

import React, { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const msg = String(error?.message || "");
    const isChunkMismatch =
      /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch/i.test(
        msg
      );
    if (isChunkMismatch && typeof window !== "undefined") {
      try {
        const key = "gwo_chunk_reload_ts";
        const prev = Number(window.sessionStorage.getItem(key) || "0");
        if (Date.now() - prev > 12000) {
          window.sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // ignore sessionStorage error
      }
    }
  }, [error]);

  return (
    <div className="min-h-[calc(100svh-64px)] w-full flex items-center justify-center bg-white px-5">
      <div className="max-w-sm w-full rounded-3xl border border-black/[0.08] bg-white p-6 text-center shadow-[0_14px_34px_rgba(20,21,24,0.06)] space-y-3">
        <p className="text-sm font-extrabold text-[#141518]">
          Refreshing Your 360° Studio
        </p>
        <p className="text-xs text-[#686D76] leading-relaxed">
          A fresh studio update just published. Tap below to reload cleanly.
        </p>
        <button
          type="button"
          onClick={() => {
            reset();
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
          className="w-full py-2.5 px-4 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reload Studio
        </button>
      </div>
    </div>
  );
}
