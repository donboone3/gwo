"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Check,
  Columns2,
  Play,
  Rotate3d,
  Ruler,
  ShoppingBag,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import {
  analyzeExactAvatarFit,
  ZoneFeel,
} from "@/lib/catalog/fit-intelligence";
import { resolveLifelikeAvatarPhotos } from "@/lib/catalog/avatar-photo-resolver";
import { buildAiRunwayOutfits } from "@/lib/stylist/runway-ai-outfits";
import { buildSynthetic3DProductFromPiece } from "@/lib/catalog/closet-look-3d-mapper";
import { DEFAULT_AVATAR_MEASUREMENTS } from "@/lib/catalog/sizing";
import { Product } from "@/lib/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface Selectable360OutfitEntry {
  id: string;
  label: string;
  badge: string;
  sourceGroup: "runway" | "closet";
  thumbUrl: string;
  frontUrl: string;
  backUrl: string;
  sideUrl?: string;
  spinFrames: string[];
  pieces: Product[];
}

function buildContourPufferProduct(): Product {
  return {
    id: "studio-contour-puffer",
    canonicalUrl: "https://goodwithonline.com/product",
    brand: "GWO Studio",
    storeDomain: "goodwithonline.com",
    title: "Contour Metallic Cropped Puffer",
    category: "outerwear",
    silhouette: "cropped-jacket",
    colorName: "Metallic Silver",
    colorHex: "#C9CED6",
    accentHex: "#141518",
    price: 168,
    currency: "USD",
    imageUrl: `${BASE_PATH}/models/signature/spin_0.webp`,
    fitMetadata: {
      descriptionSummary:
        "Cropped metallic ripstop down puffer engineered to hit cleanly at your natural 27\" waist without overwhelming a 5'2\" petite frame.",
      fitNotes: [
        "19\" petite-calibrated crop hits right at high-rise denim",
        "Elasticated waist cinch seals warmth with zero bulk",
      ],
      fabricComposition: "100% Recycled Ripstop Nylon • 80/20 Down Fill",
      stretchLevel: "rigid",
      cutType: "regular",
      storeFitTendency: "true_to_size",
      hemLanding: "cropped",
      modelStats: {
        rawText: "5'2\" Avatar wearing Size S (32.25\" B • 27\" W • 34\" H)",
        heightInches: 62,
        heightDisplay: "5'2\"",
        wornSize: "S",
        bustInches: 32.25,
        waistInches: 27,
        hipsInches: 34,
      },
    },
    occasions: ["Everyday", "Outerwear"],
    vibes: ["Model Off-Duty"],
    availableSizes: ["XS", "S", "M", "L"],
    sizeChartInches: {
      XS: { bustMin: 30.5, bustMax: 31.8, waistMin: 24.0, waistMax: 25.5, hipsMin: 33.5, hipsMax: 35.0 },
      S: { bustMin: 32.0, bustMax: 34.5, waistMin: 26.0, waistMax: 28.0, hipsMin: 34.0, hipsMax: 36.5 },
      M: { bustMin: 34.5, bustMax: 37.0, waistMin: 28.0, waistMax: 30.5, hipsMin: 36.5, hipsMax: 39.0 },
      L: { bustMin: 37.0, bustMax: 40.0, waistMin: 30.5, waistMax: 33.5, hipsMin: 39.0, hipsMax: 42.0 },
    },
    estDeliveryDays: 5,
    inStock: true,
    sourceType: "affiliate_feed",
    lastScrapedAt: "",
    staleAfter: "",
  };
}

