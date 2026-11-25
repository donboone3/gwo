"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { GwoLogo } from "../brand/GwoLogo";
import { useGwo } from "@/context/GwoAppContext";

const STEPS = [
  { href: "/", match: ["/", "/closet"], label: "Closet & Try-On" },
  { href: "/shop", match: ["/shop", "/recommended"], label: "For You Runway" },
  { href: "/product", match: ["/product"], label: "360° Fit View" },
];

export function UnifiedGwoNav() {
  const pathname = usePathname() || "/";
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  const {
    bagItems,
    bagOpen,
    setBagOpen,
    bagBump,
    removeFromBag,
    addUrlModalOpen,
    setAddUrlModalOpen,
    ingestUrlToSharedCatalog,
    shareMyClosetAndClaimBonus,
    toastMessage,
  } = useGwo();

  const [copiedLink, setCopiedLink] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);

  const bagTotal = bagItems.reduce((sum, item) => sum + item.price, 0);

  const handleImportSubmit = async (sample?: string) => {
    const target = (sample ?? urlInput).trim();
    if (!target) return;
    setImporting(true);
    try {
      const res = await ingestUrlToSharedCatalog(target);
      if (res?.product) {
        setUrlInput("");
        setAddUrlModalOpen(false);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      {/* ==================== UNIFIED PERSISTENT GWO HEADER ==================== */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 px-4 sm:px-7 bg-white/86 backdrop-blur-xl border-b border-black/[0.07] flex items-center justify-between gap-3">
        {/* Left: Pure 4-Stroke Cursive GWO Brand Mark */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="inline-flex items-center">
            <GwoLogo height={38} replayOnClick={false} className="text-[#141518]" />
          </Link>
        </div>

        {/* Center: Clean 3-Step Customer Flow */}
        <nav
          aria-label="GWO Steps"
          className="flex items-center p-1 rounded-full bg-[#F1F2F5] border border-black/[0.05]"
        >
          {STEPS.map((step) => {
            const active =
              step.href === "/"
                ? cleanPath === "/" || cleanPath === "/closet"
                : step.match.some((m) => cleanPath.startsWith(m));
            return (
              <Link
                key={step.href}
                href={step.href}
                className={`px-3.5 sm:px-5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap ${
                  active
                    ? "bg-white text-[#141518] shadow-[0_2px_8px_rgba(20,21,24,0.08)]"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                {step.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Simple Actions (+ Add Link, Share Closet, Unified Bag) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAddUrlModalOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-[#F1F2F5] hover:bg-[#E6E8ED] text-[#141518] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Store Link
          </button>

          <button
            type="button"
            onClick={async () => {
              await shareMyClosetAndClaimBonus();
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2200);
            }}
            title="Share your closet link with friends"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-black/[0.1] bg-white hover:bg-[#F7F8FA] text-[#141518] transition cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#244B3B]" /> Copied!
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" /> Share Closet
              </>
            )}
          </button>

          <button
            type="button"
            id="gwo-unified-bag-btn"
            onClick={() => setBagOpen(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#141518] text-white hover:bg-[#27292E] transition cursor-pointer ${
              bagBump ? "scale-110" : "scale-100"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bag ({bagItems.length})</span>
          </button>
        </div>
      </header>

      {/* ==================== UNIFIED SLIDE-OVER BAG DRAWER ==================== */}
      {bagOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-xs flex justify-end"
          onClick={() => setBagOpen(false)}
        >
          <div
            className="w-full max-w-md h-full bg-white shadow-2xl border-l border-black/[0.08] flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-black/[0.08] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#141518]">
                  Your Outfit Bag ({bagItems.length})
                </h2>
                <p className="text-xs text-[#686D76] mt-0.5">
                  One unified bag across your Closet, Runway &amp; 360° View
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBagOpen(false)}
                className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {bagItems.length === 0 ? (
                <div className="text-center py-14 space-y-2">
                  <ShoppingBag className="w-7 h-7 mx-auto text-[#A0A5AE]" />
                  <p className="text-sm font-semibold text-[#141518]">
                    Your bag is empty
                  </p>
                  <p className="text-xs text-[#686D76]">
                    Tap + Bag on any outfit piece in Closet, Runway, or 360° View.
                  </p>
                </div>
              ) : (
                bagItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#686D76]">
                        {item.brand} • Size {item.size}
                      </p>
                      <p className="text-sm font-semibold text-[#141518] truncate mt-0.5">
                        {item.title}
                      </p>
                      {item.friendRef && (
                        <p className="text-[11px] text-[#244B3B] font-medium mt-0.5">
                          Friend Closet Credit: {item.friendRef}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-[#141518]">
                        ${item.price}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromBag(item.id)}
                        className="p-1.5 rounded-full hover:bg-black/[0.06] text-[#686D76] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {bagItems.length > 0 && (
              <div className="p-6 border-t border-black/[0.08] bg-[#FAFBFD] space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#686D76] font-medium">
                    Outfit Total ({bagItems.length} items)
                  </span>
                  <span className="text-lg font-bold text-[#141518]">
                    ${bagTotal.toLocaleString()}
                  </span>
                </div>
                <a
                  href={bagItems[0]?.storeUrl || "https://www.nike.com/w/womens-clothing-5e1x6z6ymx6"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  Continue to Store Checkout <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SIMPLE 1-STEP "ADD STORE LINK" MODAL ==================== */}
      {addUrlModalOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAddUrlModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-black/[0.08] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#141518]">
                  Add Any Store Piece to GWO
                </h3>
                <p className="text-xs text-[#686D76] mt-1">
                  Paste a product link from Nike, Skims, Reformation, or any boutique. Once added, it&apos;s saved in GWO&apos;s shared closet for you and your friends.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddUrlModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 text-[#8A9099] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.nike.com/t/..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-full text-xs sm:text-sm bg-[#F4F5F7] border border-black/[0.08] focus:outline-none focus:border-[#141518]"
                />
              </div>
              <button
                type="button"
                disabled={importing || !urlInput.trim()}
                onClick={() => handleImportSubmit()}
                className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#141518] text-white hover:bg-[#27292E] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding...
                  </>
                ) : (
                  "Add Piece"
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-[#686D76]">
              <span>Try a quick link:</span>
              {[
                {
                  label: "Nike Phoenix Hoodie",
                  url: "https://www.nike.com/t/sportswear-phoenix-fleece-womens-oversized-pullover-hoodie",
                },
                {
                  label: "Alo Airlift Legging",
                  url: "https://www.aloyoga.com/products/w5766r-high-waist-airlift-legging-espresso",
                },
                {
                  label: "SKIMS Cotton Tee",
                  url: "https://skims.com/products/cotton-jersey-t-shirt-soot",
                },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleImportSubmit(s.url)}
                  className="px-2.5 py-1 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EC] text-[#141518] font-medium cursor-pointer"
                >
                  + {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== UNIFIED SUBTLE TOAST ==================== */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-[#141518] text-white text-xs font-medium shadow-xl flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
