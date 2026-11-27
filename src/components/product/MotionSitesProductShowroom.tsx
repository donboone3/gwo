"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Flame,
  Layers,
  Rotate3d,
  Ruler,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  SunMedium,
  User,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { Interactive3DAvatarStage } from "../three/Interactive3DAvatarStage";
import { Worn3DPieceSpec } from "@/lib/three/parametric-3d-engine";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import {
  deriveFullBodyDimensionsFromProfile,
  formatHeightFeetInches,
} from "@/lib/three/body-scan-analyzer";
import {
  ImmersiveLightingPresetId,
  MASTER_IMMERSIVE_LIGHTING_PRESETS,
  MASTER_LIGHTING_PRESET_ORDER,
  certifyClothingItemRealism,
} from "@/lib/realism/master-avatar-clothing-realism";
import {
  CURATED_100_OUTFIT_DESIGNS,
  getCuratedOutfitsForProduct,
} from "@/lib/stylist/curated-100-outfits";
import { routeProductTo360Tier } from "@/lib/higgsfield/credit-smart-360-pipeline";
import { Product } from "@/lib/types";

interface MotionSitesProductShowroomProps {
  productId: string;
}

function fmtUnit(inches: number | undefined, unit: "in" | "cm"): string {
  if (inches === undefined || Number.isNaN(inches)) return "—";
  if (unit === "cm") return `${(inches * 2.54).toFixed(1)} cm`;
  return `${Number(inches.toFixed(2))}"`;
}

function fmtRangeUnit(
  minIn: number | undefined,
  maxIn: number | undefined,
  unit: "in" | "cm"
): string {
  if (minIn === undefined || maxIn === undefined) return "—";
  if (unit === "cm") {
    return `${(minIn * 2.54).toFixed(0)}–${(maxIn * 2.54).toFixed(0)} cm`;
  }
  return `${minIn}"–${maxIn}"`;
}