function getZoneToneClasses(feel: ZoneFeel): {
  card: string;
  bar: string;
  pill: string;
} {
  if (feel === "too_tight") {
    return {
      card: "bg-[#FDECEB] border-[#F5C6C2] text-[#9E2A22]",
      bar: "bg-[#D94336]",
      pill: "bg-[#D94336] text-white",
    };
  }
  if (feel === "sculpted_snug") {
    return {
      card: "bg-[#FEF6E6] border-[#F4DFB4] text-[#8A5808]",
      bar: "bg-[#D98A1C]",
      pill: "bg-[#FEF0D1] text-[#8A5808]",
    };
  }
  if (feel === "tailored_ideal") {
    return {
      card: "bg-[#F4F8F5] border-[#CBE2D4] text-[#1D4232]",
      bar: "bg-[#244B3B]",
      pill: "bg-[#244B3B] text-white",
    };
  }
  return {
    card: "bg-[#F4F6FA] border-[#D5DFEC] text-[#263445]",
    bar: "bg-[#355C7D]",
    pill: "bg-[#E3EAF4] text-[#263445]",
  };
}

export function GwoSpinProduct() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");

  const {
    user,
    products,
    purchasedItems,
    bagItems,
    socialDna,
    addToBag,
    openDropshipCheckout,
    updateProfilePatch,
    customAvatar,
  } = useGwo();

  const activeBust = user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches;
  const activeWaist = user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches;
  const activeHips = user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches;
  const activeHeight = user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches;

  const avatarStats = useMemo(
    () => ({
      bustInches: activeBust,
      waistInches: activeWaist,
      hipsInches: activeHips,
      heightInches: activeHeight,
      shoeSize: user?.shoeSize || "7.5",
    }),
    [activeBust, activeHeight, activeHips, activeWaist, user?.shoeSize]
  );

  // Build complete selectable 360° Outfits across Runway + Personal Closet!
  const all360Outfits: Selectable360OutfitEntry[] = useMemo(() => {
    const entries: Selectable360OutfitEntry[] = [];

    // 1. AI Runway Full Outfits (6 photorealistic Front & Back AliExpress outfits)
    const aiOutfits = buildAiRunwayOutfits({
      catalog: products,
      avatar: avatarStats,
      socialDna,
    });

    for (const ro of aiOutfits) {
      entries.push({
        id: ro.id,
        label: ro.title,
        badge: `Runway • $${ro.totalPriceUsd}`,
        sourceGroup: "runway",
        thumbUrl: ro.frontAvatarUrl,
        frontUrl: ro.frontAvatarUrl,
        backUrl: ro.backAvatarUrl,
        spinFrames: [
          ro.frontAvatarUrl,
          ro.backAvatarUrl,
        ],
        pieces: ro.pieces.map((p) => p.product),
      });
    }

    // 2. Signature 8-Angle Photorealistic Turntable Look
    const puffer = buildContourPufferProduct();
    const pufferPhotos = resolveLifelikeAvatarPhotos({ product: puffer });
    entries.push({
      id: "outfit-360-puffer",
      label: "Contour Metallic Puffer (8-Angle Spin)",
      badge: "8-Angle 360°",
      sourceGroup: "runway",
      thumbUrl: pufferPhotos.frontUrl,
      frontUrl: pufferPhotos.frontUrl,
      backUrl: pufferPhotos.backUrl,
      sideUrl: pufferPhotos.sideUrl,
      spinFrames: pufferPhotos.spinFrames,
      pieces: [puffer],
    });

    // 3. Customer's Personal Closet (Bought + In Cart) Outfits
    const seenLooks = new Set<string>();
    for (const b of purchasedItems) {
      const key = b.lookIndex !== undefined ? `look-${b.lookIndex}` : b.id;
      if (seenLooks.has(key)) continue;
      seenLooks.add(key);

      const matchedProd =
        (b.productId ? products.find((p) => p.id === b.productId) : undefined) ||
        buildSynthetic3DProductFromPiece({
          id: b.productId || b.id,
          name: b.title,
          brand: b.brand,
          price: b.price,
          imageUrl: b.imageUrl,
        });

      const resolved = resolveLifelikeAvatarPhotos({
        product: matchedProd,
        lookIndex: b.lookIndex,
        explicitFrontUrl: b.avatarFrontUrl,
        explicitBackUrl: b.avatarBackUrl,
      });

      entries.push({
        id: `closet-${key}`,
        label: b.title,
        badge: "My Closet",
        sourceGroup: "closet",
        thumbUrl: resolved.frontUrl,
        frontUrl: resolved.frontUrl,
        backUrl: resolved.backUrl,
        sideUrl: resolved.sideUrl,
        spinFrames: resolved.spinFrames,
        pieces: [matchedProd],
      });
    }

    for (const c of bagItems) {
      const matchedProd =
        (c.productId ? products.find((p) => p.id === c.productId) : undefined) ||
        buildSynthetic3DProductFromPiece({
          id: c.productId || c.id,
          name: c.title,
          brand: c.brand,
          price: c.price,
          imageUrl: c.imageUrl,
        });
      const resolved = resolveLifelikeAvatarPhotos({
        product: matchedProd,
        explicitFrontUrl: c.avatarFrontUrl,
        explicitBackUrl: c.avatarBackUrl,
      });
      entries.push({
        id: `cart-360-${c.id}`,
        label: c.title,
        badge: "In Cart",
        sourceGroup: "closet",
        thumbUrl: resolved.frontUrl,
        frontUrl: resolved.frontUrl,
        backUrl: resolved.backUrl,
        spinFrames: resolved.spinFrames,
        pieces: [matchedProd],
      });
    }

    return entries;
  }, [avatarStats, bagItems, products, purchasedItems, socialDna]);

  const [pickerGroup, setPickerGroup] = useState<"all" | "runway" | "closet">("all");
  const [selectedOutfitId, setSelectedOutfitId] = useState<string>("");
  const [selectedPieceIdx, setSelectedPieceIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"split" | "front" | "side" | "back" | "spin">("split");
  const [spinFrameIdx, setSpinFrameIdx] = useState<number>(0);
  const [autoSpinning, setAutoSpinning] = useState<boolean>(false);
  const dragStartXRef = useRef<number | null>(null);

  // Sync deep link ?id=prod-... if provided
  useEffect(() => {
    if (!queryId || all360Outfits.length === 0) return;
    const foundOutfit = all360Outfits.find((o) =>
      o.pieces.some((p) => p.id === queryId)
    );
    if (foundOutfit) {
      setSelectedOutfitId(foundOutfit.id);
      const pIdx = foundOutfit.pieces.findIndex((p) => p.id === queryId);
      setSelectedPieceIdx(Math.max(0, pIdx));
    }
  }, [all360Outfits, queryId]);

  const visiblePickerOutfits = useMemo(() => {
    if (pickerGroup === "all") return all360Outfits;
    return all360Outfits.filter((o) => o.sourceGroup === pickerGroup);
  }, [all360Outfits, pickerGroup]);

  const activeOutfit = useMemo(() => {
    return (
      all360Outfits.find((o) => o.id === selectedOutfitId) ||
      visiblePickerOutfits[0] ||
      all360Outfits[0]
    );
  }, [all360Outfits, selectedOutfitId, visiblePickerOutfits]);

  const activeProduct =
    activeOutfit?.pieces[selectedPieceIdx] || activeOutfit?.pieces[0] || buildContourPufferProduct();

  // Auto-spin timer for lifelike turnaround frames
  useEffect(() => {
    if (!autoSpinning || !activeOutfit) return;
    const id = window.setInterval(() => {
      setSpinFrameIdx((prev) => (prev + 1) % activeOutfit.spinFrames.length);
    }, 650);
    return () => window.clearInterval(id);
  }, [activeOutfit, autoSpinning]);

  const baseFitReport = useMemo(
    () => analyzeExactAvatarFit(avatarStats, activeProduct),
    [activeProduct, avatarStats]
  );

  const [selectedSize, setSelectedSize] = useState<string>(
    baseFitReport.recommendedSize
  );

  useEffect(() => {
    setSelectedSize(baseFitReport.recommendedSize);
  }, [baseFitReport.recommendedSize, activeProduct.id]);

  const liveFitReport = useMemo(
    () => analyzeExactAvatarFit(avatarStats, activeProduct, selectedSize),
    [activeProduct, avatarStats, selectedSize]
  );

  // Editable body measurements inline
  const [editingBody, setEditingBody] = useState(false);
  const [bustIn, setBustIn] = useState<number | null>(null);
  const [waistIn, setWaistIn] = useState<number | null>(null);
  const [hipsIn, setHipsIn] = useState<number | null>(null);
  const [heightIn, setHeightIn] = useState<number | null>(null);

  if (!activeOutfit) return null;

  const sizesToShow =
    activeProduct.availableSizes && activeProduct.availableSizes.length > 0
      ? activeProduct.availableSizes.slice(0, 5)
      : ["XS", "S", "M", "L"];

  const currentSingleFrameUrl =
    viewMode === "back"
      ? activeOutfit.backUrl
      : viewMode === "side"
      ? activeOutfit.sideUrl || activeOutfit.frontUrl
      : viewMode === "spin"
      ? activeOutfit.spinFrames[spinFrameIdx % activeOutfit.spinFrames.length]
      : activeOutfit.frontUrl;

  const totalOutfitPrice = activeOutfit.pieces.reduce((s, p) => s + p.price, 0);

  return (
    <div className="min-h-[calc(100svh-64px)] bg-[#F5F6F8] pb-14">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 pt-4 space-y-4">
        {/* ==================== 1. PICK WHICH OUTFIT TO LOOK AT IN 360° ==================== */}
        <section className="rounded-3xl bg-white border border-black/[0.07] shadow-[0_8px_24px_rgba(20,21,24,0.04)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[#141518]">
                360° Personal Try-On &amp; Exact Measurement Fit
              </h1>
              <p className="text-xs text-[#686D76]">
                Pick any Runway or Closet outfit below to inspect Front &amp; Back avatar photos, exact garment measurements, and which size to buy.
              </p>
            </div>

            <div className="inline-flex items-center p-1 rounded-full bg-[#F1F2F5] border border-black/[0.06]">
              {(
                [
                  { id: "all", label: "All Outfits" },
                  { id: "runway", label: "Runway Outfits" },
                  { id: "closet", label: "My Closet & Cart" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPickerGroup(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                    pickerGroup === tab.id
                      ? "bg-white text-[#141518] shadow-xs"
                      : "text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal Thumbnail Strip of Outfits */}
          <div
            id="gwo-360-outfit-picker-strip"
            className="flex items-center gap-2.5 overflow-x-auto pb-1"
          >
            {visiblePickerOutfits.map((entry) => {
              const isSelected = entry.id === activeOutfit.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setSelectedOutfitId(entry.id);
                    setSelectedPieceIdx(0);
                    setAutoSpinning(false);
                  }}
                  className={`shrink-0 w-44 p-2 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition ${
                    isSelected
                      ? "bg-[#EBF3EE] border-[#244B3B] shadow-xs"
                      : "bg-[#F8F9FB] hover:bg-[#F0F2F5] border-black/[0.06]"
                  }`}
                >
                  <img
                    src={entry.thumbUrl}
                    alt={entry.label}
                    className="w-11 h-14 rounded-xl object-cover object-top bg-white border border-black/[0.06] shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-[#244B3B] block truncate">
                      {entry.badge}
                    </span>
                    <span className="text-xs font-bold text-[#141518] line-clamp-2 leading-tight">
                      {entry.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ==================== 2. LIFELIKE 360° AVATAR STAGE + MEASUREMENT & SIZE ADVISOR ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
          {/* Left: Lifelike Studio Avatar Pictures Only (Front + Back, Front 0°, Back 180°, Drag/Auto 360° Spin) */}
          <section className="rounded-3xl bg-white border border-black/[0.07] shadow-[0_10px_28px_rgba(20,21,24,0.05)] p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-[#F1F2F5] border border-black/[0.06]">
                <button
                  type="button"
                  id="gwo-360-mode-split"
                  onClick={() => {
                    setAutoSpinning(false);
                    setViewMode("split");
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                    viewMode === "split"
                      ? "bg-white text-[#141518] shadow-xs"
                      : "text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  <Columns2 className="w-3.5 h-3.5" /> Front + Back
                </button>
                <button
                  type="button"
                  id="gwo-360-mode-front"
                  onClick={() => {
                    setAutoSpinning(false);
                    setViewMode("front");
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                    viewMode === "front"
                      ? "bg-white text-[#141518] shadow-xs"
                      : "text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  Front 0°
                </button>
                {activeOutfit.sideUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAutoSpinning(false);
                      setViewMode("side");
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                      viewMode === "side"
                        ? "bg-white text-[#141518] shadow-xs"
                        : "text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    Side 90°
                  </button>
                )}
                <button
                  type="button"
                  id="gwo-360-mode-back"
                  onClick={() => {
                    setAutoSpinning(false);
                    setViewMode("back");
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                    viewMode === "back"
                      ? "bg-white text-[#141518] shadow-xs"
                      : "text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  Back 180°
                </button>
                <button
                  type="button"
                  id="gwo-360-mode-spin"
                  onClick={() => {
                    setViewMode("spin");
                    setAutoSpinning((v) => !v);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                    viewMode === "spin"
                      ? "bg-[#244B3B] text-white"
                      : "text-[#1D4232] hover:bg-white"
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  {autoSpinning ? "Pause 360°" : "360° Spin"}
                </button>
              </div>

              <span className="px-3 py-1 rounded-full bg-[#E7F3EE] text-[#1D4232] text-xs font-bold">
                Buy Size {baseFitReport.recommendedSize} ({baseFitReport.confidencePct}% Fit)
              </span>
            </div>

            {/* Lifelike Avatar Photo Stage */}
            {viewMode === "split" ? (
              <div className="grid grid-cols-2 gap-3 h-[420px] sm:h-[500px]">
                <div className="rounded-2xl bg-[#FAFBFD] border border-black/[0.06] overflow-hidden flex flex-col">
                  <div className="py-1.5 px-3 bg-[#F1F2F5] text-[10.5px] font-bold uppercase tracking-wider text-[#5C6068] text-center">
                    Front Look (0°)
                  </div>
                  <div className="relative flex-1 min-h-0 flex items-center justify-center p-2">
                    <img
                      src={activeOutfit.frontUrl}
                      alt={`${activeOutfit.label} Front`}
                      className="gwo-fig-layer w-full h-full object-contain select-none pointer-events-none"
                    />
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FAFBFD] border border-black/[0.06] overflow-hidden flex flex-col">
                  <div className="py-1.5 px-3 bg-[#F1F2F5] text-[10.5px] font-bold uppercase tracking-wider text-[#5C6068] text-center">
                    Back Look (180°)
                  </div>
                  <div className="relative flex-1 min-h-0 flex items-center justify-center p-2">
                    <img
                      src={activeOutfit.backUrl}
                      alt={`${activeOutfit.label} Back`}
                      className="gwo-fig-layer w-full h-full object-contain select-none pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                onPointerDown={(e) => {
                  dragStartXRef.current = e.clientX;
                }}
                onPointerMove={(e) => {
                  if (dragStartXRef.current === null) return;
                  const dx = e.clientX - dragStartXRef.current;
                  if (Math.abs(dx) > 36) {
                    dragStartXRef.current = e.clientX;
                    setViewMode("spin");
                    setAutoSpinning(false);
                    setSpinFrameIdx(
                      (prev) =>
                        (prev + (dx > 0 ? 1 : -1) + activeOutfit.spinFrames.length) %
                        activeOutfit.spinFrames.length
                    );
                  }
                }}
                onPointerUp={() => {
                  dragStartXRef.current = null;
                }}
                className="relative h-[420px] sm:h-[500px] rounded-2xl bg-[#FAFBFD] border border-black/[0.06] flex items-center justify-center p-3 cursor-grab active:cursor-grabbing overflow-hidden"
              >
                <img
                  src={currentSingleFrameUrl}
                  alt={activeOutfit.label}
                  className="gwo-fig-layer w-full h-full object-contain select-none pointer-events-none"
                />
                {customAvatar && viewMode === "front" && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 border border-black/10 flex items-center gap-1.5 pointer-events-none">
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
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold pointer-events-none">
                  Drag left or right to rotate 360°
                </div>
              </div>
            )}

            {/* Quick Zone Status Strip Below Stage */}
            {liveFitReport.zones.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {liveFitReport.zones.map((z) => {
                  const tone = getZoneToneClasses(z.feel);
                  return (
                    <div
                      key={z.zone}
                      className={`px-3 py-2 rounded-2xl border text-xs flex items-center justify-between gap-2 ${tone.card}`}
                    >
                      <span className="font-bold">{z.zone}</span>
                      <span className="font-semibold truncate">{z.feelLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right: Exact Garment Measurements, Where It Fits vs Doesn't, & Size to Buy */}
          <section className="rounded-3xl bg-white border border-black/[0.07] shadow-[0_10px_28px_rgba(20,21,24,0.05)] p-4 sm:p-5 space-y-4">
            {/* Customer Body Measurements Bar */}
            <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#141518] inline-flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#244B3B]" />
                  Your Avatar: {Math.floor(activeHeight / 12)}&apos;
                  {Math.round(activeHeight % 12)}&quot; • {activeBust}&quot; B •{" "}
                  {activeWaist}&quot; W • {activeHips}&quot; H
                </span>
                <button
                  type="button"
                  onClick={() => setEditingBody((v) => !v)}
                  className="px-2.5 py-1 rounded-full bg-white border border-black/10 text-[11px] font-bold text-[#141518] cursor-pointer"
                >
                  {editingBody ? "Close" : "Adjust Body"}
                </button>
              </div>

              {editingBody && (
                <div className="space-y-2 pt-2 border-t border-black/[0.06]">
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
                      setEditingBody(false);
                    }}
                    className="w-full py-1.5 rounded-full bg-[#244B3B] text-white text-xs font-bold cursor-pointer"
                  >
                    Update Avatar Fit
                  </button>
                </div>
              )}
            </div>

            {/* Piece Selector if Outfit Has Multiple Pieces */}
            {activeOutfit.pieces.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
                  Inspect Individual Piece Measurements ({activeOutfit.pieces.length} Pieces)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeOutfit.pieces.map((p, idx) => {
                    const active = idx === selectedPieceIdx;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPieceIdx(idx)}
                        className={`p-2 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition ${
                          active
                            ? "bg-[#141518] text-white border-[#141518]"
                            : "bg-[#F8F9FB] hover:bg-[#EFEFF3] text-[#141518] border-black/[0.06]"
                        }`}
                      >
                        <div className="w-10 h-12 rounded-lg overflow-hidden bg-white shrink-0">
                          <GarmentArtwork product={p} className="w-full h-full" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{p.title}</p>
                          <p
                            className={`text-[11px] font-semibold ${
                              active ? "text-[#A7D7C5]" : "text-[#244B3B]"
                            }`}
                          >
                            ${p.price}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* What Size Should I Buy + Interactive Size Tester */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#141518]">
                    {activeProduct.title}
                  </h2>
                  <p className="text-xs text-[#686D76]">
                    {activeProduct.fitMetadata?.fabricComposition ||
                      activeProduct.brand}{" "}
                    • <strong className="text-[#141518]">${activeProduct.price}</strong>
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-[#E7F3EE] border border-[#B8DEC9] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1D4232]">
                  <Rotate3d className="w-4 h-4 shrink-0" />
                  <span>
                    AI Size Recommendation: Buy{" "}
                    <u className="font-extrabold">Size {baseFitReport.recommendedSize}</u>{" "}
                    ({baseFitReport.confidencePct}% Match)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#686D76]">
                  Tap any size to test how it fits on your body:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {sizesToShow.map((sz) => {
                    const isSelected = selectedSize === sz;
                    const isRec = baseFitReport.recommendedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`py-2.5 px-2 rounded-2xl text-xs font-bold border cursor-pointer transition ${
                          isSelected
                            ? "bg-[#141518] text-white border-[#141518] shadow-xs"
                            : "bg-[#F7F8FA] hover:bg-[#EAECEF] text-[#141518] border-black/10"
                        }`}
                      >
                        {sz}
                        {isRec ? " ★ Best" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detailed Where It Fits & Where It Doesn't Zone Breakdown */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
                Where Size {selectedSize} Fits &amp; Where It Doesn&apos;t
              </span>

              <div className="p-3 rounded-2xl bg-[#F8F9FB] border border-black/[0.07] text-xs text-[#141518] font-medium leading-relaxed">
                {liveFitReport.headlineVerdict}
              </div>

              {liveFitReport.zones.map((z) => {
                const tone = getZoneToneClasses(z.feel);
                const isTight = z.feel === "too_tight";
                const easeSign = z.easeInches >= 0 ? "+" : "";
                return (
                  <div
                    key={z.zone}
                    className={`p-3 rounded-2xl border space-y-1.5 ${tone.card}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-extrabold flex items-center gap-1.5">
                        {isTight ? (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {z.zone}: Your Body {z.avatarInches}&quot; vs Garment{" "}
                        {z.garmentRange} ({easeSign}
                        {z.easeInches.toFixed(1)}&quot;)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 ${tone.pill}`}
                      >
                        {z.feelLabel}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90 leading-snug">{z.detailNote}</p>
                  </div>
                );
              })}

              {/* Petite Height & Length Proportion Note */}
              <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] text-[11px] text-[#4E535B] space-y-0.5">
                <p className="font-bold text-[#141518]">
                  Length on Your {Math.floor(activeHeight / 12)}&apos;
                  {Math.round(activeHeight % 12)}&quot; Height:
                </p>
                <p>{liveFitReport.lengthComparison.proportionNote}</p>
              </div>
            </div>

            {/* Buy Single Piece or Full Outfit Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/[0.07]">
              <button
                type="button"
                id="gwo-360-buy-piece-btn"
                onClick={() => {
                  addToBag({
                    productId: activeProduct.id,
                    title: activeProduct.title,
                    brand: activeProduct.brand,
                    price: activeProduct.price,
                    size: selectedSize,
                    imageUrl: activeProduct.imageUrl,
                    avatarFrontUrl: activeOutfit.frontUrl,
                    avatarBackUrl: activeOutfit.backUrl,
                  });
                  openDropshipCheckout("checkout");
                }}
                className="flex-1 py-3 px-4 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#A7D7C5]" />
                Buy Size {selectedSize} (${activeProduct.price})
              </button>

              {activeOutfit.pieces.length > 1 && (
                <button
                  type="button"
                  id="gwo-360-buy-full-outfit-btn"
                  onClick={() => {
                    for (const p of activeOutfit.pieces) {
                      const pf = analyzeExactAvatarFit(avatarStats, p);
                      addToBag({
                        productId: p.id,
                        title: p.title,
                        brand: p.brand,
                        price: p.price,
                        size:
                          p.id === activeProduct.id
                            ? selectedSize
                            : pf.recommendedSize,
                        imageUrl: p.imageUrl,
                        avatarFrontUrl: activeOutfit.frontUrl,
                        avatarBackUrl: activeOutfit.backUrl,
                      });
                    }
                    openDropshipCheckout("checkout");
                  }}
                  className="py-3 px-4 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-xs font-bold cursor-pointer transition"
                >
                  Buy Full Outfit (${totalOutfitPrice})
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  addToBag({
                    productId: activeProduct.id,
                    title: activeProduct.title,
                    brand: activeProduct.brand,
                    price: activeProduct.price,
                    size: selectedSize,
                    imageUrl: activeProduct.imageUrl,
                    avatarFrontUrl: activeOutfit.frontUrl,
                    avatarBackUrl: activeOutfit.backUrl,
                  })
                }
                className="py-3 px-4 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EB] text-[#141518] text-xs font-bold cursor-pointer transition"
              >
                + Cart
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
