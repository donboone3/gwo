"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Rotate3d,
  Ruler,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { buildSynthetic3DProductFromPiece } from "@/lib/catalog/closet-look-3d-mapper";
import { DEFAULT_AVATAR_MEASUREMENTS, deriveStandardApparelSize } from "@/lib/catalog/sizing";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

type ClosetSourceFilter = "all" | "bought" | "cart" | "uploaded";

interface ClosetWearableSlotItem {
  id: string;
  title: string;
  subtitle: string;
  slot: "top" | "pants" | "full";
  source: "bought" | "cart" | "uploaded";
  price?: number;
  size: string;
  thumbUrl: string;
  avatarFrontUrl: string;
  avatarBackUrl: string;
  isUploadedPhoto?: boolean;
  productId?: string;
}

interface AiClosetComboIdea {
  id: string;
  title: string;
  reason: string;
  mode: "mix" | "full";
  topId?: string;
  pantsId?: string;
  fullId?: string;
}

function VellGwoStudioInner() {
  const searchParams = useSearchParams();
  const tryParam = searchParams.get("try");

  const {
    user,
    products,
    bagItems,
    purchasedItems,
    uploadedClosetPieces,
    addUploadedClosetPiece,
    removeUploadedClosetPiece,
    updateProfilePatch,
    openAvatar360,
    openDropshipCheckout,
    customAvatar,
  } = useGwo();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);

  const [sourceFilter, setSourceFilter] = useState<ClosetSourceFilter>("all");
  const [stageAngle, setStageAngle] = useState<"front" | "back">("front");
  const [editingFit, setEditingFit] = useState(false);

  // Upload My Clothes inline drawer
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<"top" | "pants" | "full">("top");
  const [uploadTitle, setUploadTitle] = useState("");

  // AI Recommendations panel
  const [aiIdeasOpen, setAiIdeasOpen] = useState(false);

  // Measurements
  const activeBust = user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches;
  const activeWaist = user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches;
  const activeHips = user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches;
  const activeHeight = user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches;
  const recSize = deriveStandardApparelSize({
    bustInches: activeBust,
    waistInches: activeWaist,
    hipsInches: activeHips,
  });

  const [bustIn, setBustIn] = useState<number | null>(null);
  const [waistIn, setWaistIn] = useState<number | null>(null);
  const [hipsIn, setHipsIn] = useState<number | null>(null);
  const [heightIn, setHeightIn] = useState<number | null>(null);

  // Build unified personal Closet items strictly from: Bought + In Cart + Uploaded Pictures!
  const allClosetItems: ClosetWearableSlotItem[] = useMemo(() => {
    const list: ClosetWearableSlotItem[] = [];

    // 1. Uploaded real-life closet photos first so user sees uploads right away
    for (const up of uploadedClosetPieces) {
      list.push({
        id: up.id,
        title: up.title,
        subtitle: "Uploaded from My Closet",
        slot: up.slot,
        source: "uploaded",
        size: recSize,
        thumbUrl: up.imageUrl,
        avatarFrontUrl: `${BASE_PATH}/models/signature/look_0.webp`,
        avatarBackUrl: `${BASE_PATH}/models/signature/look_0_back.webp`,
        isUploadedPhoto: true,
      });
    }

    // 2. In Cart / Applied to Cart items
    for (const bag of bagItems) {
      const slot: "top" | "pants" | "full" =
        bag.slot === "pants"
          ? "pants"
          : bag.slot === "full" || /dress|slip|gown/i.test(bag.title)
          ? "full"
          : /trouser|pant|skirt|jean|denim|cargo|legging/i.test(bag.title)
          ? "pants"
          : "top";

      const frontFallback =
        slot === "full"
          ? `${BASE_PATH}/models/runway_ai/ae_outfit_2_front.webp`
          : `${BASE_PATH}/models/runway_ai/ae_outfit_0_front.webp`;
      const backFallback =
        slot === "full"
          ? `${BASE_PATH}/models/runway_ai/ae_outfit_2_back.webp`
          : `${BASE_PATH}/models/runway_ai/ae_outfit_0_back.webp`;

      list.push({
        id: `cart-${bag.id}`,
        title: bag.title,
        subtitle: `In Cart • $${bag.price}`,
        slot,
        source: "cart",
        price: bag.price,
        size: bag.size || recSize,
        thumbUrl: bag.imageUrl || frontFallback,
        avatarFrontUrl: bag.avatarFrontUrl || frontFallback,
        avatarBackUrl: bag.avatarBackUrl || backFallback,
        productId: bag.productId,
      });
    }

    // 3. Bought / Already Owned items
    for (const b of purchasedItems) {
      if (b.slot === "shoes" || b.slot === "accessory") continue;
      const idx = b.lookIndex ?? 0;
      const frontFallback = `${BASE_PATH}/models/signature/look_${idx}.webp`;
      const backFallback = `${BASE_PATH}/models/signature/look_${idx}_back.webp`;
      list.push({
        id: b.id,
        title: b.title,
        subtitle: `Bought • Size ${b.size}`,
        slot: b.slot,
        source: "bought",
        price: b.price,
        size: b.size,
        thumbUrl: b.imageUrl || frontFallback,
        avatarFrontUrl: b.avatarFrontUrl || frontFallback,
        avatarBackUrl: b.avatarBackUrl || backFallback,
        productId: b.productId,
      });
    }

    return list;
  }, [bagItems, purchasedItems, recSize, uploadedClosetPieces]);

  const topsPool = useMemo(
    () => allClosetItems.filter((i) => i.slot === "top"),
    [allClosetItems]
  );
  const pantsPool = useMemo(
    () => allClosetItems.filter((i) => i.slot === "pants"),
    [allClosetItems]
  );
  const fullPool = useMemo(
    () => allClosetItems.filter((i) => i.slot === "full"),
    [allClosetItems]
  );

  // Active outfit mode: "mix" (Top + Pants swappable independently!) or "full" (1-piece dress/full look)
  const [wearMode, setWearMode] = useState<"mix" | "full">("mix");
  const [topIdx, setTopIdx] = useState(0);
  const [pantsIdx, setPantsIdx] = useState(0);
  const [fullIdx, setFullIdx] = useState(0);

  // Support ?try=prod-... deep link from Runway
  useEffect(() => {
    if (!tryParam) return;
    const matchFull = fullPool.findIndex((x) => x.productId === tryParam);
    if (matchFull >= 0) {
      setWearMode("full");
      setFullIdx(matchFull);
      return;
    }
    const matchTop = topsPool.findIndex((x) => x.productId === tryParam);
    if (matchTop >= 0) {
      setWearMode("mix");
      setTopIdx(matchTop);
      return;
    }
    const matchPants = pantsPool.findIndex((x) => x.productId === tryParam);
    if (matchPants >= 0) {
      setWearMode("mix");
      setPantsIdx(matchPants);
    }
  }, [fullPool, pantsPool, topsPool, tryParam]);

  const activeTop = topsPool[topIdx % Math.max(1, topsPool.length)] || null;
  const activePants = pantsPool[pantsIdx % Math.max(1, pantsPool.length)] || null;
  const activeFull = fullPool[fullIdx % Math.max(1, fullPool.length)] || null;

  // Build swipeable outfit deck across Closet combinations + Dresses so customer can swipe left/right!
  const swipeDeck = useMemo(() => {
    const deck: Array<
      | { kind: "mix"; tIdx: number; pIdx: number; label: string }
      | { kind: "full"; fIdx: number; label: string }
    > = [];
    const pairCount = Math.max(topsPool.length, pantsPool.length);
    for (let i = 0; i < pairCount; i++) {
      if (topsPool.length > 0 && pantsPool.length > 0) {
        const t = topsPool[i % topsPool.length];
        const p = pantsPool[i % pantsPool.length];
        deck.push({
          kind: "mix",
          tIdx: i % topsPool.length,
          pIdx: i % pantsPool.length,
          label: `${t.title} + ${p.title}`,
        });
      }
    }
    fullPool.forEach((f, idx) => {
      deck.push({ kind: "full", fIdx: idx, label: f.title });
    });
    return deck;
  }, [fullPool, pantsPool, topsPool]);

  const [deckCursor, setDeckCursor] = useState(0);

  const stepSwipeOutfit = (delta: number) => {
    if (swipeDeck.length === 0) return;
    const next = (deckCursor + delta + swipeDeck.length) % swipeDeck.length;
    setDeckCursor(next);
    const target = swipeDeck[next];
    if (target.kind === "mix") {
      setWearMode("mix");
      setTopIdx(target.tIdx);
      setPantsIdx(target.pIdx);
    } else {
      setWearMode("full");
      setFullIdx(target.fIdx);
    }
  };

  const cycleTop = (delta: number) => {
    if (topsPool.length === 0) return;
    setWearMode("mix");
    setTopIdx((prev) => (prev + delta + topsPool.length) % topsPool.length);
  };

  const cyclePants = (delta: number) => {
    if (pantsPool.length === 0) return;
    setWearMode("mix");
    setPantsIdx((prev) => (prev + delta + pantsPool.length) % pantsPool.length);
  };

  // AI Closet Recommendations built from her own Bought + Uploaded + Cart wardrobe!
  const aiClosetIdeas: AiClosetComboIdea[] = useMemo(() => {
    const ideas: AiClosetComboIdea[] = [];
    if (topsPool.length >= 1 && pantsPool.length >= 1) {
      const cartTop = topsPool.find((t) => t.source === "cart") || topsPool[0];
      const cartPants =
        pantsPool.find((p) => p.source === "cart") || pantsPool[0];
      ideas.push({
        id: "ai-idea-1",
        title: `${cartTop.title} + ${cartPants.title}`,
        reason: `Sculpts your ${activeWaist}" waist and elongates a 5'2" petite frame.`,
        mode: "mix",
        topId: cartTop.id,
        pantsId: cartPants.id,
      });
    }
    if (topsPool.length >= 2 && pantsPool.length >= 2) {
      const t2 = topsPool[1];
      const pLast = pantsPool[pantsPool.length - 1];
      ideas.push({
        id: "ai-idea-2",
        title: `${t2.title} + ${pLast.title}`,
        reason: "Effortless off-duty mix using pieces already in your closet.",
        mode: "mix",
        topId: t2.id,
        pantsId: pLast.id,
      });
    }
    if (fullPool.length >= 1) {
      ideas.push({
        id: "ai-idea-3",
        title: fullPool[0].title,
        reason: `One-piece statement look (${recSize} Exact Fit for ${activeBust}" B • ${activeWaist}" W).`,
        mode: "full",
        fullId: fullPool[0].id,
      });
    }
    return ideas;
  }, [activeBust, activeWaist, fullPool, pantsPool, recSize, topsPool]);

  const filteredClosetItems = useMemo(() => {
    if (sourceFilter === "all") return allClosetItems;
    return allClosetItems.filter((i) => i.source === sourceFilter);
  }, [allClosetItems, sourceFilter]);

  const handleUploadClosetFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fallbackName =
      uploadTitle.trim() ||
      file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") ||
      `My Uploaded ${uploadSlot === "top" ? "Top" : uploadSlot === "pants" ? "Pants" : "Outfit"}`;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl) return;
      addUploadedClosetPiece({
        title: fallbackName,
        slot: uploadSlot,
        imageUrl: dataUrl,
      });
      setUploadTitle("");
      setUploadOpen(false);
      if (uploadSlot === "top") {
        setWearMode("mix");
        setTopIdx(0);
      } else if (uploadSlot === "pants") {
        setWearMode("mix");
        setPantsIdx(0);
      } else {
        setWearMode("full");
        setFullIdx(0);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Determine exact lifelike avatar image URLs for current stage state
  const isSplitMixPhoto =
    wearMode === "mix" &&
    activeTop &&
    activePants &&
    activeTop.avatarFrontUrl !== activePants.avatarFrontUrl;

  const primaryFrontPhoto =
    wearMode === "full" && activeFull
      ? activeFull.avatarFrontUrl
      : activeTop?.avatarFrontUrl || `${BASE_PATH}/models/signature/look_0.webp`;

  const primaryBackPhoto =
    wearMode === "full" && activeFull
      ? activeFull.avatarBackUrl
      : activeTop?.avatarBackUrl || `${BASE_PATH}/models/signature/look_0_back.webp`;

  const lowerFrontPhoto =
    activePants?.avatarFrontUrl || `${BASE_PATH}/models/signature/look_0.webp`;
  const lowerBackPhoto =
    activePants?.avatarBackUrl || `${BASE_PATH}/models/signature/look_0_back.webp`;

  const openCurrentOutfitIn360 = () => {
    const heroItem = wearMode === "full" ? activeFull : activeTop;
    if (!heroItem) return;
    const matchedProd =
      (heroItem.productId
        ? products.find((p) => p.id === heroItem.productId)
        : undefined) ||
      buildSynthetic3DProductFromPiece({
        id: `closet-${heroItem.id}`,
        name: heroItem.title,
        brand: heroItem.subtitle,
        price: heroItem.price || 68,
        imageUrl: heroItem.thumbUrl,
      });

    openAvatar360({
      title:
        wearMode === "mix" && activeTop && activePants
          ? `${activeTop.title} + ${activePants.title}`
          : heroItem.title,
      primaryProduct: matchedProd,
      avatarFrontUrl: primaryFrontPhoto,
      avatarBackUrl: primaryBackPhoto,
      initialAngleMode: "split",
    });
  };

  return (
    <div className="min-h-[calc(100svh-64px)] bg-[#F5F6F8] pb-12">
      <div className="max-w-[1380px] mx-auto px-3 sm:px-6 pt-4 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        {/* ==================== LEFT: MY SIMPLE PERSONAL CLOSET (BOUGHT, IN CART, UPLOADED) ==================== */}
        <aside className="order-2 lg:order-1 rounded-3xl bg-white border border-black/[0.07] shadow-[0_8px_24px_rgba(20,21,24,0.04)] p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#141518]">
                My Closet
              </h1>
              <p className="text-xs text-[#686D76]">
                Bought items, Cart items &amp; uploaded clothes
              </p>
            </div>

            <button
              type="button"
              id="gwo-upload-closet-btn"
              onClick={() => setUploadOpen((v) => !v)}
              className="px-3 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition shrink-0"
            >
              <Camera className="w-3.5 h-3.5 text-[#A7D7C5]" />
              Upload Clothes
            </button>
          </div>

          {/* Compact Avatar Fit Bar */}
          <div className="p-2.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#141518] inline-flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-[#244B3B]" />
                {Math.floor(activeHeight / 12)}&apos;{Math.round(activeHeight % 12)}&quot; •{" "}
                {activeBust}&quot; • {activeWaist}&quot; • {activeHips}&quot;{" "}
                <strong className="text-[#244B3B]">(Size {recSize})</strong>
              </span>
              <button
                type="button"
                onClick={() => setEditingFit((v) => !v)}
                className="px-2.5 py-1 rounded-full bg-white border border-black/10 text-[11px] font-bold text-[#141518] cursor-pointer"
              >
                {editingFit ? "Close" : "Edit"}
              </button>
            </div>

            {editingFit && (
              <div className="space-y-2 pt-1 border-t border-black/[0.06]">
                <div className="grid grid-cols-4 gap-1.5">
                  <label className="text-[10px] font-bold text-[#686D76]">
                    Height (in)
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={activeHeight}
                      onChange={(e) => setHeightIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] font-bold text-[#686D76]">
                    Bust
                    <input
                      type="number"
                      step="0.25"
                      defaultValue={activeBust}
                      onChange={(e) => setBustIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] font-bold text-[#686D76]">
                    Waist
                    <input
                      type="number"
                      step="0.25"
                      defaultValue={activeWaist}
                      onChange={(e) => setWaistIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] font-bold text-[#686D76]">
                    Hips
                    <input
                      type="number"
                      step="0.25"
                      defaultValue={activeHips}
                      onChange={(e) => setHipsIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await updateProfilePatch({
                      heightInches: heightIn ?? activeHeight,
                      bustInches: bustIn ?? activeBust,
                      waistInches: waistIn ?? activeWaist,
                      hipsInches: hipsIn ?? activeHips,
                    });
                    setEditingFit(false);
                  }}
                  className="w-full py-1.5 rounded-full bg-[#244B3B] text-white text-xs font-bold cursor-pointer"
                >
                  Save Measurements
                </button>
              </div>
            )}
          </div>

          {/* Upload Own Clothes Drawer */}
          {uploadOpen && (
            <div className="p-3 rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1D4232]">
                  Upload Clothes You Already Own
                </span>
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  aria-label="Close Upload Drawer"
                  className="p-1 rounded-full hover:bg-black/5 text-[#5C6068] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "top", label: "Top" },
                    { id: "pants", label: "Pants / Skirt" },
                    { id: "full", label: "Dress / Full" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setUploadSlot(s.id)}
                    className={`py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      uploadSlot === s.id
                        ? "bg-[#141518] text-white border-[#141518]"
                        : "bg-white text-[#141518] border-black/10"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Item name (e.g. Favorite White Tank)..."
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-black/10 text-xs text-[#141518]"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadClosetFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Choose Photo from Phone / PC
              </button>
            </div>
          )}

          {/* 4 Simple Closet Filter Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-[#F1F2F5]">
            {(
              [
                { id: "all", label: `All (${allClosetItems.length})` },
                {
                  id: "bought",
                  label: `Bought (${
                    allClosetItems.filter((x) => x.source === "bought").length
                  })`,
                },
                {
                  id: "cart",
                  label: `Cart (${
                    allClosetItems.filter((x) => x.source === "cart").length
                  })`,
                },
                {
                  id: "uploaded",
                  label: `Mine (${uploadedClosetPieces.length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`py-1.5 px-1 rounded-full text-[11px] font-bold transition cursor-pointer truncate ${
                  sourceFilter === tab.id
                    ? "bg-white text-[#141518] shadow-xs"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Closet Items List */}
          <div className="space-y-2 max-h-[430px] overflow-y-auto pr-1">
            {filteredClosetItems.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs font-bold text-[#141518]">
                  No items in this filter yet
                </p>
                <p className="text-[11px] text-[#686D76]">
                  Upload a photo of your own clothes above or add pieces from the Runway!
                </p>
              </div>
            ) : (
              filteredClosetItems.map((item) => {
                const isEquipped =
                  (wearMode === "mix" &&
                    (activeTop?.id === item.id ||
                      activePants?.id === item.id)) ||
                  (wearMode === "full" && activeFull?.id === item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.slot === "top") {
                        setWearMode("mix");
                        const idx = topsPool.findIndex((x) => x.id === item.id);
                        if (idx >= 0) setTopIdx(idx);
                      } else if (item.slot === "pants") {
                        setWearMode("mix");
                        const idx = pantsPool.findIndex((x) => x.id === item.id);
                        if (idx >= 0) setPantsIdx(idx);
                      } else {
                        setWearMode("full");
                        const idx = fullPool.findIndex((x) => x.id === item.id);
                        if (idx >= 0) setFullIdx(idx);
                      }
                    }}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 cursor-pointer transition ${
                      isEquipped
                        ? "bg-[#EBF3EE] border-[#244B3B]/40"
                        : "bg-[#F8F9FB] hover:bg-[#F0F2F5] border-black/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={item.thumbUrl}
                        alt={item.title}
                        className="w-12 h-14 rounded-xl object-cover object-top bg-white border border-black/[0.06] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase ${
                              item.source === "cart"
                                ? "bg-[#FEF6E6] text-[#8A5808]"
                                : item.source === "uploaded"
                                ? "bg-[#FDEEF4] text-[#9D174D]"
                                : "bg-white text-[#244B3B]"
                            }`}
                          >
                            {item.slot}
                          </span>
                          {isEquipped && (
                            <span className="text-[10px] font-bold text-[#244B3B] inline-flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Wearing
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-[#141518] truncate mt-0.5">
                          {item.title}
                        </p>
                        <p className="text-[10.5px] text-[#686D76] truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    {item.source === "uploaded" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeUploadedClosetPiece(item.id);
                        }}
                        aria-label={`Remove ${item.title}`}
                        className="p-1.5 rounded-full hover:bg-black/10 text-[#686D76] cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {bagItems.length > 0 && (
            <button
              type="button"
              onClick={() => openDropshipCheckout("checkout")}
              className="w-full py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#A7D7C5]" />
              Buy Cart Items (${bagItems.reduce((s, b) => s + b.price, 0)})
            </button>
          )}
        </aside>

        {/* ==================== RIGHT: LIFELIKE AVATAR TRY-ON STAGE (SWIPE + CHANGE TOP / PANTS + ASK AI) ==================== */}
        <main className="order-1 lg:order-2 rounded-3xl bg-white border border-black/[0.07] shadow-[0_10px_28px_rgba(20,21,24,0.05)] p-4 sm:p-5 space-y-4">
          {/* Top Stage Bar: Front / Back / 360° + Ask AI Button */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center p-1 rounded-full bg-[#F1F2F5] border border-black/[0.06]">
              <button
                type="button"
                id="gwo-closet-angle-front"
                onClick={() => setStageAngle("front")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                  stageAngle === "front"
                    ? "bg-white text-[#141518] shadow-xs"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                Front Photo
              </button>
              <button
                type="button"
                id="gwo-closet-angle-back"
                onClick={() => setStageAngle("back")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                  stageAngle === "back"
                    ? "bg-white text-[#141518] shadow-xs"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                Back Photo (180°)
              </button>
              <button
                type="button"
                id="gwo-closet-open-360-btn"
                onClick={openCurrentOutfitIn360}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold text-[#1D4232] hover:bg-white inline-flex items-center gap-1 cursor-pointer transition"
              >
                <Rotate3d className="w-3.5 h-3.5 text-[#244B3B]" /> 360° Fit
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="gwo-closet-ask-ai-btn"
                onClick={() => setAiIdeasOpen((v) => !v)}
                className={`px-4 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                  aiIdeasOpen
                    ? "bg-[#244B3B] text-white"
                    : "bg-[#EBF3EE] hover:bg-[#DCECE3] text-[#1D4232] border border-[#C5DFD0]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Ask AI Outfit Ideas
              </button>

              <Link
                href="/shop"
                className="px-4 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold transition"
              >
                Shop Runway →
              </Link>
            </div>
          </div>

          {/* AI Recommendations Drawer (from her own Closet + Runway) */}
          {aiIdeasOpen && (
            <div className="p-3.5 rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1D4232] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Stylist Ideas from Your Closet &amp; Cart
                </span>
                <button
                  type="button"
                  onClick={() => setAiIdeasOpen(false)}
                  aria-label="Close AI Ideas"
                  className="p-1 rounded-full hover:bg-black/5 text-[#5C6068] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {aiClosetIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className="p-3 rounded-xl bg-white border border-black/[0.06] flex flex-col justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#141518] line-clamp-2">
                        {idea.title}
                      </p>
                      <p className="text-[11px] text-[#5C6068] mt-0.5 leading-snug">
                        {idea.reason}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (idea.mode === "mix") {
                          setWearMode("mix");
                          const ti = topsPool.findIndex((x) => x.id === idea.topId);
                          const pi = pantsPool.findIndex((x) => x.id === idea.pantsId);
                          if (ti >= 0) setTopIdx(ti);
                          if (pi >= 0) setPantsIdx(pi);
                        } else {
                          setWearMode("full");
                          const fi = fullPool.findIndex((x) => x.id === idea.fullId);
                          if (fi >= 0) setFullIdx(fi);
                        }
                      }}
                      className="w-full py-1.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold cursor-pointer"
                    >
                      Try This Combination
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lifelike Studio Avatar Stage (Dedicated Left/Right Swipe Buttons Outside Avatar Body = Zero Overlap!) */}
          <div
            onTouchStart={(e) => {
              swipeStartXRef.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const startX = swipeStartXRef.current;
              const endX = e.changedTouches[0]?.clientX ?? null;
              swipeStartXRef.current = null;
              if (startX !== null && endX !== null && Math.abs(endX - startX) > 36) {
                stepSwipeOutfit(endX < startX ? 1 : -1);
              }
            }}
            className="grid grid-cols-[44px_1fr_44px] sm:grid-cols-[56px_1fr_56px] items-center gap-2 rounded-3xl bg-gradient-to-b from-[#FAFBFD] to-[#F0F2F6] border border-black/[0.06] px-2 py-3 min-h-[460px] sm:min-h-[540px]"
          >
            <button
              type="button"
              id="gwo-closet-swipe-prev"
              onClick={() => stepSwipeOutfit(-1)}
              aria-label="Previous Outfit"
              className="w-10 h-10 sm:w-11 sm:h-11 mx-auto rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 shadow-xs flex items-center justify-center text-[#141518] cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Pure Unobstructed Lifelike Avatar Photo Frame */}
            <div className="relative h-[430px] sm:h-[510px] flex items-center justify-center overflow-hidden">
              {isSplitMixPhoto ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Lower Body (Pants / Skirt) Lifelike Avatar Photo */}
                  <img
                    src={stageAngle === "front" ? lowerFrontPhoto : lowerBackPhoto}
                    alt={activePants?.title || "Pants"}
                    className="gwo-fig-layer absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                  />
                  {/* Upper Body (Top) Lifelike Avatar Photo Seamlessly Feathered at Natural 27" Waist */}
                  <img
                    src={stageAngle === "front" ? primaryFrontPhoto : primaryBackPhoto}
                    alt={activeTop?.title || "Top"}
                    style={{
                      WebkitMaskImage:
                        "linear-gradient(to bottom, #000 0%, #000 41.5%, transparent 46%)",
                      maskImage:
                        "linear-gradient(to bottom, #000 0%, #000 41.5%, transparent 46%)",
                    }}
                    className="gwo-fig-layer absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                  />
                </div>
              ) : (
                <img
                  src={stageAngle === "front" ? primaryFrontPhoto : primaryBackPhoto}
                  alt="Your Lifelike Avatar Outfit"
                  className="gwo-fig-layer w-full h-full object-contain select-none pointer-events-none"
                />
              )}

              {/* Optional Custom Selfie Badge in Corner Only When Custom Selfie Uploaded */}
              {customAvatar && stageAngle === "front" && (
                <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-white/90 border border-black/10 flex items-center gap-1.5 pointer-events-none">
                  <img
                    src={customAvatar.badgeDataUrl}
                    alt="Your Face"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span className="text-[10px] font-bold text-[#141518]">
                    Your Avatar
                  </span>
                </div>
              )}

              {/* Uploaded Real-Life Garment Preview Card in Corner When Equipped */}
              {((wearMode === "mix" &&
                (activeTop?.isUploadedPhoto || activePants?.isUploadedPhoto)) ||
                (wearMode === "full" && activeFull?.isUploadedPhoto)) && (
                <div className="absolute bottom-2 right-2 p-2 rounded-2xl bg-white/95 border border-black/10 shadow-md flex items-center gap-2 pointer-events-none">
                  <img
                    src={
                      (wearMode === "full"
                        ? activeFull?.thumbUrl
                        : activeTop?.isUploadedPhoto
                        ? activeTop.thumbUrl
                        : activePants?.thumbUrl) || ""
                    }
                    alt="Uploaded Piece"
                    className="w-12 h-14 rounded-lg object-cover"
                  />
                  <div className="pr-1">
                    <p className="text-[10px] font-bold text-[#9D174D]">
                      Uploaded Piece
                    </p>
                    <p className="text-[11px] font-bold text-[#141518] max-w-[110px] truncate">
                      {wearMode === "full"
                        ? activeFull?.title
                        : activeTop?.isUploadedPhoto
                        ? activeTop.title
                        : activePants?.title}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              id="gwo-closet-swipe-next"
              onClick={() => stepSwipeOutfit(1)}
              aria-label="Next Outfit"
              className="w-10 h-10 sm:w-11 sm:h-11 mx-auto rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 shadow-xs flex items-center justify-center text-[#141518] cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Simple Independent Top & Pants Switcher Bar Below Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Change Top Control */}
            <div className="p-2.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] flex items-center justify-between gap-2">
              <button
                type="button"
                id="gwo-change-top-prev"
                onClick={() => cycleTop(-1)}
                aria-label="Previous Top"
                className="p-2 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[#141518] cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#686D76]">
                  Change Top
                </p>
                <p className="text-xs font-bold text-[#141518] truncate">
                  {wearMode === "full" && activeFull
                    ? `${activeFull.title} (Dress)`
                    : activeTop?.title || "Select Top"}
                </p>
              </div>
              <button
                type="button"
                id="gwo-change-top-next"
                onClick={() => cycleTop(1)}
                aria-label="Next Top"
                className="p-2 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[#141518] cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Change Pants / Skirt Control */}
            <div className="p-2.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] flex items-center justify-between gap-2">
              <button
                type="button"
                id="gwo-change-pants-prev"
                onClick={() => cyclePants(-1)}
                aria-label="Previous Pants"
                className="p-2 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[#141518] cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#686D76]">
                  Change Pants / Skirt
                </p>
                <p className="text-xs font-bold text-[#141518] truncate">
                  {wearMode === "full" && activeFull
                    ? "Tap ◀ or ▶ to switch to Pants"
                    : activePants?.title || "Select Pants"}
                </p>
              </div>
              <button
                type="button"
                id="gwo-change-pants-next"
                onClick={() => cyclePants(1)}
                aria-label="Next Pants"
                className="p-2 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[#141518] cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function VellGwoStudio() {
  return (
    <React.Suspense fallback={<div className="min-h-[calc(100svh-64px)] bg-[#F5F6F8]" />}>
      <VellGwoStudioInner />
    </React.Suspense>
  );
}