export function MotionSitesProductShowroom({
  productId,
}: MotionSitesProductShowroomProps) {
  const {
    user,
    products,
    customAvatar,
    addToBag,
    openDropshipCheckout,
    setAvatarModalOpen,
    showToast,
  } = useGwo();

  const fullCatalog = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of buildTopLineAliExpressDropshipCatalog()) {
      map.set(p.id, p);
    }
    for (const p of products) {
      map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [products]);

  const byId = useMemo(
    () => new Map(fullCatalog.map((p) => [p.id, p])),
    [fullCatalog]
  );

  const productIndex = useMemo(() => {
    const idx = fullCatalog.findIndex((p) => p.id === productId);
    return idx >= 0 ? idx : 0;
  }, [fullCatalog, productId]);

  const product = fullCatalog[productIndex] || fullCatalog[0];
  const prevProduct =
    fullCatalog[(productIndex - 1 + fullCatalog.length) % fullCatalog.length];
  const nextProduct = fullCatalog[(productIndex + 1) % fullCatalog.length];

  const bodyDims = useMemo(
    () => deriveFullBodyDimensionsFromProfile(user, customAvatar),
    [customAvatar, user]
  );

  // Scroll-linked hairline progress indicator (MotionSites `luxury-focus` choreography)
  const [scrollPct, setScrollPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      setScrollPct(Math.min(1, Math.max(0, window.scrollY / maxScroll)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Stage & Fit Inspection State
  const [stageView, setStageView] = useState<
    "avatar_3d" | "garment_3d" | "studio_cutout"
  >("avatar_3d");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showRings, setShowRings] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [yawOverride, setYawOverride] = useState<number | undefined>(undefined);
  const [yawSeq, setYawSeq] = useState(0);
  const [lightingId, setLightingId] =
    useState<ImmersiveLightingPresetId>("editorial_daylight");
  const [previewOutfitKey, setPreviewOutfitKey] = useState<string | null>(null);

  // Reset per-SKU overrides when navigating between product pages
  useEffect(() => {
    setSelectedSize("");
    setPreviewOutfitKey(null);
    setYawOverride(undefined);
  }, [product?.id]);

  const baseFit = useMemo(
    () =>
      analyzeExactAvatarFit(
        {
          heightInches: bodyDims.heightInches,
          shoulderInches: bodyDims.shoulderInches,
          bustInches: bodyDims.bustInches,
          waistInches: bodyDims.waistInches,
          hipsInches: bodyDims.hipsInches,
          shoeSize: bodyDims.shoeSize,
        },
        product
      ),
    [bodyDims, product]
  );

  const activeSize = selectedSize || baseFit.recommendedSize;

  const fitReport = useMemo(
    () =>
      analyzeExactAvatarFit(
        {
          heightInches: bodyDims.heightInches,
          shoulderInches: bodyDims.shoulderInches,
          bustInches: bodyDims.bustInches,
          waistInches: bodyDims.waistInches,
          hipsInches: bodyDims.hipsInches,
          shoeSize: bodyDims.shoeSize,
        },
        product,
        activeSize
      ),
    [activeSize, bodyDims, product]
  );

  const realismCert = useMemo(
    () => certifyClothingItemRealism(product, bodyDims, activeSize),
    [activeSize, bodyDims, product]
  );

  const tierDecision = useMemo(
    () => routeProductTo360Tier(product),
    [product]
  );

  // Outfits from our 100-Outfit Collection featuring this product
  const featuredOutfits = useMemo(() => {
    const direct = getCuratedOutfitsForProduct(product.id);
    if (direct.length > 0) return direct;
    return CURATED_100_OUTFIT_DESIGNS.slice(0, 4);
  }, [product.id]);

  const activePreviewOutfit = useMemo(
    () =>
      previewOutfitKey
        ? featuredOutfits.find((o) => o.key === previewOutfitKey) || null
        : null,
    [featuredOutfits, previewOutfitKey]
  );

  const wornSpecsOnAvatar: Worn3DPieceSpec[] = useMemo(() => {
    if (activePreviewOutfit) {
      return activePreviewOutfit.productIds
        .map((pid) => byId.get(pid))
        .filter((p): p is Product => Boolean(p))
        .map((p) => {
          if (p.id === product.id) {
            return { product: p, selectedSize: activeSize };
          }
          const cFit = analyzeExactAvatarFit(
            {
              heightInches: bodyDims.heightInches,
              bustInches: bodyDims.bustInches,
              waistInches: bodyDims.waistInches,
              hipsInches: bodyDims.hipsInches,
              shoeSize: bodyDims.shoeSize,
            },
            p
          );
          return { product: p, selectedSize: cFit.recommendedSize };
        });
    }
    return [{ product, selectedSize: activeSize }];
  }, [activePreviewOutfit, activeSize, bodyDims, byId, product]);

  const companionRecommendations = useMemo(() => {
    const companionIds = new Set<string>();
    for (const o of featuredOutfits) {
      for (const pid of o.productIds) {
        if (pid !== product.id) companionIds.add(pid);
      }
    }
    const list = Array.from(companionIds)
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p));
    if (list.length >= 6) return list.slice(0, 8);
    for (const p of fullCatalog) {
      if (p.id !== product.id && !companionIds.has(p.id)) {
        list.push(p);
        if (list.length >= 8) break;
      }
    }
    return list;
  }, [byId, featuredOutfits, fullCatalog, product.id]);

  const sizeKeys = useMemo(() => {
    const chartKeys = Object.keys(product.sizeChartInches || {});
    if (chartKeys.length > 0) return chartKeys;
    return product.availableSizes.length > 0 ? product.availableSizes : ["S"];
  }, [product]);

  const isShoe = product.category === "shoes";
  const isBag =
    product.category === "accessory" && !/belt|cincher/i.test(product.title);
  const isBelt =
    product.category === "accessory" && /belt|cincher/i.test(product.title);

  const handleAddSingle = (buyImmediately: boolean) => {
    addToBag({
      productId: product.id,
      title: product.title,
      brand: product.brand,
      price: product.price,
      size: activeSize,
      imageUrl: product.imageUrl,
      storeUrl: product.canonicalUrl,
    });
    if (buyImmediately) {
      openDropshipCheckout("checkout");
    } else {
      showToast(`Added ${product.title} (Size ${activeSize}) to Bag!`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#141518] pb-20">
      {/* MotionSites Scroll-Linked Top Hairline Progress Bar */}
      <div className="fixed top-0 inset-x-0 h-[2.5px] z-[120] bg-black/[0.06] pointer-events-none">
        <div
          className="h-full bg-[#244B3B] origin-left transition-transform duration-75"
          style={{ transform: `scaleX(${scrollPct.toFixed(4)})` }}
        />
      </div>

      {/* Editorial Atelier Top Navigation Strip */}
      <div className="sticky top-16 z-40 bg-[#FAF9F6]/92 backdrop-blur-md border-b border-black/[0.07]">
        <div className="max-w-[1460px] mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 font-bold text-[#141518] hover:text-[#244B3B] shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Runway
            </Link>
            <span className="text-black/25">/</span>
            <Link
              href="/"
              className="font-semibold text-[#5E636E] hover:text-[#141518] shrink-0 hidden sm:inline"
            >
              3D Closet
            </Link>
            <span className="text-black/25 hidden sm:inline">/</span>
            <span className="font-semibold text-[#244B3B] truncate">
              {product.title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[10.5px] font-bold">
              <ShieldCheck className="w-3 h-3" /> SKU #{productIndex + 1}/
              {fullCatalog.length} • 360° 3D Certified
            </span>
            {prevProduct && (
              <Link
                href={`/product/${encodeURIComponent(prevProduct.id)}`}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-[#F1F2F5] border border-black/[0.08] font-bold text-[11px] inline-flex items-center gap-1"
                title={`Previous: ${prevProduct.title}`}
              >
                <ArrowLeft className="w-3 h-3" /> Prev
              </Link>
            )}
            {nextProduct && (
              <Link
                href={`/product/${encodeURIComponent(nextProduct.id)}`}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-[#F1F2F5] border border-black/[0.08] font-bold text-[11px] inline-flex items-center gap-1"
                title={`Next: ${nextProduct.title}`}
              >
                Next <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ==================== SECTION 1: MOTIONSITES SPLIT LUXURY HERO ==================== */}
      <main className="max-w-[1460px] mx-auto px-2.5 sm:px-6 pt-2 sm:pt-5 space-y-8 sm:space-y-12">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* LEFT COLUMN (7 COLS): STICKY 360° INTERACTIVE 3D TURNTABLE STAGE — FULL SCREEN ON MOBILE */}
          <div className="lg:col-span-7 lg:sticky lg:top-[116px] space-y-3">
            <div className="relative h-[calc(100svh-122px)] min-h-[560px] lg:h-[650px] rounded-[24px] sm:rounded-[28px] bg-white border border-black/[0.08] shadow-[0_20px_50px_rgba(20,21,24,0.06)] overflow-hidden flex flex-col">
              {/* Top Stage Mode Switcher */}
              <div className="relative z-20 px-2 sm:px-3 py-1.5 sm:py-3 flex flex-nowrap sm:flex-wrap items-center justify-between gap-1 sm:gap-2 border-b border-black/[0.05] bg-white/92 backdrop-blur-md overflow-x-auto">
                <div className="shrink-0 inline-flex items-center p-0.5 rounded-full bg-[#F3F4F6] border border-black/[0.06]">
                  {(
                    [
                      ["avatar_3d", "On Your 3D Body 360°", "Body", User],
                      ["garment_3d", "3D Item Spin 360°", "Item", Box],
                      ["studio_cutout", "Isolated Cutout", "Photo", Sparkles],
                    ] as const
                  ).map(([id, label, mobileLbl, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setStageView(id)}
                      className={`whitespace-nowrap px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold inline-flex items-center gap-1 sm:gap-1.5 cursor-pointer transition ${
                        stageView === id
                          ? "bg-[#141518] text-white shadow-xs"
                          : "text-[#5E636E] hover:text-[#141518]"
                      }`}
                    >
                      <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="sm:hidden">{mobileLbl}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Lighting & Fit Diagnostic Toggles */}
                {stageView !== "studio_cutout" && (
                  <div className="shrink-0 flex flex-nowrap sm:flex-wrap items-center gap-1 sm:gap-1.5">
                    {stageView === "avatar_3d" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowHeatmap((v) => !v)}
                          className={`whitespace-nowrap px-1.5 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[10.5px] font-bold inline-flex items-center gap-0.5 sm:gap-1 border cursor-pointer transition ${
                            showHeatmap
                              ? "bg-[#C80815] text-white border-[#C80815]"
                              : "bg-white text-[#141518] border-black/10 hover:bg-[#F4F5F7]"
                          }`}
                        >
                          <Flame className="w-3 h-3" />
                          <span className="sm:hidden">Fit</span>
                          <span className="hidden sm:inline">Fit Heatmap</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRings((v) => !v)}
                          className={`whitespace-nowrap px-1.5 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[10.5px] font-bold inline-flex items-center gap-0.5 sm:gap-1 border cursor-pointer transition ${
                            showRings
                              ? "bg-[#244B3B] text-white border-[#244B3B]"
                              : "bg-white text-[#141518] border-black/10 hover:bg-[#F4F5F7]"
                          }`}
                        >
                          <Ruler className="w-3 h-3" />
                          <span className="sm:hidden">Rings</span>
                          <span className="hidden sm:inline">Scan Rings</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const idx =
                          MASTER_LIGHTING_PRESET_ORDER.indexOf(lightingId);
                        setLightingId(
                          MASTER_LIGHTING_PRESET_ORDER[
                            (idx + 1) % MASTER_LIGHTING_PRESET_ORDER.length
                          ]
                        );
                      }}
                      className="whitespace-nowrap px-1.5 sm:px-2.5 py-1 rounded-full bg-white hover:bg-[#F4F5F7] border border-black/10 text-[10px] sm:text-[10.5px] font-bold text-[#141518] inline-flex items-center gap-0.5 sm:gap-1 cursor-pointer"
                    >
                      <SunMedium className="w-3 h-3 text-[#244B3B]" />
                      {MASTER_IMMERSIVE_LIGHTING_PRESETS[lightingId].shortLabel}
                    </button>
                  </div>
                )}
              </div>

              {/* Active 3D / Cutout Viewport */}
              <div className="relative flex-1 min-h-0 w-full bg-white">
                {stageView === "avatar_3d" && (
                  <Interactive3DAvatarStage
                    mode="avatar"
                    dimensions={bodyDims}
                    wornPieces={wornSpecsOnAvatar}
                    faceOvalDataUrl={customAvatar?.faceOvalDataUrl || null}
                    customAvatarTurntableMp4Url={customAvatar?.turntableMp4Url}
                    customAvatarTurntablePosterUrl={
                      customAvatar?.turntablePosterUrl
                    }
                    visualMode={showHeatmap ? "heatmap" : "studio"}
                    showMeasurementRings={showRings}
                    externalSpinActive={autoRotate}
                    externalYawDeg={yawOverride}
                    externalYawSeq={yawSeq}
                    seamlessStage={false}
                    inertiaSpin={true}
                    showHud={false}
                  />
                )}

                {stageView === "garment_3d" && (
                  <Interactive3DAvatarStage
                    mode="product"
                    dimensions={bodyDims}
                    singleProduct={product}
                    selectedSize={activeSize}
                    externalSpinActive={autoRotate}
                    externalYawDeg={yawOverride}
                    externalYawSeq={yawSeq}
                    seamlessStage={false}
                    inertiaSpin={true}
                    showHud={false}
                  />
                )}

                {stageView === "studio_cutout" && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-white">
                    <div className="w-full max-w-[420px] h-[420px]">
                      <GarmentArtwork
                        product={product}
                        className="w-full h-full"
                      />
                    </div>
                    <p className="text-xs font-semibold text-[#5E636E] mt-2">
                      1024×1024 Isolated RGBA Cutout • Zero Background Clutter
                    </p>
                  </div>
                )}

                {activePreviewOutfit && stageView === "avatar_3d" && (
                  <div className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-full bg-[#141518]/90 text-white text-[11px] font-bold flex items-center gap-2 shadow-md">
                    <span>
                      Previewing Outfit #
                      {String(activePreviewOutfit.outfitNumber).padStart(
                        3,
                        "0"
                      )}
                      : {activePreviewOutfit.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewOutfitKey(null)}
                      className="underline text-[#A7D7C5] cursor-pointer"
                    >
                      Solo Piece
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom 360° Precision Angle Bar */}
              {stageView !== "studio_cutout" && (
                <div className="relative z-20 px-2.5 sm:px-3 py-1.5 sm:py-2 border-t border-black/[0.05] bg-[#FAFBFD] flex flex-nowrap sm:flex-wrap items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto">
                  <span className="hidden sm:inline-flex text-[11px] font-semibold text-[#5E636E] items-center gap-1">
                    <Rotate3d className="w-3.5 h-3.5 text-[#244B3B]" /> Drag
                    horizontally for seamless 360° studio spin
                  </span>
                  <div className="shrink-0 flex items-center gap-1">
                    {(
                      [
                        [0, "Front 0°", "0°"],
                        [45, "3/4 45°", "45°"],
                        [90, "Side 90°", "90°"],
                        [180, "Back 180°", "180°"],
                        [270, "Left 270°", "270°"],
                      ] as const
                    ).map(([deg, lbl, mobileLbl]) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => {
                          setAutoRotate(false);
                          setYawOverride(deg);
                          setYawSeq((s) => s + 1);
                        }}
                        className={`whitespace-nowrap px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[10.5px] font-bold cursor-pointer transition ${
                          yawOverride === deg && !autoRotate
                            ? "bg-[#141518] text-white"
                            : "bg-white border border-black/10 text-[#5E636E] hover:text-[#141518]"
                        }`}
                      >
                        <span className="sm:hidden">{mobileLbl}</span>
                        <span className="hidden sm:inline">{lbl}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setYawOverride(undefined);
                        setAutoRotate((v) => !v);
                      }}
                      className={`whitespace-nowrap px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[10.5px] font-bold cursor-pointer transition ${
                        autoRotate
                          ? "bg-[#244B3B] text-white"
                          : "bg-white border border-black/10 text-[#244B3B]"
                      }`}
                    >
                      <span className="sm:hidden">
                        {autoRotate ? "Spin ●" : "Spin"}
                      </span>
                      <span className="hidden sm:inline">
                        {autoRotate ? "Orbiting ●" : "Auto-Orbit"}
                      </span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("gwo-pdp-details-column")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="lg:hidden shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full bg-[#141518] text-white text-[10px] font-bold cursor-pointer"
                  >
                    Details ↓
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (5 COLS): EDITORIAL DETAILS, BODY-SCAN ACUTE FIT & CONVERSION */}
          <div id="gwo-pdp-details-column" className="scroll-mt-28 lg:col-span-5 space-y-5">
            {/* Brand, Title, Price & PBR Material Spec */}
            <div className="rounded-[28px] bg-white border border-black/[0.08] p-5 sm:p-6 space-y-4 shadow-[0_12px_32px_rgba(20,21,24,0.04)]">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#244B3B]">
                    {product.brand} • {product.category.toUpperCase()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F4F8F5] border border-[#C6E0D0] text-[10.5px] font-bold text-[#1D4232]">
                    {realismCert.realismScorePct}% Realism •{" "}
                    {tierDecision.tierSpec.marginalCreditCostUsd === 0
                      ? "Instant WebGL 360°"
                      : "360° Ready"}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#141518] leading-snug">
                  {product.title}
                </h1>

                <div className="flex items-baseline justify-between gap-3 pt-1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl font-extrabold text-[#141518]">
                      ${product.price}
                    </span>
                    <span className="text-xs font-semibold text-[#5E636E]">
                      USD • Free Boutique Air ({product.estDeliveryDays || 6}{" "}
                      Days)
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF9F6] border border-black/[0.08]">
                    <span
                      className="w-3 h-3 rounded-full border border-black/15"
                      style={{ backgroundColor: product.colorHex }}
                    />
                    <span className="text-[11px] font-bold text-[#141518]">
                      {product.colorName}
                    </span>
                  </div>
                </div>
              </div>

              {product.fitMetadata?.descriptionSummary && (
                <p className="text-xs text-[#4A4E57] leading-relaxed">
                  {product.fitMetadata.descriptionSummary}
                </p>
              )}

              {/* Interactive Size Selector */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#141518]">
                    Select Size (Live 3D Drape &amp; Ease Simulation)
                  </span>
                  <span className="font-bold text-[#244B3B]">
                    Recommended: {fitReport.recommendedSize} (
                    {fitReport.confidencePct}% Match)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizeKeys.map((sz) => {
                    const isSelected = activeSize === sz;
                    const isRec = fitReport.recommendedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`relative px-4 py-2 rounded-2xl text-xs font-extrabold border transition cursor-pointer min-w-[54px] ${
                          isSelected
                            ? "bg-[#141518] text-white border-[#141518] shadow-sm"
                            : "bg-white text-[#141518] border-black/12 hover:border-[#141518]"
                        }`}
                      >
                        <span>{isShoe ? `US ${sz}` : sz}</span>
                        {isRec && (
                          <span
                            className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${
                              isSelected
                                ? "bg-[#244B3B] text-[#C8F0DF]"
                                : "bg-[#E7F3EE] text-[#1D4232]"
                            }`}
                          >
                            Best
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Purchase & 3D Closet CTAs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  id="gwo-pdp-buy-now-btn"
                  onClick={() => handleAddSingle(true)}
                  className="py-3 px-4 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition"
                >
                  Buy Size {activeSize} • ${product.price}
                </button>
                <button
                  type="button"
                  id="gwo-pdp-add-bag-btn"
                  onClick={() => handleAddSingle(false)}
                  className="py-3 px-4 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Add to Bag
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Link
                  href={`/?try=${encodeURIComponent(product.id)}`}
                  className="flex-1 py-2 px-3 rounded-full bg-[#F4F8F5] hover:bg-[#E6F1EA] border border-[#C6E0D0] text-[#1D4232] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" /> Mix &amp; Match in 3D Closet
                </Link>
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="py-2 px-3.5 rounded-full bg-[#F3F4F6] hover:bg-[#E6E8ED] text-[#141518] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ScanLine className="w-3.5 h-3.5 text-[#244B3B]" /> Edit Body
                  Scan
                </button>
              </div>
            </div>

            {/* ACUTE BODY-SCAN FIT PREDICTION ENGINE CARD */}
            <div
              id="gwo-pdp-acute-fit-card"
              className="rounded-[28px] bg-white border border-[#C6E0D0] p-5 sm:p-6 space-y-4 shadow-[0_12px_32px_rgba(20,21,24,0.04)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[#244B3B]">
                    <ScanLine className="w-3.5 h-3.5" /> Acute Body-Scan Fit
                    Prediction
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#141518] mt-0.5">
                    Calibrated for Your{" "}
                    {formatHeightFeetInches(bodyDims.heightInches)} Scan (
                    {bodyDims.bustInches}&quot; B • {bodyDims.waistInches}&quot;
                    W • {bodyDims.hipsInches}&quot; H)
                  </h2>
                </div>
                <div className="inline-flex items-center p-0.5 rounded-full bg-[#F3F4F6] border border-black/[0.08] shrink-0">
                  {(["in", "cm"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase cursor-pointer ${
                        unit === u
                          ? "bg-[#141518] text-white"
                          : "text-[#5E636E]"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F4F8F5] border border-[#C6E0D0] space-y-1">
                <p className="text-xs font-bold text-[#1D4232]">
                  {fitReport.headlineVerdict}
                </p>
                {fitReport.alternateOption && (
                  <p className="text-[11px] font-medium text-[#244B3B]">
                    Alternate sizing ({fitReport.alternateOption.size}):{" "}
                    {fitReport.alternateOption.note}
                  </p>
                )}
              </div>

              {/* Zone-by-Zone Sub-Inch Ease Meters */}
              {fitReport.zones.length > 0 && (
                <div className="space-y-3">
                  {fitReport.zones.map((z) => {
                    const barColor =
                      z.feel === "too_tight"
                        ? "bg-[#C80815]"
                        : z.feel === "sculpted_snug"
                        ? "bg-[#D97706]"
                        : z.feel === "tailored_ideal"
                        ? "bg-[#244B3B]"
                        : "bg-[#2563EB]";
                    return (
                      <div
                        key={z.zone}
                        className="p-3 rounded-2xl bg-[#FAFBFD] border border-black/[0.06] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-[#141518]">
                            {z.zone} • Your Scan:{" "}
                            {fmtUnit(z.avatarInches, unit)}
                          </span>
                          <span className="font-bold text-[#244B3B]">
                            {z.feelLabel}
                          </span>
                        </div>

                        <div className="relative h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${z.meterPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10.5px] text-[#5E636E]">
                          <span>
                            Body Spec: {z.garmentRange}
                            {z.garmentCircumferenceInches !== undefined
                              ? ` • Garment Cut: ${fmtUnit(
                                  z.garmentCircumferenceInches,
                                  unit
                                )}`
                              : ""}
                          </span>
                          <span className="font-semibold">
                            Ease: {z.easeInches >= 0 ? "+" : ""}
                            {fmtUnit(z.easeInches, unit)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#4A4E57] leading-snug">
                          {z.detailNote}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Acute Vertical Hem, Inseam, Shoulder & Fabric Physics Readouts */}
              {fitReport.acuteScanMetrics && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-black/[0.06]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#5E636E]">
                      Hem / Proportion Landing
                    </p>
                    <p className="text-xs font-bold text-[#141518] mt-0.5">
                      {fitReport.acuteScanMetrics.hemLandingLabel}
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-black/[0.06]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#5E636E]">
                      Fabric Stretch &amp; Weight
                    </p>
                    <p className="text-xs font-bold text-[#141518] mt-0.5">
                      Up to +{fitReport.acuteScanMetrics.stretchMaxPct}% Give
                      {fitReport.acuteScanMetrics.fabricWeightGsm
                        ? ` • ${fitReport.acuteScanMetrics.fabricWeightGsm} GSM`
                        : ""}
                    </p>
                  </div>

                  {fitReport.acuteScanMetrics.shoulderNote && (
                    <div className="col-span-2 p-3 rounded-2xl bg-[#FAF9F6] border border-black/[0.06]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#5E636E]">
                        Shoulder Seam vs Your{" "}
                        {fmtUnit(
                          fitReport.acuteScanMetrics.customerShoulderInches,
                          unit
                        )}{" "}
                        Scan
                      </p>
                      <p className="text-xs font-semibold text-[#141518] mt-0.5">
                        {fitReport.acuteScanMetrics.shoulderNote}
                      </p>
                    </div>
                  )}

                  {fitReport.acuteScanMetrics.inseamBreakNote && (
                    <div className="col-span-2 p-3 rounded-2xl bg-[#FAF9F6] border border-black/[0.06]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#5E636E]">
                        Inseam Break vs Your{" "}
                        {fmtUnit(
                          fitReport.acuteScanMetrics
                            .estimatedCustomerInseamInches,
                          unit
                        )}{" "}
                        Leg Scan
                      </p>
                      <p className="text-xs font-semibold text-[#141518] mt-0.5">
                        {fitReport.acuteScanMetrics.inseamBreakNote}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-1 border-t border-black/[0.06] space-y-1">
                <p className="text-[11px] font-bold text-[#141518]">
                  {fitReport.lengthComparison.modelSummary}
                </p>
                <p className="text-[11px] text-[#5E636E] leading-relaxed">
                  {fitReport.lengthComparison.proportionNote}
                </p>
                <p className="text-[11px] font-semibold text-[#244B3B]">
                  Material Physics: {realismCert.fabricProfile.displayName} —{" "}
                  {fitReport.fabricSummary}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== SECTION 2: COMPLETE PHYSICAL GARMENT MEASUREMENT MATRIX ==================== */}
        <section
          id="gwo-pdp-measurement-matrix"
          className="rounded-[28px] bg-white border border-black/[0.08] p-5 sm:p-7 space-y-4 shadow-[0_12px_32px_rgba(20,21,24,0.03)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#244B3B]">
                Verified Physical Garment Specifications
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#141518]">
                Exact Garment &amp; Body Measurement Chart ({unit.toUpperCase()}
                )
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5E636E]">
                Highlighted row = Your Size {fitReport.recommendedSize} Body
                Scan Match
              </span>
              <div className="inline-flex items-center p-0.5 rounded-full bg-[#F3F4F6] border border-black/[0.08]">
                {(["in", "cm"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase cursor-pointer ${
                      unit === u ? "bg-[#141518] text-white" : "text-[#5E636E]"
                    }`}
                  >
                    {u === "in" ? "Inches" : "Centimeters"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/10 text-[11px] font-extrabold uppercase tracking-wider text-[#5E636E]">
                  <th className="py-3 px-3">Size</th>
                  {isShoe ? (
                    <>
                      <th className="py-3 px-3">Footbed Length</th>
                      <th className="py-3 px-3">Forefoot Width</th>
                      <th className="py-3 px-3">Heel Pitch</th>
                      <th className="py-3 px-3">Total Shaft / Height</th>
                    </>
                  ) : isBag ? (
                    <>
                      <th className="py-3 px-3">Width</th>
                      <th className="py-3 px-3">Height</th>
                      <th className="py-3 px-3">Gusset Depth</th>
                      <th className="py-3 px-3">Strap / Handle Drop</th>
                    </>
                  ) : isBelt ? (
                    <>
                      <th className="py-3 px-3">Waist Fit Range</th>
                      <th className="py-3 px-3">Center Notch</th>
                      <th className="py-3 px-3">Total Strap Length</th>
                      <th className="py-3 px-3">Strap Width</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-3">Body Bust</th>
                      <th className="py-3 px-3">Body Waist</th>
                      <th className="py-3 px-3">Body Hips</th>
                      <th className="py-3 px-3">Garment Cut (B / W / H)</th>
                      <th className="py-3 px-3">Shoulder</th>
                      <th className="py-3 px-3">Length</th>
                      <th className="py-3 px-3">Inseam / Rise</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {sizeKeys.map((sz) => {
                  const spec = product.sizeChartInches?.[sz] || {};
                  const isRec = fitReport.recommendedSize === sz;
                  const isInspected = activeSize === sz;
                  return (
                    <tr
                      key={sz}
                      onClick={() => setSelectedSize(sz)}
                      className={`cursor-pointer transition ${
                        isInspected
                          ? "bg-[#F4F8F5] font-bold"
                          : "hover:bg-[#FAFBFD]"
                      }`}
                    >
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-extrabold text-[#141518]">
                          {isShoe ? `US ${sz}` : sz}
                        </span>
                        {isRec && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-[#244B3B] text-white text-[9.5px] font-extrabold">
                            Your Match
                          </span>
                        )}
                      </td>
                      {isShoe ? (
                        <>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.footLengthIn, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.widthIn, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(
                              spec.heelHeightIn ??
                                product.fitMetadata?.heelHeightInches,
                              unit
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.heightIn, unit)}
                          </td>
                        </>
                      ) : isBag ? (
                        <>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.widthIn, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.heightIn, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.depthIn, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(
                              spec.strapDropIn ??
                                product.fitMetadata?.strapDropInches,
                              unit
                            )}
                          </td>
                        </>
                      ) : isBelt ? (
                        <>
                          <td className="py-3 px-3">
                            {fmtRangeUnit(spec.waistMin, spec.waistMax, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.garmentWaistIn, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.lengthIn, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(spec.widthIn, unit)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-3">
                            {fmtRangeUnit(spec.bustMin, spec.bustMax, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtRangeUnit(spec.waistMin, spec.waistMax, unit)}
                          </td>
                          <td className="py-3 px-3">
                            {fmtRangeUnit(spec.hipsMin, spec.hipsMax, unit)}
                          </td>
                          <td className="py-3 px-3 text-[#244B3B]">
                            {[
                              spec.garmentBustIn
                                ? `${fmtUnit(spec.garmentBustIn, unit)} B`
                                : null,
                              spec.garmentWaistIn
                                ? `${fmtUnit(spec.garmentWaistIn, unit)} W`
                                : null,
                              spec.garmentHipsIn
                                ? `${fmtUnit(spec.garmentHipsIn, unit)} H`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" • ") || "Calibrated"}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(
                              spec.shoulderWidthIn ??
                                product.fitMetadata?.shoulderWidthBySizeInches?.[
                                  sz
                                ],
                              unit
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {fmtUnit(
                              spec.lengthIn ??
                                product.fitMetadata?.garmentLengthBySizeInches?.[
                                  sz
                                ],
                              unit
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {spec.inseamIn || product.fitMetadata?.inseamInches
                              ? `${fmtUnit(
                                  spec.inseamIn ??
                                    product.fitMetadata?.inseamInches,
                                  unit
                                )} / ${fmtUnit(
                                  spec.riseIn ?? product.fitMetadata?.riseInches,
                                  unit
                                )}`
                              : "—"}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ==================== SECTION 3: MOTIONSITES OUTFIT CAROUSEL (FROM 100 CURATED OUTFITS) ==================== */}
        <section
          id="gwo-pdp-styled-outfits"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#244B3B]">
                100-Outfit Atelier Styling System
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#141518]">
                Styled in {featuredOutfits.length} Curated Outfits — Try Full
                Look on Your 3D Body
              </h2>
            </div>
            <Link
              href="/shop"
              className="text-xs font-bold text-[#244B3B] hover:underline inline-flex items-center gap-1"
            >
              Browse All 100 Outfits on Runway <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredOutfits.slice(0, 6).map((outfit) => {
              const outfitProds = outfit.productIds
                .map((id) => byId.get(id))
                .filter((p): p is Product => Boolean(p));
              const sumPrice = outfitProds.reduce((s, p) => s + p.price, 0);
              const isPreviewing = previewOutfitKey === outfit.key;

              return (
                <article
                  key={outfit.key}
                  className={`rounded-[24px] bg-white border p-4 flex flex-col justify-between gap-3 transition shadow-[0_8px_24px_rgba(20,21,24,0.04)] ${
                    isPreviewing
                      ? "border-[#244B3B] ring-2 ring-[#244B3B]/20"
                      : "border-black/[0.08]"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#141518] text-white text-[10px] font-extrabold">
                        Outfit #{String(outfit.outfitNumber).padStart(3, "0")} •{" "}
                        {outfit.occasion}
                      </span>
                      <span className="text-xs font-extrabold text-[#244B3B]">
                        ${sumPrice} Set
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-[#141518]">
                      {outfit.title}
                    </h3>
                    <p className="text-[11px] text-[#5E636E] leading-snug">
                      {outfit.stylistNote}
                    </p>

                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {outfitProds.slice(0, 4).map((op) => (
                        <Link
                          key={op.id}
                          href={`/product/${encodeURIComponent(op.id)}`}
                          className={`h-20 rounded-xl bg-[#FAFBFD] border overflow-hidden p-1 block ${
                            op.id === product.id
                              ? "border-[#244B3B]"
                              : "border-black/[0.05]"
                          }`}
                          title={op.title}
                        >
                          <GarmentArtwork
                            product={op}
                            className="w-full h-full"
                          />
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStageView("avatar_3d");
                        setPreviewOutfitKey(
                          isPreviewing ? null : outfit.key
                        );
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`flex-1 py-2 px-3 rounded-full text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition ${
                        isPreviewing
                          ? "bg-[#244B3B] text-white"
                          : "bg-[#F4F8F5] hover:bg-[#E5EFE9] text-[#1D4232]"
                      }`}
                    >
                      {isPreviewing ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Wearing on 3D Stage
                        </>
                      ) : (
                        <>
                          <Rotate3d className="w-3.5 h-3.5" /> Try Full Look in
                          3D
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        outfitProds.forEach((op) => {
                          const f = analyzeExactAvatarFit(
                            {
                              heightInches: bodyDims.heightInches,
                              bustInches: bodyDims.bustInches,
                              waistInches: bodyDims.waistInches,
                              hipsInches: bodyDims.hipsInches,
                              shoeSize: bodyDims.shoeSize,
                            },
                            op
                          );
                          addToBag({
                            productId: op.id,
                            title: op.title,
                            brand: op.brand,
                            price: op.price,
                            size: f.recommendedSize,
                            imageUrl: op.imageUrl,
                            storeUrl: op.canonicalUrl,
                          });
                        });
                        showToast(
                          `Added all ${outfitProds.length} pieces of Outfit #${String(
                            outfit.outfitNumber
                          ).padStart(3, "0")} to Bag!`
                        );
                      }}
                      className="py-2 px-3.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold cursor-pointer"
                    >
                      + Full Set
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ==================== SECTION 4: COMPLETE THE LOOK (DEDICATED PRODUCT PAGES) ==================== */}
        <section className="space-y-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#244B3B]">
              Companion 360° Boutique Pieces
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#141518]">
              Complete the Look — Every Piece Has Its Own 360° Product Page
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {companionRecommendations.map((comp) => {
              const cFit = analyzeExactAvatarFit(
                {
                  heightInches: bodyDims.heightInches,
                  bustInches: bodyDims.bustInches,
                  waistInches: bodyDims.waistInches,
                  hipsInches: bodyDims.hipsInches,
                  shoeSize: bodyDims.shoeSize,
                },
                comp
              );
              return (
                <Link
                  key={comp.id}
                  href={`/product/${encodeURIComponent(comp.id)}`}
                  className="group rounded-[22px] bg-white border border-black/[0.08] hover:border-[#141518] p-3.5 flex flex-col justify-between gap-2 transition shadow-[0_6px_18px_rgba(20,21,24,0.03)]"
                >
                  <div>
                    <div className="h-36 rounded-xl bg-white overflow-hidden mb-2 flex items-center justify-center">
                      <GarmentArtwork
                        product={comp}
                        className="w-full h-full group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#244B3B]">
                      {comp.brand} • Size {cFit.recommendedSize}
                    </p>
                    <p className="text-xs font-bold text-[#141518] line-clamp-1 mt-0.5 group-hover:underline">
                      {comp.title}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-black/[0.05]">
                    <span className="text-xs font-extrabold text-[#141518]">
                      ${comp.price}
                    </span>
                    <span className="text-[10.5px] font-bold text-[#244B3B]">
                      360° Page →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
