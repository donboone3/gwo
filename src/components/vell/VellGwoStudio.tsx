"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  HeartHandshake,
  Plus,
  Rotate3d,
  Ruler,
  ShoppingBag,
  Sparkles,
  ZoomIn,
} from "lucide-react";
import {
  ACCESSORY_CATALOG,
  H,
  LOFT_BG_URL,
  STUDIO_LOOKS,
} from "./vell-data";
import { useGwo } from "@/context/GwoAppContext";

type SimpleCategory = "all" | "everyday" | "athletic" | "going-out" | "accessories";

interface DragGhost {
  kind: "look" | "accessory" | "scraped";
  label: string;
  price: number;
  lookIndex?: number;
  accessoryName?: string;
  x: number;
  y: number;
}

export function VellGwoStudio() {
  const {
    user,
    friends,
    products,
    addToBag,
    bagItems,
    updateProfilePatch,
    shareMyClosetAndClaimBonus,
    setAddUrlModalOpen,
    showToast,
  } = useGwo();

  const figsRef = useRef<HTMLDivElement | null>(null);
  const scanRef = useRef<HTMLDivElement | null>(null);
  const modelBoxRef = useRef<HTMLDivElement | null>(null);
  const preloadedImgsRef = useRef<HTMLImageElement[]>([]);
  const swapTokenRef = useRef(0);
  const swipeStartXRef = useRef<number | null>(null);

  const [lookIdx, setLookIdx] = useState(0);
  const [closetOwner, setClosetOwner] = useState<string>("all"); // "all" | "maya" | "chloe" | "sofia"
  const [category, setCategory] = useState<SimpleCategory>("all");
  const [zoomed, setZoomed] = useState(false);
  const [equippedAccessories, setEquippedAccessories] = useState<string[]>([
    "Gold hoops",
  ]);
  const [editingFit, setEditingFit] = useState(false);
  const [copiedCloset, setCopiedCloset] = useState(false);

  // Subtle background pointer parallax
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const [overAvatar, setOverAvatar] = useState(false);

  // Measurement inputs
  const [waistIn, setWaistIn] = useState<number | null>(null);
  const [hipsIn, setHipsIn] = useState<number | null>(null);
  const [heightIn, setHeightIn] = useState<number | null>(null);

  // Preload all 8 photoreal w=1000 cutouts on mount
  useEffect(() => {
    const imgs = STUDIO_LOOKS.map((l) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = H(l.file, 1000);
      return im;
    });
    preloadedImgsRef.current = imgs;

    if (figsRef.current) {
      figsRef.current.innerHTML = "";
      const base = document.createElement("div");
      base.className = "gwo-fig-layer";
      base.style.backgroundImage = `url("${H(STUDIO_LOOKS[0].file, 1000)}")`;
      figsRef.current.appendChild(base);
    }
  }, []);

  const triggerScanLine = useCallback(() => {
    const el = scanRef.current;
    if (!el) return;
    el.classList.remove("active");
    void el.offsetWidth;
    el.classList.add("active");
  }, []);

  const swapToLook = useCallback(
    async (idx: number) => {
      const normalized = ((idx % STUDIO_LOOKS.length) + STUDIO_LOOKS.length) % STUDIO_LOOKS.length;
      setLookIdx(normalized);
      const token = ++swapTokenRef.current;

      const preload = preloadedImgsRef.current[normalized];
      try {
        if (preload) await preload.decode();
      } catch {
        // Continue immediately
      }
      if (token !== swapTokenRef.current) return;

      const container = figsRef.current;
      if (!container) return;

      const nextLayer = document.createElement("div");
      nextLayer.className = "gwo-fig-layer wipe-in";
      nextLayer.style.backgroundImage = `url("${H(STUDIO_LOOKS[normalized].file, 1000)}")`;
      container.appendChild(nextLayer);

      triggerScanLine();

      nextLayer.addEventListener(
        "animationend",
        () => {
          Array.from(container.children).forEach((ch) => {
            if (ch !== nextLayer) ch.remove();
          });
          nextLayer.classList.remove("wipe-in");
        },
        { once: true }
      );
    },
    [triggerScanLine]
  );

  // Keyboard ArrowLeft / ArrowRight to step looks cleanly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        void swapToLook(lookIdx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        void swapToLook(lookIdx - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lookIdx, swapToLook]);

  const isOverModel = useCallback((cx: number, cy: number) => {
    const box = modelBoxRef.current?.getBoundingClientRect();
    if (!box) return false;
    return (
      cx >= box.left - 40 &&
      cx <= box.right + 40 &&
      cy >= box.top - 20 &&
      cy <= box.bottom + 20
    );
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setParallax({
        x: (e.clientX / window.innerWidth - 0.5) * -16,
        y: (e.clientY / window.innerHeight - 0.5) * -8,
      });
      if (dragGhost) {
        setDragGhost((prev) =>
          prev ? { ...prev, x: e.clientX, y: e.clientY } : null
        );
        setOverAvatar(isOverModel(e.clientX, e.clientY));
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!dragGhost) return;
      if (isOverModel(e.clientX, e.clientY)) {
        if (dragGhost.kind === "look" && dragGhost.lookIndex !== undefined) {
          void swapToLook(dragGhost.lookIndex);
          showToast(`Trying on ${dragGhost.label}`);
        } else if (
          dragGhost.kind === "accessory" &&
          dragGhost.accessoryName
        ) {
          const accName = dragGhost.accessoryName;
          setEquippedAccessories((prev) =>
            prev.includes(accName) ? prev : [...prev, accName]
          );
          triggerScanLine();
          showToast(`Added ${accName} to your look`);
        } else if (dragGhost.kind === "scraped") {
          triggerScanLine();
          showToast(`Styled ${dragGhost.label} onto your avatar`);
        }
      }
      setDragGhost(null);
      setOverAvatar(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragGhost, isOverModel, showToast, swapToLook, triggerScanLine]);

  const currentLook = STUDIO_LOOKS[lookIdx];

  // Filtered looks based on Friend Closet + simple category
  const filteredLooks = useMemo(() => {
    return STUDIO_LOOKS.filter((lk) => {
      if (closetOwner !== "all" && lk.friendOwner !== closetOwner) return false;
      if (category === "all" || category === "accessories") return true;
      if (category === "everyday") {
        return lk.category === "everyday" || lk.category === "sleep";
      }
      if (category === "athletic") {
        return lk.category === "athletic";
      }
      if (category === "going-out") {
        return (
          lk.category === "party" ||
          lk.category === "formal" ||
          lk.category === "street"
        );
      }
      return true;
    });
  }, [category, closetOwner]);

  // Flatten pieces worn in the current look
  const currentPieces = useMemo(() => {
    const p = currentLook.pieces;
    const base = [
      ...p.tops,
      ...p.bottoms,
      ...p.full,
      ...p.shoes,
      ...p.acc,
    ];
    const extraAcc = ACCESSORY_CATALOG.filter(
      (a) =>
        equippedAccessories.includes(a.name) &&
        !p.acc.some((existing) => existing.name === a.name)
    ).map((a) => ({ name: a.name, color: a.color, price: a.price }));
    return [...base, ...extraAcc];
  }, [currentLook, equippedAccessories]);

  const totalLookPrice = currentPieces.reduce((s, p) => s + p.price, 0);
  const friendRefCode = currentLook.friendOwner
    ? `${currentLook.friendOwner.toUpperCase()}-GWO`
    : undefined;

  const handleAddFullLook = () => {
    currentPieces.forEach((piece) => {
      addToBag({
        title: piece.name,
        brand: currentLook.friendOwner
          ? `@${currentLook.friendOwner}'s Closet`
          : "GWO Studio",
        price: piece.price,
        size: "S",
        friendRef: friendRefCode,
      });
    });
  };

  const scrapedCommunityItems = products
    .filter((p) => p.sourceType === "scraped_url")
    .slice(0, 4);

  return (
    <div className="relative h-[calc(100svh-64px)] w-full overflow-hidden select-none bg-[#E7EAEF]">
      <style>{`
        .gwo-fig-layer {
          position: absolute;
          inset: 0;
          background-position: center bottom;
          background-size: contain;
          background-repeat: no-repeat;
        }
        .gwo-fig-layer.wipe-in {
          clip-path: inset(0 0 100% 0);
          animation: gwoCleanWipe 0.95s cubic-bezier(0.7, 0, 0.25, 1) forwards;
        }
        @keyframes gwoCleanWipe {
          0% { clip-path: inset(0 0 100% 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        .gwo-scan-beam {
          position: absolute;
          left: -8%;
          right: -8%;
          top: 0;
          height: 2px;
          opacity: 0;
          pointer-events: none;
          z-index: 20;
          background: linear-gradient(90deg, transparent, #ffffff 25%, #ffffff 75%, transparent);
          box-shadow: 0 0 20px 5px rgba(255, 255, 255, 0.7), 0 0 50px 14px rgba(200, 220, 255, 0.4);
        }
        .gwo-scan-beam.active {
          animation: gwoBeamSweep 0.95s cubic-bezier(0.7, 0, 0.25, 1) forwards;
        }
        @keyframes gwoBeamSweep {
          0% { top: 0%; opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>

      {/* ==================== PHOTOREAL DAYLIGHT STUDIO BACKDROP ==================== */}
      <div
        className="absolute inset-[-3%] bg-cover bg-center transition-transform duration-500 ease-out"
        style={{
          backgroundImage: `url("${LOFT_BG_URL}")`,
          transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1.03)`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/20 pointer-events-none" />

      {/* ==================== RESPONSIVE 3-ZONE STUDIO GRID ==================== */}
      <div className="relative z-10 h-full max-w-[1520px] mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row items-stretch justify-between gap-4">
        {/* ==================== LEFT PANEL: CLOSETS & FIT PROFILE ==================== */}
        <aside className="hidden lg:flex lg:w-[310px] shrink-0 flex-col justify-between rounded-3xl bg-white/86 backdrop-blur-xl border border-black/[0.08] shadow-[0_18px_45px_rgba(20,21,24,0.08)] p-5 overflow-y-auto">
          <div className="space-y-5">
            {/* Step Context Header */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B]">
                Girls&apos; Shared Closets
              </p>
              <h1 className="text-lg font-bold text-[#141518] mt-0.5">
                Choose a Closet to Try On
              </h1>
              <p className="text-xs text-[#686D76] mt-0.5">
                Try on outfits from friends with your body measurements.
              </p>
            </div>

            {/* 1-Tap Closet Switcher */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setClosetOwner("all")}
                className={`w-full p-3 rounded-2xl text-left transition flex items-center justify-between border cursor-pointer ${
                  closetOwner === "all"
                    ? "bg-[#141518] text-white border-[#141518]"
                    : "bg-[#F7F8FA] hover:bg-[#EFF1F5] text-[#141518] border-black/[0.05]"
                }`}
              >
                <div>
                  <p className="text-xs font-bold">All Shared Closets</p>
                  <p
                    className={`text-[11px] ${
                      closetOwner === "all" ? "text-white/70" : "text-[#686D76]"
                    }`}
                  >
                    8 complete outfits ready to try
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15">
                  All
                </span>
              </button>

              {[
                {
                  handle: "maya",
                  name: "Maya Lin",
                  twin: 97,
                  stats: '5\'5" • 26.5" Waist • Size S',
                },
                {
                  handle: "chloe",
                  name: "Chloe Beaumont",
                  twin: 86,
                  stats: '5\'7" • 27.5" Waist • Size S/M',
                },
                {
                  handle: "sofia",
                  name: "Sofia Reyes",
                  twin: 88,
                  stats: '5\'3" • 25.5" Waist • Size XS/S',
                },
              ].map((fr) => {
                const active = closetOwner === fr.handle;
                const foundFriend = friends.find((f) => f.username === fr.handle);
                return (
                  <button
                    key={fr.handle}
                    type="button"
                    onClick={() => {
                      setClosetOwner(fr.handle);
                      const firstMatch = STUDIO_LOOKS.find(
                        (l) => l.friendOwner === fr.handle
                      );
                      if (firstMatch) void swapToLook(firstMatch.index);
                    }}
                    className={`w-full p-3 rounded-2xl text-left transition border cursor-pointer ${
                      active
                        ? "bg-[#141518] text-white border-[#141518]"
                        : "bg-white hover:bg-[#F7F8FA] text-[#141518] border-black/[0.07]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">
                        @{fr.handle} ({fr.name.split(" ")[0]})
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          active
                            ? "bg-[#A7D7C5]/25 text-[#B9F0DA]"
                            : "bg-[#E7F3EE] text-[#244B3B]"
                        }`}
                      >
                        <HeartHandshake className="w-3 h-3" /> {fr.twin}% Twin
                      </span>
                    </div>
                    <p
                      className={`text-[11px] mt-1 ${
                        active ? "text-white/70" : "text-[#686D76]"
                      }`}
                    >
                      {foundFriend
                        ? `${Math.floor(foundFriend.heightInches / 12)}'${Math.round(
                            foundFriend.heightInches % 12
                          )}" • ${foundFriend.waistInches}" Waist`
                        : fr.stats}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Clean Exact Fit Measurements Card */}
            <div className="rounded-2xl bg-[#F7F8FA] border border-black/[0.06] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#244B3B]" /> Your Fit Profile
                </span>
                <button
                  type="button"
                  onClick={() => setEditingFit((v) => !v)}
                  className="text-[11px] font-semibold text-[#244B3B] hover:underline cursor-pointer"
                >
                  {editingFit ? "Done" : "Edit"}
                </button>
              </div>

              {!editingFit ? (
                <p className="text-xs text-[#686D76]">
                  {user
                    ? `${Math.floor(user.heightInches / 12)}'${Math.round(
                        user.heightInches % 12
                      )}" • ${user.waistInches}" Waist • ${user.hipsInches}" Hips • Shoe ${
                        user.shoeSize
                      }`
                    : '5\'5" • 26.5" Waist • 37" Hips • Shoe 7.5'}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <label className="text-[10px] text-[#686D76]">
                    Height (in)
                    <input
                      type="number"
                      defaultValue={user?.heightInches ?? 65}
                      onChange={(e) => setHeightIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs font-semibold text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] text-[#686D76]">
                    Waist (in)
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={user?.waistInches ?? 26.5}
                      onChange={(e) => setWaistIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs font-semibold text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] text-[#686D76]">
                    Hips (in)
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={user?.hipsInches ?? 37}
                      onChange={(e) => setHipsIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs font-semibold text-[#141518]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateProfilePatch({
                        ...(heightIn ? { heightInches: heightIn } : {}),
                        ...(waistIn ? { waistInches: waistIn } : {}),
                        ...(hipsIn ? { hipsInches: hipsIn } : {}),
                      });
                      setEditingFit(false);
                    }}
                    className="col-span-3 mt-1 py-1.5 rounded-lg bg-[#141518] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Fit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Share Closet CTA */}
          <button
            type="button"
            onClick={async () => {
              await shareMyClosetAndClaimBonus();
              setCopiedCloset(true);
              setTimeout(() => setCopiedCloset(false), 2200);
            }}
            className="w-full py-2.5 px-4 rounded-full bg-[#E7F3EE] hover:bg-[#D8ECE4] text-[#244B3B] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {copiedCloset ? (
              <>
                <Check className="w-3.5 h-3.5" /> Closet Link Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Share My Closet Link
              </>
            )}
          </button>
        </aside>

        {/* ==================== CENTER STAGE: PHOTOREAL AVATAR ==================== */}
        <div className="relative flex-1 flex flex-col items-center justify-between min-h-0">
          {/* Top Floating Outfit Status Pill */}
          <div className="px-4 py-1.5 rounded-full bg-white/84 backdrop-blur-md border border-black/[0.07] shadow-xs flex items-center gap-2 text-xs">
            <span className="font-bold text-[#141518]">{currentLook.name}</span>
            {currentLook.friendOwner && (
              <span className="text-[#244B3B] font-semibold">
                • From @{currentLook.friendOwner}&apos;s Closet ({currentLook.friendTwinPct}% Twin)
              </span>
            )}
          </div>

          {/* Photoreal Model Figure + Scan Wipe + Drop Target */}
          <div
            ref={modelBoxRef}
            onPointerDown={(e) => {
              swipeStartXRef.current = e.clientX;
            }}
            onPointerUp={(e) => {
              if (swipeStartXRef.current === null) return;
              const dx = e.clientX - swipeStartXRef.current;
              swipeStartXRef.current = null;
              if (Math.abs(dx) > 40 && !dragGhost) {
                void swapToLook(lookIdx + (dx < 0 ? 1 : -1));
              }
            }}
            className={`relative w-[340px] sm:w-[400px] flex-1 my-2 cursor-grab active:cursor-grabbing transition-transform duration-700 ${
              zoomed ? "scale-[1.42] translate-y-28" : "scale-100"
            }`}
          >
            {/* Drop Halo when dragging an item onto avatar */}
            {overAvatar && (
              <div className="absolute inset-x-4 inset-y-2 rounded-3xl border-2 border-dashed border-white bg-white/20 backdrop-blur-[2px] z-30 flex items-start justify-center pt-4 pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-[#141518] text-white text-[11px] font-bold shadow-lg">
                  Drop to Try On Avatar
                </span>
              </div>
            )}

            {/* Floor Shadow */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-56 h-7 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(25,26,30,0.42), transparent)",
                filter: "blur(4px)",
              }}
            />

            <div ref={figsRef} className="absolute inset-0 pointer-events-none" />
            <div ref={scanRef} className="gwo-scan-beam" />
          </div>

          {/* Clean Minimal Bottom Stage Controls */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/88 backdrop-blur-xl border border-black/[0.08] shadow-lg z-20">
            <button
              type="button"
              onClick={() => void swapToLook(lookIdx - 1)}
              className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
              title="Previous Outfit"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#F1F2F5] text-[#141518] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              {zoomed ? "Full Body" : "Zoom Fit"}
            </button>

            <button
              type="button"
              onClick={handleAddFullLook}
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#141518] text-white hover:bg-[#27292E] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Bag Full Look (${totalLookPrice})
            </button>

            <button
              type="button"
              onClick={() => void swapToLook(lookIdx + 1)}
              className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
              title="Next Outfit"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ==================== RIGHT PANEL: WARDROBE, ACCESSORIES & WORN PIECES ==================== */}
        <aside className="w-full lg:w-[390px] shrink-0 rounded-3xl bg-white/88 backdrop-blur-xl border border-black/[0.08] shadow-[0_18px_45px_rgba(20,21,24,0.08)] p-5 flex flex-col justify-between gap-4 overflow-y-auto max-h-[42vh] lg:max-h-none">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#141518]">
                  Wardrobe &amp; Accessories
                </h2>
                <p className="text-xs text-[#686D76]">
                  Tap or drag any piece onto your avatar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddUrlModalOpen(true)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F1F2F5] hover:bg-[#E5E7EC] text-[#141518] inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Paste URL
              </button>
            </div>

            {/* Simple 5-Pill Filter */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["everyday", "Everyday"],
                  ["athletic", "Active"],
                  ["going-out", "Going Out"],
                  ["accessories", "Accessories"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                    category === id
                      ? "bg-[#141518] text-white"
                      : "bg-[#F4F5F7] text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Clean Visual Look / Accessory Grid */}
            {category === "accessories" ? (
              <div className="grid grid-cols-2 gap-2.5">
                {ACCESSORY_CATALOG.map((acc) => {
                  const on = equippedAccessories.includes(acc.name);
                  return (
                    <div
                      key={acc.id}
                      onPointerDown={(e) =>
                        setDragGhost({
                          kind: "accessory",
                          label: acc.name,
                          price: acc.price,
                          accessoryName: acc.name,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }
                      onClick={() => {
                        setEquippedAccessories((prev) =>
                          prev.includes(acc.name)
                            ? prev.filter((x) => x !== acc.name)
                            : [...prev, acc.name]
                        );
                        triggerScanLine();
                      }}
                      className={`p-3 rounded-2xl border cursor-grab transition ${
                        on
                          ? "bg-[#141518] text-white border-[#141518]"
                          : "bg-[#F7F8FA] hover:bg-[#EFF1F5] text-[#141518] border-black/[0.06]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{acc.name}</span>
                        <span className="text-xs font-semibold">${acc.price}</span>
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          on ? "text-white/70" : "text-[#686D76]"
                        }`}
                      >
                        {acc.color} • {on ? "Worn" : "Drag to wear"}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {filteredLooks.map((lk) => {
                  const active = lookIdx === lk.index;
                  return (
                    <div
                      key={lk.index}
                      onClick={() => void swapToLook(lk.index)}
                      onPointerDown={(e) =>
                        setDragGhost({
                          kind: "look",
                          label: lk.name,
                          price: 180,
                          lookIndex: lk.index,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }
                      className={`group relative h-32 rounded-2xl overflow-hidden border cursor-grab transition ${
                        active
                          ? "border-[#141518] ring-2 ring-[#141518]/20 bg-[#EAECEF]"
                          : "border-black/[0.08] bg-[#F4F5F7] hover:-translate-y-0.5"
                      }`}
                    >
                      <div
                        className="absolute inset-0 bg-top bg-cover transition-transform duration-300 group-hover:scale-105"
                        style={{
                          backgroundImage: `url("${H(lk.file, 360)}")`,
                        }}
                      />
                      <div className="absolute inset-x-1 bottom-1 px-1.5 py-0.5 rounded-lg bg-white/90 backdrop-blur-xs text-[10px] font-bold text-[#141518] truncate text-center">
                        {lk.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Imported Store Links (if user pasted links) */}
            {scrapedCommunityItems.length > 0 && category === "all" && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
                  Saved Store Links ({scrapedCommunityItems.length})
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {scrapedCommunityItems.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onPointerDown={(e) =>
                        setDragGhost({
                          kind: "scraped",
                          label: `${prod.brand} ${prod.title}`,
                          price: prod.price,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }
                      onClick={() => {
                        triggerScanLine();
                        showToast(`Tried on ${prod.brand} ${prod.title}`);
                      }}
                      className="shrink-0 px-3 py-2 rounded-xl bg-[#F7F8FA] hover:bg-[#EFF1F5] border border-black/[0.06] text-left cursor-grab"
                    >
                      <p className="text-[10px] font-bold text-[#686D76] uppercase">
                        {prod.brand} • ${prod.price}
                      </p>
                      <p className="text-xs font-semibold text-[#141518] max-w-[140px] truncate">
                        {prod.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ==================== CURRENTLY WORN PIECES (360° + ADD TO BAG) ==================== */}
          <div className="pt-3 border-t border-black/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#686D76]">
                In This Outfit ({currentPieces.length})
              </span>
              <span className="text-[11px] font-semibold text-[#244B3B]">
                Your Fit: Size S
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {currentPieces.map((piece) => {
                const alreadyInBag = bagItems.some(
                  (b) => b.title === piece.name
                );
                return (
                  <div
                    key={piece.name}
                    className="p-2.5 rounded-xl bg-[#F7F8FA] border border-black/[0.05] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#141518] truncate">
                        {piece.name}
                      </p>
                      <p className="text-[11px] text-[#686D76]">
                        {piece.color} • <strong>${piece.price}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        href={`/product?name=${encodeURIComponent(
                          piece.name
                        )}&price=${encodeURIComponent(`$${piece.price}`)}`}
                        title="Inspect 360° Fit & Details"
                        className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-black/[0.09] text-[#141518] hover:bg-[#EFF1F5] inline-flex items-center gap-1"
                      >
                        <Rotate3d className="w-3 h-3" /> 360°
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          addToBag({
                            title: piece.name,
                            brand: currentLook.friendOwner
                              ? `@${currentLook.friendOwner}'s Closet`
                              : "GWO Studio",
                            price: piece.price,
                            size: "S",
                            friendRef: friendRefCode,
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1 ${
                          alreadyInBag
                            ? "bg-[#244B3B] text-white"
                            : "bg-[#141518] text-white hover:bg-[#27292E]"
                        }`}
                      >
                        {alreadyInBag ? (
                          <>
                            <Check className="w-3 h-3" /> In Bag
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> Bag
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ==================== FLOATING DRAG PILL ==================== */}
      {dragGhost && (
        <div
          style={{
            position: "fixed",
            left: dragGhost.x + 14,
            top: dragGhost.y - 18,
            zIndex: 9999,
            pointerEvents: "none",
          }}
          className="px-3.5 py-2 rounded-2xl bg-[#141518] text-white shadow-2xl flex items-center gap-2 text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" />
          <span>
            {overAvatar
              ? `Drop to wear ${dragGhost.label}`
              : `${dragGhost.label} ($${dragGhost.price})`}
          </span>
        </div>
      )}
    </div>
  );
}
