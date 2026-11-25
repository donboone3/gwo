"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
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
  X,
  ZoomIn,
} from "lucide-react";
import {
  ACCESSORY_CATALOG,
  H,
  LOFT_BG_URL,
  SIGNATURE_BADGE_URL,
  STUDIO_LOOKS,
} from "./vell-data";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { useGwo } from "@/context/GwoAppContext";
import { Product } from "@/lib/types";

type SimpleCategory = "all" | "everyday" | "athletic" | "going-out" | "accessories";

interface DragPayload {
  kind: "look" | "accessory" | "scraped";
  label: string;
  price: number;
  lookIndex?: number;
  accessoryName?: string;
  product?: Product;
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
    activeImportedProduct,
    setActiveImportedProduct,
    customAvatar,
    setAvatarModalOpen,
    showToast,
  } = useGwo();

  const backdropRef = useRef<HTMLDivElement | null>(null);
  const figsRef = useRef<HTMLDivElement | null>(null);
  const scanRef = useRef<HTMLDivElement | null>(null);
  const modelBoxRef = useRef<HTMLDivElement | null>(null);
  const dragPillRef = useRef<HTMLDivElement | null>(null);
  const preloadedImgsRef = useRef<Array<HTMLImageElement | null>>([]);
  const swapTokenRef = useRef(0);
  const swipeStartXRef = useRef<number | null>(null);

  const [lookIdx, setLookIdx] = useState(0);
  const [closetOwner, setClosetOwner] = useState<string>("all");
  const [category, setCategory] = useState<SimpleCategory>("all");
  const [zoomed, setZoomed] = useState(false);
  const [equippedAccessories, setEquippedAccessories] = useState<string[]>([
    "Gold hoops",
  ]);
  const [editingFit, setEditingFit] = useState(false);
  const [copiedCloset, setCopiedCloset] = useState(false);

  const [dragItem, setDragItem] = useState<DragPayload | null>(null);
  const [overAvatar, setOverAvatar] = useState(false);
  const [drapeFlatLay, setDrapeFlatLay] = useState(false);

  useEffect(() => {
    setDrapeFlatLay(
      Boolean(
        activeImportedProduct?.imageUrl &&
          /flt|flat/i.test(activeImportedProduct.imageUrl)
      )
    );
  }, [activeImportedProduct]);

  // Measurement inputs
  const [waistIn, setWaistIn] = useState<number | null>(null);
  const [hipsIn, setHipsIn] = useState<number | null>(null);
  const [heightIn, setHeightIn] = useState<number | null>(null);

  // Fast first paint for Look 0, staggered idle preload for remaining looks (zero main-thread jank)
  useEffect(() => {
    const cache: Array<HTMLImageElement | null> = new Array(STUDIO_LOOKS.length).fill(null);
    preloadedImgsRef.current = cache;

    const first = new Image();
    first.decoding = "async";
    first.src = H(STUDIO_LOOKS[0].file, 900);
    cache[0] = first;

    if (figsRef.current) {
      figsRef.current.innerHTML = "";
      const base = document.createElement("div");
      base.className = "gwo-fig-layer";
      base.style.backgroundImage = `url("${H(STUDIO_LOOKS[0].file, 900)}")`;
      figsRef.current.appendChild(base);
    }

    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    STUDIO_LOOKS.slice(1).forEach((lk, i) => {
      const t = setTimeout(() => {
        if (cancelled) return;
        const im = new Image();
        im.decoding = "async";
        im.src = H(lk.file, 900);
        cache[i + 1] = im;
      }, 220 * (i + 1));
      timers.push(t);
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
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
      const normalized =
        ((idx % STUDIO_LOOKS.length) + STUDIO_LOOKS.length) % STUDIO_LOOKS.length;
      setLookIdx(normalized);
      const token = ++swapTokenRef.current;

      let preload = preloadedImgsRef.current[normalized];
      if (!preload) {
        preload = new Image();
        preload.decoding = "async";
        preload.src = H(STUDIO_LOOKS[normalized].file, 900);
        preloadedImgsRef.current[normalized] = preload;
      }
      try {
        await preload.decode();
      } catch {
        // Continue immediately
      }
      if (token !== swapTokenRef.current) return;

      const container = figsRef.current;
      if (!container) return;

      const nextLayer = document.createElement("div");
      nextLayer.className = "gwo-fig-layer wipe-in";
      nextLayer.style.backgroundImage = `url("${H(STUDIO_LOOKS[normalized].file, 900)}")`;
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

  // Keyboard ArrowLeft / ArrowRight
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

  // Zero-React-Rerender Pointer Parallax & Drag Pill Tracking (60/120fps DOM transform)
  useEffect(() => {
    let rafPending = false;
    let latestX = 0;
    let latestY = 0;

    const onMove = (e: PointerEvent) => {
      latestX = e.clientX;
      latestY = e.clientY;

      if (dragItem && dragPillRef.current) {
        dragPillRef.current.style.transform = `translate3d(${latestX + 14}px, ${
          latestY - 18
        }px, 0)`;
        const over = isOverModel(latestX, latestY);
        setOverAvatar((prev) => (prev === over ? prev : over));
      }

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (backdropRef.current) {
            const px = (latestX / window.innerWidth - 0.5) * -14;
            const py = (latestY / window.innerHeight - 0.5) * -7;
            backdropRef.current.style.transform = `translate3d(${px.toFixed(
              1
            )}px, ${py.toFixed(1)}px, 0) scale(1.03)`;
          }
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!dragItem) return;
      if (isOverModel(e.clientX, e.clientY)) {
        if (dragItem.kind === "look" && dragItem.lookIndex !== undefined) {
          void swapToLook(dragItem.lookIndex);
          showToast(`Trying on ${dragItem.label}`);
        } else if (dragItem.kind === "accessory" && dragItem.accessoryName) {
          const accName = dragItem.accessoryName;
          setEquippedAccessories((prev) =>
            prev.includes(accName) ? prev : [...prev, accName]
          );
          triggerScanLine();
          showToast(`Added ${accName} to your look`);
        } else if (dragItem.kind === "scraped") {
          if (dragItem.product) {
            setActiveImportedProduct(dragItem.product);
          }
          triggerScanLine();
          showToast(`Styled ${dragItem.label} onto your avatar`);
        }
      }
      setDragItem(null);
      setOverAvatar(false);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragItem, isOverModel, setActiveImportedProduct, showToast, swapToLook, triggerScanLine]);

  const startDrag = useCallback((e: React.PointerEvent, payload: DragPayload) => {
    setDragItem(payload);
    requestAnimationFrame(() => {
      if (dragPillRef.current) {
        dragPillRef.current.style.transform = `translate3d(${e.clientX + 14}px, ${
          e.clientY - 18
        }px, 0)`;
      }
    });
  }, []);

  const currentLook = STUDIO_LOOKS[lookIdx];

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
          background-size: 100% 100%;
          background-repeat: no-repeat;
          will-change: clip-path;
        }
        .gwo-fig-layer.wipe-in {
          clip-path: inset(0 0 100% 0);
          animation: gwoCleanWipe 0.72s cubic-bezier(0.65, 0, 0.25, 1) forwards;
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
          z-index: 25;
          background: linear-gradient(90deg, transparent, #ffffff 25%, #ffffff 75%, transparent);
          box-shadow: 0 0 18px 4px rgba(255, 255, 255, 0.7);
          will-change: top, opacity;
        }
        .gwo-scan-beam.active {
          animation: gwoBeamSweep 0.72s cubic-bezier(0.65, 0, 0.25, 1) forwards;
        }
        @keyframes gwoBeamSweep {
          0% { top: 0%; opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>

      {/* ==================== PHOTOREAL DAYLIGHT STUDIO BACKDROP ==================== */}
      <div
        ref={backdropRef}
        className="absolute inset-[-3%] bg-cover bg-center will-change-transform"
        style={{
          backgroundImage: `url("${LOFT_BG_URL}")`,
          transform: "translate3d(0, 0, 0) scale(1.03)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/18 pointer-events-none" />

      {/* ==================== RESPONSIVE 3-ZONE STUDIO GRID ==================== */}
      <div className="relative z-10 h-full max-w-[1520px] mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row items-stretch justify-between gap-4">
        {/* ==================== LEFT PANEL: MY PHOTO AVATAR, CLOSETS & FIT PROFILE ==================== */}
        <aside className="hidden lg:flex lg:w-[314px] shrink-0 flex-col justify-between rounded-3xl bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-5 overflow-y-auto">
          <div className="space-y-4">
            {/* Customer Photo Avatar Card */}
            <div className="p-3.5 rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={customAvatar ? customAvatar.badgeDataUrl : SIGNATURE_BADGE_URL}
                    alt="Your Avatar"
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#244B3B] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#141518] truncate">
                      Your 3D Studio Avatar ✓
                    </p>
                    <p className="text-[11px] text-[#4E5A54] leading-tight">
                      Active across Closet, Runway &amp; 360°
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                className="w-full py-2 rounded-full text-xs font-semibold bg-[#141518] hover:bg-[#27292E] text-white inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Camera className="w-3.5 h-3.5" />
                Upload Different Selfie
              </button>
            </div>

            {/* Step Context Header */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B]">
                Girls&apos; Shared Closets
              </p>
              <h1 className="text-base font-bold text-[#141518] mt-0.5">
                Choose a Closet to Try On
              </h1>
            </div>

            {/* 1-Tap Closet Switcher */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setClosetOwner("all")}
                className={`w-full p-2.5 rounded-2xl text-left transition flex items-center justify-between border cursor-pointer ${
                  closetOwner === "all"
                    ? "bg-[#141518] text-white border-[#141518]"
                    : "bg-[#F7F8FA] hover:bg-[#EFF1F5] text-[#141518] border-black/[0.05]"
                }`}
              >
                <div>
                  <p className="text-xs font-bold">All Shared Closets</p>
                  <p
                    className={`text-[11px] ${
                      closetOwner === "all" ? "text-white/75" : "text-[#686D76]"
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
                { handle: "maya", name: "Maya", twin: 97, stats: '5\'5" • 26.5" Waist' },
                { handle: "chloe", name: "Chloe", twin: 86, stats: '5\'7" • 27.5" Waist' },
                { handle: "sofia", name: "Sofia", twin: 88, stats: '5\'3" • 25.5" Waist' },
              ].map((f) => {
                const active = closetOwner === f.handle;
                const matchedFriend = friends.find((x) => x.username === f.handle);
                return (
                  <button
                    key={f.handle}
                    type="button"
                    onClick={() => {
                      setClosetOwner(f.handle);
                      const firstMatch = STUDIO_LOOKS.find(
                        (l) => l.friendOwner === f.handle
                      );
                      if (firstMatch) void swapToLook(firstMatch.index);
                    }}
                    className={`w-full p-2.5 rounded-2xl text-left transition flex items-center justify-between border cursor-pointer ${
                      active
                        ? "bg-[#141518] text-white border-[#141518]"
                        : "bg-[#F7F8FA] hover:bg-[#EFF1F5] text-[#141518] border-black/[0.05]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        @{f.handle} ({matchedFriend?.displayName || f.name})
                      </p>
                      <p
                        className={`text-[11px] ${
                          active ? "text-white/75" : "text-[#686D76]"
                        }`}
                      >
                        {f.stats}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        active
                          ? "bg-[#244B3B] text-[#C8F0DF]"
                          : "bg-[#E7F3EE] text-[#244B3B]"
                      }`}
                    >
                      <HeartHandshake className="w-3 h-3" /> {f.twin}% Twin
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Simple Fit Profile Measurements */}
            <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#686D76]" /> Your Fit Profile
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
                  {Math.floor((user?.heightInches || 65) / 12)}&apos;
                  {Math.round((user?.heightInches || 65) % 12)}&quot; •{" "}
                  {user?.waistInches ?? 26.5}&quot; Waist •{" "}
                  {user?.hipsInches ?? 37}&quot; Hips • Shoe {user?.shoeSize || "7.5"}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <label className="text-[10px] text-[#686D76] font-semibold">
                    Height (in)
                    <input
                      type="number"
                      defaultValue={user?.heightInches || 65}
                      onChange={(e) => setHeightIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] text-[#686D76] font-semibold">
                    Waist (in)
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={user?.waistInches || 26.5}
                      onChange={(e) => setWaistIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] text-[#686D76] font-semibold">
                    Hips (in)
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={user?.hipsInches || 37}
                      onChange={(e) => setHipsIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
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
                    className="col-span-3 py-1.5 rounded-xl bg-[#141518] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Fit Measurements
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
            className="w-full py-2.5 px-4 rounded-2xl bg-[#EEF5F1] hover:bg-[#E2EFE8] text-[#1D4232] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer mt-2"
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
        <div className="relative flex-1 flex flex-col items-center justify-between min-h-[340px]">
          {/* Subtle Top Look Pill */}
          <div className="px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-black/[0.07] shadow-xs flex items-center gap-2 text-xs">
            {customAvatar && (
              <img
                src={customAvatar.badgeDataUrl}
                alt="You"
                className="w-4 h-4 rounded-full object-cover"
              />
            )}
            <span className="font-bold text-[#141518]">{currentLook.name}</span>
            {currentLook.friendOwner && (
              <span className="text-[#244B3B] font-semibold">
                • {customAvatar ? "On You" : `From @${currentLook.friendOwner}'s Closet`} ({currentLook.friendTwinPct}% Twin)
              </span>
            )}
          </div>

          {/* Interactive Avatar Frame (Exact 1360:2048 Aspect Box so Customer Face Locks Pixel-for-Pixel!) */}
          <div
            ref={modelBoxRef}
            onPointerDown={(e) => {
              swipeStartXRef.current = e.clientX;
            }}
            onPointerUp={(e) => {
              if (swipeStartXRef.current === null) return;
              const dx = e.clientX - swipeStartXRef.current;
              swipeStartXRef.current = null;
              if (Math.abs(dx) > 40 && !dragItem) {
                void swapToLook(lookIdx + (dx < 0 ? 1 : -1));
              }
            }}
            className={`relative flex-1 min-h-0 my-2 flex items-end justify-center cursor-grab active:cursor-grabbing transition-transform duration-500 will-change-transform ${
              zoomed ? "scale-[1.42] translate-y-28" : "scale-100"
            }`}
          >
            <div className="relative h-full aspect-[1360/2048]">
              {/* Drop Halo when dragging an item onto avatar */}
              {overAvatar && (
                <div className="absolute inset-x-2 inset-y-2 rounded-3xl border-2 border-dashed border-white bg-white/20 z-30 flex items-start justify-center pt-4 pointer-events-none">
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
                }}
              />

              {/* Stacked Outfit Cutout Layers */}
              <div ref={figsRef} className="absolute inset-0 pointer-events-none" />

              {/* Live Imported URL Garment Draped on Avatar Torso/Legs when Flat-Lay Mode Active */}
              {activeImportedProduct?.imageUrl && drapeFlatLay && (
                <img
                  src={activeImportedProduct.imageUrl}
                  alt={activeImportedProduct.title}
                  style={{
                    left: "50%",
                    top:
                      activeImportedProduct.category === "bottom"
                        ? "58%"
                        : activeImportedProduct.category === "dress"
                        ? "46%"
                        : activeImportedProduct.category === "shoes"
                        ? "88%"
                        : "34%",
                    width:
                      activeImportedProduct.category === "shoes"
                        ? "32%"
                        : activeImportedProduct.category === "dress"
                        ? "48%"
                        : "44%",
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-multiply pointer-events-none z-14"
                />
              )}

              {/* Customer Uploaded Photo Avatar Face Overlay (Exact 1360x2048 Head Coordinates) */}
              {customAvatar && (
                <img
                  src={customAvatar.faceOvalDataUrl}
                  alt="Your uploaded avatar face"
                  decoding="async"
                  style={{
                    left: "49.95%",
                    top: "13.2%",
                    width: "12.9%",
                    height: "9.7%",
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 object-fill pointer-events-none z-15"
                />
              )}

              <div ref={scanRef} className="gwo-scan-beam" />
            </div>

            {/* Floating Imported Store Clothing Card Right Beside Avatar Stage */}
            {activeImportedProduct && (
              <div
                id="gwo-stage-imported-card"
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute right-2 sm:right-4 top-10 z-25 w-40 sm:w-44 rounded-2xl bg-white/95 backdrop-blur-md border border-black/[0.09] shadow-xl p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#244B3B] truncate">
                    {activeImportedProduct.brand}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveImportedProduct(null)}
                    className="p-1 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
                    title="Clear imported store piece"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="w-full h-36 rounded-xl overflow-hidden bg-[#F6F7F9] border border-black/[0.05]">
                  <GarmentArtwork
                    product={activeImportedProduct}
                    className="w-full h-full"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-bold text-[#141518] line-clamp-2 leading-tight">
                    {activeImportedProduct.title}
                  </p>
                  <p className="text-[11px] font-semibold text-[#686D76] mt-0.5">
                    ${activeImportedProduct.price} • Size S
                  </p>
                </div>

                {activeImportedProduct.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setDrapeFlatLay((v) => !v)}
                    className="w-full py-1.5 rounded-full text-[10px] font-bold bg-[#F1F2F5] hover:bg-[#E4E7EC] text-[#141518] cursor-pointer transition"
                  >
                    {drapeFlatLay ? "Hide On-Body Overlay" : "Overlay on Avatar"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Clean Minimal Bottom Stage Controls */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-lg z-20">
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
        <aside className="w-full lg:w-[390px] shrink-0 rounded-3xl bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-5 flex flex-col justify-between gap-4 overflow-y-auto max-h-[42vh] lg:max-h-none">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#141518]">
                  Wardrobe &amp; Accessories
                </h2>
                <p className="text-xs text-[#686D76]">
                  Tap or drag any piece onto {customAvatar ? "yourself" : "your avatar"}
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

            {/* Clean Visual Look / Accessory Grid (Every Thumbnail Also Shows Customer's Uploaded Face!) */}
            {category === "accessories" ? (
              <div className="grid grid-cols-2 gap-2.5">
                {ACCESSORY_CATALOG.map((acc) => {
                  const on = equippedAccessories.includes(acc.name);
                  return (
                    <div
                      key={acc.id}
                      onPointerDown={(e) =>
                        startDrag(e, {
                          kind: "accessory",
                          label: acc.name,
                          price: acc.price,
                          accessoryName: acc.name,
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
                        startDrag(e, {
                          kind: "look",
                          label: lk.name,
                          price: 180,
                          lookIndex: lk.index,
                        })
                      }
                      className={`group relative h-32 rounded-2xl overflow-hidden border cursor-grab transition ${
                        active
                          ? "border-[#141518] ring-2 ring-[#141518]/20 bg-[#EAECEF]"
                          : "border-black/[0.08] bg-[#F4F5F7] hover:-translate-y-0.5"
                      }`}
                    >
                      {/* Exact 1360:2048 miniature cutout + customer face overlay so ALL 8 thumbnails are YOU */}
                      <div className="absolute inset-x-0 top-0 flex justify-center pointer-events-none transition-transform duration-300 group-hover:scale-105">
                        <div className="relative w-[88px] aspect-[1360/2048]">
                          <img
                            src={H(lk.file, 260, 78)}
                            alt={lk.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain"
                          />
                          {customAvatar && (
                            <img
                              src={customAvatar.faceOvalDataUrl}
                              alt=""
                              decoding="async"
                              style={{
                                left: "49.95%",
                                top: "13.2%",
                                width: "12.9%",
                                height: "9.7%",
                              }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 object-fill"
                            />
                          )}
                        </div>
                      </div>
                      <div className="absolute inset-x-1 bottom-1 px-1.5 py-0.5 rounded-lg bg-white/92 text-[10px] font-bold text-[#141518] truncate text-center">
                        {lk.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Imported Store Links (Visual Clothing Image Cards!) */}
            {scrapedCommunityItems.length > 0 && category === "all" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
                    Saved Store Links ({scrapedCommunityItems.length})
                  </p>
                  <span className="text-[10px] text-[#244B3B] font-semibold">
                    Tap to wear
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {scrapedCommunityItems.slice(0, 3).map((prod) => {
                    const isWornUrl = activeImportedProduct?.id === prod.id;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onPointerDown={(e) =>
                          startDrag(e, {
                            kind: "scraped",
                            label: `${prod.brand} ${prod.title}`,
                            price: prod.price,
                            product: prod,
                          })
                        }
                        onClick={() => {
                          setActiveImportedProduct(
                            isWornUrl ? null : prod
                          );
                          triggerScanLine();
                          showToast(
                            isWornUrl
                              ? `Removed ${prod.title}`
                              : `Trying on ${prod.brand} ${prod.title}`
                          );
                        }}
                        className={`group rounded-2xl overflow-hidden border text-left cursor-grab transition bg-white ${
                          isWornUrl
                            ? "border-[#141518] ring-2 ring-[#141518]/20"
                            : "border-black/[0.08] hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="relative h-20 w-full bg-[#F6F7F9] overflow-hidden">
                          <GarmentArtwork
                            product={prod}
                            className="w-full h-full"
                          />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-white/92 text-[10px] font-bold text-[#141518]">
                            ${prod.price}
                          </span>
                        </div>
                        <div className="p-1.5">
                          <p className="text-[9px] font-bold text-[#686D76] uppercase truncate">
                            {prod.brand}
                          </p>
                          <p className="text-[11px] font-semibold text-[#141518] truncate">
                            {prod.title}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ==================== CURRENTLY WORN PIECES ==================== */}
          <div className="pt-3 border-t border-black/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#686D76]">
                In This Outfit ({currentPieces.length})
              </span>
              <span className="text-[11px] font-semibold text-[#244B3B]">
                Your Fit: Size S
              </span>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
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

      {/* ==================== ZERO-LAG FLOATING DRAG PILL ==================== */}
      {dragItem && (
        <div
          ref={dragPillRef}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            zIndex: 9999,
            pointerEvents: "none",
            willChange: "transform",
          }}
          className="px-3.5 py-2 rounded-2xl bg-[#141518] text-white shadow-2xl flex items-center gap-2 text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" />
          <span>
            {overAvatar
              ? `Drop to wear ${dragItem.label}`
              : `${dragItem.label} ($${dragItem.price})`}
          </span>
        </div>
      )}
    </div>
  );
}
