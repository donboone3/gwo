"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const msg = String(error?.message || "");
    if (
      /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch/i.test(
        msg
      ) &&
      typeof window !== "undefined"
    ) {
      try {
        const key = "gwo_global_chunk_reload_ts";
        const prev = Number(window.sessionStorage.getItem(key) || "0");
        if (Date.now() - prev > 12000) {
          window.sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      } catch {
        // ignore
      }
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#ffffff", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100svh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "360px",
              width: "100%",
              borderRadius: "24px",
              border: "1px solid rgba(20,21,24,0.08)",
              padding: "24px",
              textAlign: "center",
              boxShadow: "0 14px 34px rgba(20,21,24,0.06)",
            }}
          >
            <p style={{ fontSize: "15px", fontWeight: 800, color: "#141518", margin: "0 0 8px" }}>
              Refreshing GWO Runway
            </p>
            <p style={{ fontSize: "12px", color: "#686D76", margin: "0 0 16px", lineHeight: 1.5 }}>
              Tap below to open the latest 360° Runway session cleanly.
            </p>
            <button
              type="button"
              onClick={() => {
                reset();
                if (typeof window !== "undefined") window.location.reload();
              }}
              style={{
                width: "100%",
                padding: "11px 16px",
                borderRadius: "999px",
                border: 0,
                background: "#141518",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reload Runway
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
