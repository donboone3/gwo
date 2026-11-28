"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  formatCompactOutfitTitle,
  formatCompactProductTitle,
} from "@/lib/catalog/compact-title";
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
  CuratedOutfitDesign,
  getCuratedOutfitsForProduct,
} from "@/lib/stylist/curated-100-outfits";
import { renderModularOutfitDataUrlAsync } from "@/lib/three/modular-outfit-compositor";
import { routeProductTo360Tier } from "@/lib/higgsfield/credit-smart-360-pipeline";
import { launchFlyToBag } from "@/lib/motion/fly-to-bag";
import { Product } from "@/lib/types";

function OutfitBundleAvatarPreview({
  outfit,
  outfitProducts,
  faceOvalDataUrl,
  isPreviewing,
  onTryLook,
}: {
  outfit: CuratedOutfitDesign;
  outfitProducts: Product[];
  faceOvalDataUrl?: string | null;
  isPreviewing: boolean;
  onTryLook: () => void;
}) {
  const wrapRef = useRef<HTMLButtonElement | null>(null);
  const [modularUrl, setModularUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!outfit.isModularRemix || outfitProducts.length === 0) {
      setModularUrl(null);
      return;
    }
    let cancelled = false;
    const el = wrapRef.current;

    const triggerRender = () => {
      void renderModularOutfitDataUrlAsync(outfitProducts, "front").then(
        (dataUrl) => {
          if (!cancelled && dataUrl) {
            setModularUrl(dataUrl);
          }
        }
      );
    };

    if (!el || typeof IntersectionObserver === "undefined") {
      triggerRender();
      return () => {
        cancelled = true;
      };
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          obs.disconnect();
          triggerRender();
        }
      },
      { rootMargin: "360px 0px", threshold: 0.01 }
    );
    obs.observe(el);

    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [outfit.isModularRemix, outfit.key, outfitProducts]);

  const avatarSrc = modularUrl || outfit.frontAvatarUrl;

  return (
    <button
      ref={wrapRef}
      type="button"
      onClick={onTryLook}
      title={`Preview ${outfit.title} on 360° Avatar`}
      className={`group relative w-[124px] sm:w-[144px] h-[222px] sm:h-[244px] rounded-2xl bg-white border overflow-hidden shrink-0 cursor-pointer transition ${
        isPreviewing
          ? "border-[#B83B6A] ring-2 ring-[#B83B6A]/20"
          : "border-[#ECD7E1] hover:border-[#D797B2]"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc}
        alt={`Avatar wearing ${outfit.title}`}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-contain object-bottom pt-1.5 group-hover:scale-[1.03] transition-transform duration-300"
      />
      {faceOvalDataUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={faceOvalDataUrl}
          alt=""
          aria-hidden="true"
          style={{
            left: "49.95%",
            top: "14.2%",
            width: "12.9%",
            height: "9.5%",
            transform: "translate(-50%, -50%)",
          }}
          className="pointer-events-none absolute object-fill rounded-full"
        />
      )}
      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-white/95 border border-[#ECD7E1] text-[9px] font-extrabold text-[#962953] inline-flex items-center gap-0.5 shadow-2xs">
        <Rotate3d className="w-2.5 h-2.5 text-[#B83B6A]" /> 360°
      </span>
    </button>
  );
}

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

  const handleAddSingle = (
    buyImmediately: boolean,
    sourceEl?: HTMLElement | null
  ) => {
    if (!buyImmediately && sourceEl) {
      launchFlyToBag(sourceEl, product.imageUrl);
    }
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
    <div className="min-h-screen bg-[#FDF8FA] text-[#22131A] pb-20">
      {/* MotionSites Scroll-Linked Top Hairline Progress Bar */}
      <div className="fixed top-0 inset-x-0 h-[2.5px] z-[120] bg-black/[0.06] pointer-events-none">
        <div
          className="h-full bg-[#B83B6A] origin-left transition-transform duration-75"
          style={{ transform: `scaleX(${scrollPct.toFixed(4)})` }}
        />
      </div>

      {/* Editorial Atelier Top Navigation Strip */}
      <div className="sticky top-16 z-40 bg-[#FDF8FA]/94 backdrop-blur-md border-b border-[#ECD7E1]">
        <div className="max-w-[1460px] mx-auto px-4 sm:px-6 h-11 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 font-bold text-[#22131A] hover:text-[#B83B6A] shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Runway &amp; Boutique
            </Link>
            <span className="text-[#D4A6B8]">/</span>
            <Link
              href="/"
              className="font-semibold text-[#745C67] hover:text-[#22131A] shrink-0 hidden sm:inline"
            >
              3D Closet
            </Link>
            <span className="text-[#D4A6B8] hidden sm:inline">/</span>
            <span className="font-semibold text-[#B83B6A] truncate">
              {formatCompactProductTitle(product, 28)}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FCECF3] text-[#962953] text-[10.5px] font-bold">
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
      <main className="max-w-[1460px] mx-auto px-0 sm:px-6 pt-0 sm:pt-5 space-y-6 sm:space-y-12">
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* LEFT COLUMN (7 COLS): PURE CLEAN STICKY 360° INTERACTIVE TURNTABLE STAGE (ZERO HEADERS/FOOTERS) */}
          <div className="lg:col-span-7 lg:sticky lg:top-[116px]">
            <div className="relative h-[calc(100svh-104px)] min-h-[460px] lg:h-[650px] sm:rounded-[28px] gwo-couture-stage-bg border-b sm:border border-[#E5D7CA] sm:shadow-[0_20px_50px_rgba(27,77,59,0.08)] overflow-hidden flex flex-col">
              {/* Active Pure Clean 3D / Cutout Viewport */}
              <div className="relative flex-1 min-h-0 w-full h-full gwo-couture-stage-bg">
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
                  <div className="w-full h-full flex items-center justify-center p-8 bg-white">
                    <div className="w-full max-w-[420px] h-[420px]">
                      <GarmentArtwork
                        product={product}
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (5 COLS — SCROLL DOWN ON MOBILE): CONTROLS, EDITORIAL DETAILS, BODY-SCAN FIT & CONVERSION */}
          <div id="gwo-pdp-details-column" className="scroll-mt-24 px-3 sm:px-0 lg:col-span-5 space-y-5">
            {/* Relocated 360° View, Angle & Fit Diagnostic Bar (Cleanly Outside Avatar Container!) */}
            <div className="rounded-3xl bg-white border border-black/[0.08] p-3 space-y-2 shadow-[0_8px_24px_rgba(20,21,24,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="inline-flex items-center p-0.5 rounded-full bg-[#F3F4F6] border border-black/[0.06]">
                  {(
                    [
                      ["avatar_3d", "Body 360°", User],
                      ["garment_3d", "Item 360°", Box],
                      ["studio_cutout", "Photo", Sparkles],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setStageView(id)}
                      className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                        stageView === id
                          ? "bg-[#141518] text-white shadow-xs"
                          : "text-[#5E636E] hover:text-[#141518]"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>

                {stageView !== "studio_cutout" && (
                  <div className="flex items-center gap-1">
                    {stageView === "avatar_3d" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowHeatmap((v) => !v)}
                          className={`whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border cursor-pointer transition ${
                            showHeatmap
                              ? "bg-[#C80815] text-white border-[#C80815]"
                              : "bg-white text-[#141518] border-black/10 hover:bg-[#F4F5F7]"
                          }`}
                        >
                          <Flame className="w-3 h-3" /> Fit Map
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRings((v) => !v)}
                          className={`whitespace-nowrap px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border cursor-pointer transition ${
                            showRings
                              ? "bg-[#244B3B] text-white border-[#244B3B]"
                              : "bg-white text-[#141518] border-black/10 hover:bg-[#F4F5F7]"
                          }`}
                        >
                          <Ruler className="w-3 h-3" /> Rings
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
                      className="whitespace-nowrap px-2 py-1 rounded-full bg-white hover:bg-[#F4F5F7] border border-black/10 text-[10px] font-bold text-[#141518] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <SunMedium className="w-3 h-3 text-[#244B3B]" />
                      {MASTER_IMMERSIVE_LIGHTING_PRESETS[lightingId].shortLabel}
                    </button>
                  </div>
                )}
              </div>

              {stageView !== "studio_cutout" && (
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  {(
                    [
                      [0, "Front 0°"],
                      [45, "45°"],
                      [90, "Side 90°"],
                      [180, "Back 180°"],
                    ] as const
                  ).map(([deg, lbl]) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => {
                        setAutoRotate(false);
                        setYawOverride(deg);
                        setYawSeq((s) => s + 1);
                      }}
                      className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                        yawOverride === deg && !autoRotate
                          ? "bg-[#141518] text-white"
                          : "bg-[#F4F5F7] text-[#5E636E] hover:text-[#141518]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setYawOverride(undefined);
                      setAutoRotate((v) => !v);
                    }}
                    className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                      autoRotate
                        ? "bg-[#244B3B] text-white"
                        : "bg-[#F4F5F7] text-[#244B3B]"
                    }`}
                  >
                    {autoRotate ? "Orbiting ●" : "360° Spin"}
                  </button>
                  {activePreviewOutfit && (
                    <button
                      type="button"
                      onClick={() => setPreviewOutfitKey(null)}
                      className="whitespace-nowrap px-2.5 py-1 rounded-full bg-[#141518] text-[#A7D7C5] text-[10px] font-bold cursor-pointer"
                    >
                      Solo Piece ✕
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Brand, Title, Price & PBR Material Spec */}
            <div className="rounded-[28px] bg-white border border-[#ECD7E1] p-5 sm:p-6 space-y-4 shadow-[0_12px_32px_rgba(150,41,83,0.05)]">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#B83B6A]">
                    {product.brand} • {product.category.toUpperCase()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FCECF3] border border-[#F0C5D7] text-[10.5px] font-bold text-[#962953]">
                    {realismCert.realismScorePct}% Realism •{" "}
                    {tierDecision.tierSpec.marginalCreditCostUsd === 0
                      ? "Instant WebGL 360°"
                      : "360° Ready"}
                  </span>
                </div>

                <h1 className="font-editorial text-2xl sm:text-3xl font-semibold tracking-tight text-[#22131A] leading-tight">
                  {product.title}
                </h1>

                <div className="flex items-baseline justify-between gap-3 pt-1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-editorial text-3xl font-bold text-[#22131A]">
                      ${product.price}
                    </span>
                    <span className="text-xs font-semibold text-[#745C67]">
                      USD • Free Boutique Air ({product.estDeliveryDays || 6}{" "}
                      Days)
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FDF7FA] border border-[#ECD7E1]">
                    <span
                      className="w-3 h-3 rounded-full border border-black/15"
                      style={{ backgroundColor: product.colorHex }}
                    />
                    <span className="text-[11px] font-bold text-[#22131A]">
                      {product.colorName}
                    </span>
                  </div>
                </div>
              </div>

              {product.fitMetadata?.descriptionSummary && (
                <p className="text-xs text-[#634B56] leading-relaxed">
                  {product.fitMetadata.descriptionSummary}
                </p>
              )}

              {/* Interactive Size Selector */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#22131A]">
                    Select Size (Live 3D Drape &amp; Ease Simulation)
                  </span>
                  <span className="font-bold text-[#B83B6A]">
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
                            ? "bg-[#22131A] text-white border-[#22131A] shadow-sm"
                            : "bg-white text-[#22131A] border-[#ECD7E1] hover:border-[#B83B6A]"
                        }`}
                      >
                        <span>{isShoe ? `US ${sz}` : sz}</span>
                        {isRec && (
                          <span
                            className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${
                              isSelected
                                ? "bg-[#B83B6A] text-white"
                                : "bg-[#FCECF3] text-[#962953]"
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
                  onClick={(ev) => handleAddSingle(true, ev.currentTarget)}
                  className="py-3 px-4 rounded-full bg-gradient-to-r from-[#B83B6A] to-[#91244E] hover:brightness-105 text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(184,59,106,0.28)] cursor-pointer transition"
                >
                  Buy Size {activeSize} • ${product.price}
                </button>
                <button
                  type="button"
                  id="gwo-pdp-add-bag-btn"
                  onClick={(ev) => handleAddSingle(false, ev.currentTarget)}
                  className="py-3 px-4 rounded-full bg-[#22131A] hover:bg-[#381F2B] text-white text-xs font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#F6B8D0]" /> Add to
                  Bag
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Link
                  href={`/?try=${encodeURIComponent(product.id)}`}
                  className="flex-1 py-2 px-3 rounded-full bg-[#FCECF3] hover:bg-[#F8DCE8] border border-[#F0C5D7] text-[#962953] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" /> Mix &amp; Match in 3D Closet
                </Link>
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="py-2 px-3.5 rounded-full bg-[#F8EAF0] hover:bg-[#F3DCE7] text-[#22131A] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ScanLine className="w-3.5 h-3.5 text-[#B83B6A]" /> Edit Body
                  Scan
                </button>
              </div>
            </div>

            {/* ACUTE BODY-SCAN FIT PREDICTION ENGINE CARD */}
            <div
              id="gwo-pdp-acute-fit-card"
              className="rounded-[28px] bg-white border border-[#ECD7E1] p-5 sm:p-6 space-y-4 shadow-[0_12px_32px_rgba(150,41,83,0.04)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[#B83B6A]">
                    <ScanLine className="w-3.5 h-3.5" /> Acute Body-Scan Fit
                    Prediction
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#22131A] mt-0.5">
                    Calibrated for Your{" "}
                    {formatHeightFeetInches(bodyDims.heightInches)} Scan (
                    {bodyDims.bustInches}&quot; B • {bodyDims.waistInches}&quot;
                    W • {bodyDims.hipsInches}&quot; H)
                  </h2>
                </div>
                <div className="inline-flex items-center p-0.5 rounded-full bg-[#F8EAF0] border border-[#EBD2DE] shrink-0">
                  {(["in", "cm"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase cursor-pointer ${
                        unit === u
                          ? "bg-[#22131A] text-white"
                          : "text-[#6E5360]"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FCECF3] border border-[#F0C5D7] space-y-1">
                <p className="text-xs font-bold text-[#852148]">
                  {fitReport.headlineVerdict}
                </p>
                {fitReport.alternateOption && (
                  <p className="text-[11px] font-medium text-[#962953]">
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
                        ? "bg-[#D9435A]"
                        : z.feel === "sculpted_snug"
                        ? "bg-[#C96A8B]"
                        : z.feel === "tailored_ideal"
                        ? "bg-[#B83B6A]"
                        : "bg-[#C48A78]";
                    return (
                      <div
                        key={z.zone}
                        className="p-3 rounded-2xl bg-[#FDF7FA] border border-[#ECD7E1] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-[#22131A]">
                            {z.zone} • Your Scan:{" "}
                            {fmtUnit(z.avatarInches, unit)}
                          </span>
                          <span className="font-bold text-[#B83B6A]">
                            {z.feelLabel}
                          </span>
                        </div>

                        <div className="relative h-2 rounded-full bg-[#F1E0E8] overflow-hidden">
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
                <p className="text-[11px] font-semibold text-[#B83B6A]">
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
          className="rounded-[28px] bg-white border border-[#ECD7E1] p-5 sm:p-7 space-y-4 shadow-[0_12px_32px_rgba(150,41,83,0.03)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#B83B6A]">
                Verified Physical Garment Specifications
              </span>
              <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-[#22131A]">
                Exact Garment &amp; Body Measurement Chart ({unit.toUpperCase()}
                )
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#745C67]">
                Highlighted row = Your Size {fitReport.recommendedSize} Body
                Scan Match
              </span>
              <div className="inline-flex items-center p-0.5 rounded-full bg-[#F8EAF0] border border-[#EBD2DE]">
                {(["in", "cm"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase cursor-pointer ${
                      unit === u ? "bg-[#22131A] text-white" : "text-[#6E5360]"
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
                          ? "bg-[#FCECF3] font-bold"
                          : "hover:bg-[#FDF7FA]"
                      }`}
                    >
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-extrabold text-[#22131A]">
                          {isShoe ? `US ${sz}` : sz}
                        </span>
                        {isRec && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-[#B83B6A] text-white text-[9.5px] font-extrabold">
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
          className="space-y-4 px-3.5 sm:px-0"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#B83B6A]">
                100-Outfit Atelier Styling System
              </span>
              <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-[#22131A]">
                Styled in {featuredOutfits.length} Curated Outfits — Try Full
                Look on Your 3D Body
              </h2>
            </div>
            <Link
              href="/shop"
              className="text-xs font-bold text-[#B83B6A] hover:underline inline-flex items-center gap-1"
            >
              Browse All 100 Outfits on Runway <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredOutfits.slice(0, 6).map((outfit) => {
              const outfitProds = outfit.productIds
                .map((id) => byId.get(id))
                .filter((p): p is Product => Boolean(p));
              const sumPrice = outfitProds.reduce((s, p) => s + p.price, 0);
              const isPreviewing = previewOutfitKey === outfit.key;

              const handleTryLook = () => {
                setStageView("avatar_3d");
                setPreviewOutfitKey(isPreviewing ? null : outfit.key);
                window.scrollTo({ top: 0, behavior: "smooth" });
              };

              const handleBuyBundle = (openCheckoutImmediately: boolean) => {
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
                    avatarFrontUrl: outfit.frontAvatarUrl,
                    avatarBackUrl: outfit.backAvatarUrl,
                    storeUrl: op.canonicalUrl,
                  });
                });
                if (openCheckoutImmediately) {
                  openDropshipCheckout("checkout");
                } else {
                  showToast(
                    `Added all ${outfitProds.length} pieces of Outfit #${String(
                      outfit.outfitNumber
                    ).padStart(3, "0")} to Bag!`
                  );
                }
              };

              return (
                <article
                  key={outfit.key}
                  data-pdp-outfit-bundle="true"
                  className={`rounded-[24px] bg-white border p-3.5 sm:p-4 flex items-stretch gap-3.5 transition shadow-[0_8px_24px_rgba(150,41,83,0.05)] ${
                    isPreviewing
                      ? "border-[#B83B6A] ring-2 ring-[#B83B6A]/20"
                      : "border-[#ECD7E1]"
                  }`}
                >
                  {/* Left: Lifelike Avatar Wearing the Complete Full Outfit Bundle */}
                  <OutfitBundleAvatarPreview
                    outfit={outfit}
                    outfitProducts={outfitProds}
                    faceOvalDataUrl={customAvatar?.faceOvalDataUrl}
                    isPreviewing={isPreviewing}
                    onTryLook={handleTryLook}
                  />

                  {/* Right: Bundle Details, Included Pieces & Full-Outfit Purchase CTA */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-[#22131A] text-white text-[9.5px] font-extrabold truncate">
                          Outfit #{String(outfit.outfitNumber).padStart(3, "0")} •{" "}
                          {outfit.occasion}
                        </span>
                        <span className="text-xs font-extrabold text-[#B83B6A] shrink-0">
                          ${sumPrice} Set
                        </span>
                      </div>

                      <h3 className="text-[13px] sm:text-sm font-extrabold text-[#22131A] leading-snug truncate">
                        {formatCompactOutfitTitle(outfit.title, 28)}
                      </h3>
                      <p className="text-[10.5px] text-[#745C67] leading-snug line-clamp-2">
                        {outfit.stylistNote}
                      </p>

                      <div className="grid grid-cols-4 gap-1 pt-0.5">
                        {outfitProds.slice(0, 4).map((op) => (
                          <Link
                            key={op.id}
                            href={`/product/${encodeURIComponent(op.id)}`}
                            className={`h-14 sm:h-16 rounded-xl bg-white border overflow-hidden p-0.5 block ${
                              op.id === product.id
                                ? "border-[#B83B6A]"
                                : "border-[#ECD7E1]"
                            }`}
                            title={op.title}
                          >
                            <GarmentArtwork
                              product={op}
                              cleanCard
                              className="w-full h-full"
                            />
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleBuyBundle(true)}
                        className="flex-1 py-2 px-3 rounded-full bg-gradient-to-r from-[#B83B6A] to-[#962953] hover:brightness-105 text-white text-[11px] font-extrabold inline-flex items-center justify-center gap-1 shadow-[0_4px_12px_rgba(184,59,106,0.22)] cursor-pointer transition whitespace-nowrap"
                      >
                        <ShoppingBag className="w-3 h-3 text-[#FCECF3]" />
                        Buy Full Outfit (${sumPrice})
                      </button>
                      <button
                        type="button"
                        onClick={handleTryLook}
                        className={`py-2 px-3 rounded-full text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap ${
                          isPreviewing
                            ? "bg-[#22131A] text-white"
                            : "bg-[#FCECF3] hover:bg-[#F8DCE8] text-[#962953]"
                        }`}
                      >
                        {isPreviewing ? (
                          <>
                            <Check className="w-3 h-3" /> Wearing
                          </>
                        ) : (
                          <>
                            <Rotate3d className="w-3 h-3" /> Try 3D
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ==================== SECTION 4: COMPLETE THE LOOK (DEDICATED PRODUCT PAGES) ==================== */}
        <section className="space-y-4 px-3.5 sm:px-0">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#B83B6A]">
              Companion 360° Boutique Pieces
            </span>
            <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-[#22131A]">
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
                  className="group rounded-[22px] bg-white border border-[#ECD7E1] hover:border-[#B83B6A] p-3.5 flex flex-col justify-between gap-2 transition shadow-[0_6px_18px_rgba(150,41,83,0.04)]"
                >
                  <div>
                    <div className="h-36 rounded-xl bg-gradient-to-b from-[#FFFDFE] to-[#FCF3F7] overflow-hidden mb-2 flex items-center justify-center p-2">
                      <GarmentArtwork
                        product={comp}
                        className="w-full h-full group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#B83B6A]">
                      {comp.brand} • Size {cFit.recommendedSize}
                    </p>
                    <p className="text-xs font-bold text-[#22131A] line-clamp-2 mt-0.5 group-hover:text-[#B83B6A]">
                      {formatCompactProductTitle(comp, 24)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#ECD7E1]">
                    <span className="font-editorial text-sm font-bold text-[#22131A]">
                      ${comp.price}
                    </span>
                    <span className="text-[10.5px] font-bold text-[#B83B6A]">
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
