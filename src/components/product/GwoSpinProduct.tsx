"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Box,
  Check,
  Columns2,
  Heart,
  Images,
  Minus,
  Plus,
  Rotate3d,
  Ruler,
  ScanLine,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import "./spin-product.css";
import { H, STUDIO_LOOKS } from "../vell/vell-data";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { Interactive3DAvatarStage } from "../three/Interactive3DAvatarStage";
import { MotionSitesBoutiqueStorefront } from "../shop/MotionSitesBoutiqueStorefront";
import { useGwo } from "@/context/GwoAppContext";
import {
  analyzeExactAvatarFit,
  ZoneFeel,
} from "@/lib/catalog/fit-intelligence";
import {
  formatCompactOutfitTitle,
  formatCompactProductTitle,
} from "@/lib/catalog/compact-title";
import { build3DOutfitForClosetLook } from "@/lib/catalog/closet-look-3d-mapper";
import { resolveLifelikeAvatarPhotos } from "@/lib/catalog/avatar-photo-resolver";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { buildAiRunwayOutfits } from "@/lib/stylist/runway-ai-outfits";
import {
  deriveFullBodyDimensionsFromProfile,
  formatHeightFeetInches,
} from "@/lib/three/body-scan-analyzer";
import { certifyClothingItemRealism } from "@/lib/realism/master-avatar-clothing-realism";
import { launchFlyToBag } from "@/lib/motion/fly-to-bag";
import { Product } from "@/lib/types";

const SIZES = ["XS", "S", "M", "L"] as const;

function getZoneBadgeStyle(feel: ZoneFeel): string {
  if (feel === "too_tight") {
    return "bg-[#FDECEB] text-[#9E2A22] border-[#F5C6C2]";
  }
  if (feel === "sculpted_snug") {
    return "bg-[#FEF3F8] text-[#962953] border-[#F0C5D7]";
  }
  if (feel === "tailored_ideal") {
    return "bg-[#FCECF3] text-[#852148] border-[#EEBFD3]";
  }
  if (feel === "relaxed_skim") {
    return "bg-[#FDF6F2] text-[#7A4434] border-[#EED3C5]";
  }
  return "bg-[#F8EFF7] text-[#6B3363] border-[#E7CCE4]";
}

function getZoneBarColor(feel: ZoneFeel): string {
  if (feel === "too_tight") return "#D9435A";
  if (feel === "sculpted_snug") return "#C96A8B";
  if (feel === "tailored_ideal") return "#B83B6A";
  if (feel === "relaxed_skim") return "#C48A78";
  return "#9B528B";
}

export function GwoSpinProduct() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");
  const lookParam = searchParams.get("look");

  const {
    user,
    products,
    purchasedItems,
    socialDna,
    activeImportedProduct,
    setAddUrlModalOpen,
    addToBag,
    openDropshipCheckout,
    showToast,
    customAvatar,
    setAvatarModalOpen,
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

  const ownedIds = useMemo(() => {
    const set = new Set<string>([
      "prod-ae-espresso-corset",
      "prod-ae-champagne-trousers",
      "prod-ae-ivory-tweed-blazer",
      "prod-ae-noir-pleated-mini",
      "prod-ae-crimson-corset-mini",
    ]);
    for (const p of purchasedItems) {
      if (p.productId) set.add(p.productId);
    }
    return set;
  }, [purchasedItems]);

  const bodyDims = useMemo(
    () => deriveFullBodyDimensionsFromProfile(user, customAvatar),
    [customAvatar, user]
  );

  const curatedOutfits = useMemo(
    () =>
      buildAiRunwayOutfits({
        catalog: fullCatalog,
        avatar: {
          heightInches: bodyDims.heightInches,
          bustInches: bodyDims.bustInches,
          waistInches: bodyDims.waistInches,
          hipsInches: bodyDims.hipsInches,
          shoeSize: bodyDims.shoeSize,
        },
        socialDna,
      }),
    [bodyDims, fullCatalog, socialDna]
  );

  const resolveOutfitProducts = useCallback(
    (lkIdx: number) => {
      const lk = STUDIO_LOOKS[lkIdx] || STUDIO_LOOKS[0];
      if (lk.relatedProductIds && lk.relatedProductIds.length > 0) {
        const matched = lk.relatedProductIds
          .map((id) => fullCatalog.find((p) => p.id === id))
          .filter((p): p is Product => Boolean(p));
        if (matched.length > 0) {
          return { primary: matched[0], allPieces: matched, index: lk.index };
        }
      }
      const mapped = build3DOutfitForClosetLook(lk, fullCatalog);
      return {
        primary: mapped.primaryProduct,
        allPieces: [mapped.primaryProduct, ...mapped.companionProducts],
        index: lk.index,
      };
    },
    [fullCatalog]
  );

  const initialOutfit = useMemo(
    () => resolveOutfitProducts(0),
    [resolveOutfitProducts]
  );

  const [selectedPickerVal, setSelectedPickerVal] =
    useState<string>("closet-look:0");
  const [selectedQuickProduct, setSelectedQuickProduct] =
    useState<Product | null>(initialOutfit.primary);
  const [outfitPieces, setOutfitPieces] = useState<Product[]>(
    initialOutfit.allPieces
  );
  const [selectedLookIdx, setSelectedLookIdx] = useState<number | undefined>(0);

  useEffect(() => {
    if (lookParam !== null) {
      const resolved = resolveOutfitProducts(Number(lookParam));
      setSelectedPickerVal(`closet-look:${resolved.index}`);
      setSelectedLookIdx(resolved.index);
      setSelectedQuickProduct(resolved.primary);
      setOutfitPieces(resolved.allPieces);
      return;
    }
    if (queryId) {
      const found =
        (activeImportedProduct?.id === queryId ? activeImportedProduct : null) ||
        fullCatalog.find((p) => p.id === queryId) ||
        null;
      if (found) {
        setSelectedPickerVal(found.id);
        setSelectedLookIdx(found.studioLookIndex);
        setSelectedQuickProduct(found);
        setOutfitPieces([found]);
        return;
      }
    }
    const def = resolveOutfitProducts(0);
    setSelectedPickerVal(`closet-look:${def.index}`);
    setSelectedLookIdx(def.index);
    setSelectedQuickProduct(def.primary);
    setOutfitPieces(def.allPieces);
  }, [
    activeImportedProduct,
    fullCatalog,
    lookParam,
    queryId,
    resolveOutfitProducts,
  ]);

  const selectOutfitOrProduct = useCallback(
    (val: string) => {
      setSelectedPickerVal(val);
      if (val.startsWith("closet-look:")) {
        const lkIdx = Number(val.split(":")[1] || 0);
        const resolved = resolveOutfitProducts(lkIdx);
        setSelectedLookIdx(resolved.index);
        setSelectedQuickProduct(resolved.primary);
        setOutfitPieces(resolved.allPieces);
        return;
      }
      const found = fullCatalog.find((p) => p.id === val);
      if (found) {
        setSelectedLookIdx(found.studioLookIndex);
        setSelectedQuickProduct(found);
        setOutfitPieces([found]);
      }
    },
    [fullCatalog, resolveOutfitProducts]
  );

  const activeProduct: Product = selectedQuickProduct || initialOutfit.primary;

  const lifelikePhotos = useMemo(
    () =>
      resolveLifelikeAvatarPhotos({
        product: activeProduct,
        lookIndex: selectedLookIdx,
      }),
    [activeProduct, selectedLookIdx]
  );

  const baseFitReport = useMemo(
    () =>
      analyzeExactAvatarFit(
        {
          bustInches: bodyDims.bustInches,
          waistInches: bodyDims.waistInches,
          hipsInches: bodyDims.hipsInches,
          heightInches: bodyDims.heightInches,
          shoeSize: bodyDims.shoeSize,
        },
        activeProduct
      ),
    [activeProduct, bodyDims]
  );

  const [selectedSize, setSelectedSize] = useState<string>(
    baseFitReport.recommendedSize
  );

  useEffect(() => {
    setSelectedSize(baseFitReport.recommendedSize);
  }, [baseFitReport.recommendedSize, activeProduct.id]);

  const liveFitReport = useMemo(
    () =>
      analyzeExactAvatarFit(
        {
          bustInches: bodyDims.bustInches,
          waistInches: bodyDims.waistInches,
          hipsInches: bodyDims.hipsInches,
          heightInches: bodyDims.heightInches,
          shoeSize: bodyDims.shoeSize,
        },
        activeProduct,
        selectedSize
      ),
    [activeProduct, bodyDims, selectedSize]
  );

  const [stageDisplayMode, setStageDisplayMode] = useState<
    "avatar3d" | "product3d" | "split" | "photo"
  >("avatar3d");
  const [externalYawDeg, setExternalYawDeg] = useState<number | undefined>(
    undefined
  );
  const [externalYawSeq, setExternalYawSeq] = useState<number>(0);
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);
  const centerStageWrapRef = useRef<HTMLDivElement | null>(null);
  const pdpDegNumRef = useRef<HTMLSpanElement | null>(null);
  const pdpDegBadgeRightRef = useRef<HTMLSpanElement | null>(null);
  const pdpDegDotRef = useRef<HTMLSpanElement | null>(null);
  const pdpHotspotsRef = useRef<HTMLDivElement | null>(null);

  const handleLiveYawChange = useCallback((deg: number) => {
    const d = ((Math.round(deg) % 360) + 360) % 360;
    const label = `${String(d).padStart(3, "0")}°`;
    if (pdpDegNumRef.current) pdpDegNumRef.current.textContent = label;
    if (pdpDegBadgeRightRef.current)
      pdpDegBadgeRightRef.current.textContent = label;
    if (pdpDegDotRef.current) {
      pdpDegDotRef.current.style.left = `${((d / 360) * 100).toFixed(1)}%`;
    }
    if (pdpHotspotsRef.current) {
      const show = d <= 24 || d >= 336;
      pdpHotspotsRef.current.style.opacity = show ? "1" : "0";
      pdpHotspotsRef.current.style.pointerEvents = show ? "auto" : "none";
    }
  }, []);

  const [openSection, setOpenSection] = useState<string>("Fit & Description");
  const [savedToCloset, setSavedToCloset] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const worn3DSpecs = useMemo(() => {
    const baseList = outfitPieces.length > 0 ? outfitPieces : [activeProduct];
    return baseList.map((prod) => ({
      product: prod,
      selectedSize: prod.id === activeProduct.id ? selectedSize : undefined,
    }));
  }, [activeProduct, outfitPieces, selectedSize]);

  const handleAddToBag = useCallback(
    (buyNow = false) => {
      if (!buyNow) {
        launchFlyToBag(
          centerStageWrapRef.current,
          activeProduct.imageUrl || lifelikePhotos.frontUrl
        );
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1600);
      }

      addToBag({
        productId: activeProduct.id,
        title: activeProduct.title,
        brand: activeProduct.brand || "GWO Boutique",
        price: activeProduct.price,
        size: selectedSize,
        imageUrl: activeProduct.imageUrl || lifelikePhotos.frontUrl,
        avatarFrontUrl: lifelikePhotos.frontUrl,
        avatarBackUrl: lifelikePhotos.backUrl,
        storeUrl: activeProduct.canonicalUrl,
      });

      if (buyNow) {
        openDropshipCheckout("checkout");
      }
    },
    [
      activeProduct,
      addToBag,
      lifelikePhotos.backUrl,
      lifelikePhotos.frontUrl,
      openDropshipCheckout,
      selectedSize,
    ]
  );

  const avatarHeightDisp = formatHeightFeetInches(bodyDims.heightInches);
  const realismCert = useMemo(
    () => certifyClothingItemRealism(activeProduct, bodyDims, selectedSize),
    [activeProduct, bodyDims, selectedSize]
  );

  const sizeOptions = useMemo(() => {
    const chartKeys = Object.keys(activeProduct.sizeChartInches || {});
    if (chartKeys.length > 0) return chartKeys.slice(0, 5);
    if (activeProduct.availableSizes?.length) {
      return activeProduct.availableSizes.slice(0, 5);
    }
    return [...SIZES];
  }, [activeProduct]);

  const activeSizeIdx = Math.max(0, sizeOptions.indexOf(selectedSize));

  return (
    <div className="sp-root">
      {/* ==================== TOP FOLD: 1-FOR-1 MOTIONSITES "SPIN PRODUCT" CLOTHING HERO ==================== */}
      <div className="max-w-[1540px] mx-auto min-h-[calc(100svh-64px)] lg:h-[calc(100svh-64px)] lg:min-h-[610px] px-0 lg:px-5 py-0 lg:py-4 grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)_380px] xl:grid-cols-[412px_minmax(0,1fr)_412px] gap-0 lg:gap-4 items-stretch border-b border-[#ECD7E1]">
        {/* ==================== LEFT CARD: EDITORIAL TITLE, OUTFIT PICKER & [+]/[-] DETAILS ACCORDION ==================== */}
        <section className="order-3 lg:order-1 mx-3 sm:mx-5 lg:mx-0 mt-3 lg:mt-0 mb-6 lg:mb-0 lg:h-full lg:min-h-0 rounded-3xl bg-white/95 backdrop-blur-md border border-[#ECD7E1] shadow-[0_14px_34px_rgba(150,41,83,0.07)] p-4 sm:p-5 flex flex-col justify-between gap-3 lg:overflow-hidden">
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/shop"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FCECF3] hover:bg-[#F8DCE8] text-xs font-bold text-[#962953]"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Runway &amp; Boutique
              </Link>

              <button
                type="button"
                onClick={() => setAddUrlModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white hover:bg-[#FDF1F6] border border-[#EBD2DE] text-xs font-bold text-[#962953] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Match Store URL
              </button>
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FCECF3] border border-[#F0C5D7] text-[#962953]">
                <Sparkles className="w-3 h-3 text-[#B83B6A]" />{" "}
                {activeProduct.brand} • {liveFitReport.confidencePct}% Safe-Fit
                Match
              </span>

              <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#22131A] mt-2 leading-[1.08]">
                {activeProduct.title}
              </h1>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <p className="font-editorial text-2xl font-bold text-[#22131A]">
                  ${activeProduct.price}
                </p>
                <Link
                  href={`/product/${encodeURIComponent(activeProduct.id)}`}
                  className="px-3 py-1.5 rounded-full bg-[#22131A] hover:bg-[#381F2B] text-white text-[11px] font-bold inline-flex items-center gap-1"
                >
                  Full Size Chart Page →
                </Link>
              </div>
            </div>

            {/* Visual Outfit & Store Piece Picker */}
            <div className="p-3 rounded-2xl bg-[#FDF5F9] border border-[#ECD7E1] space-y-2">
              <label
                htmlFor="gwo-product-360-picker"
                className="text-[11px] font-bold uppercase tracking-wider text-[#962953] flex items-center gap-1.5"
              >
                <Rotate3d className="w-3.5 h-3.5 text-[#B83B6A]" /> Switch Outfit
                or Boutique Piece
              </label>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {STUDIO_LOOKS.slice(0, 20).map((lk) => {
                  const key = `closet-look:${lk.index}`;
                  const active = selectedPickerVal === key;
                  return (
                    <button
                      key={lk.index}
                      type="button"
                      onClick={() => selectOutfitOrProduct(key)}
                      className={`shrink-0 w-12 h-16 rounded-xl overflow-hidden border transition cursor-pointer bg-white ${
                        active
                          ? "border-[#B83B6A] ring-2 ring-[#B83B6A]/25"
                          : "border-[#ECD7E1] opacity-85 hover:opacity-100"
                      }`}
                      title={lk.name}
                    >
                      <img
                        src={H(lk.file, 260)}
                        alt={lk.name}
                        loading="lazy"
                        className="w-full h-full object-contain object-bottom"
                      />
                    </button>
                  );
                })}
              </div>

              <select
                id="gwo-product-360-picker"
                value={selectedPickerVal}
                onChange={(e) => selectOutfitOrProduct(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#ECD7E1] text-xs font-semibold text-[#22131A] focus:outline-none focus:border-[#B83B6A]"
              >
                <optgroup
                  label={`Full Boutique Outfits (${STUDIO_LOOKS.length} 3D Designs)`}
                >
                  {STUDIO_LOOKS.map((lk) => (
                    <option key={lk.index} value={`closet-look:${lk.index}`}>
                      Outfit #{String(lk.index + 1).padStart(3, "0")}:{" "}
                      {formatCompactOutfitTitle(lk.name, 26)}
                    </option>
                  ))}
                </optgroup>
                <optgroup
                  label={`Individual Store Pieces (${fullCatalog.length} SKUs)`}
                >
                  {fullCatalog.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.brand} — {formatCompactProductTitle(prod, 24)} ($
                      {prod.price})
                    </option>
                  ))}
                </optgroup>
              </select>

              {outfitPieces.length > 1 && (
                <div className="pt-1 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#745C67]">
                    Inspect Piece in This Look ({outfitPieces.length}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {outfitPieces.map((piece) => {
                      const active = activeProduct.id === piece.id;
                      return (
                        <button
                          key={piece.id}
                          type="button"
                          onClick={() => setSelectedQuickProduct(piece)}
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border cursor-pointer transition ${
                            active
                              ? "bg-[#B83B6A] text-white border-[#B83B6A]"
                              : "bg-white text-[#22131A] border-[#ECD7E1] hover:bg-[#FCECF3]"
                          }`}
                        >
                          {formatCompactProductTitle(piece, 22)} (${piece.price})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Store Model vs Customer Scanned 3D Body Comparison */}
            <div className="p-3.5 rounded-2xl bg-[#FDF7FA] border border-[#ECD7E1] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#22131A] flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#B83B6A]" /> vs Your{" "}
                  {avatarHeightDisp} Scan
                </span>
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#ECD7E1] text-[11px] font-bold text-[#962953] hover:bg-[#FCECF3] cursor-pointer"
                >
                  <ScanLine className="w-3 h-3" /> Edit Scan
                </button>
              </div>
              <p className="text-xs font-semibold text-[#22131A]">
                {liveFitReport.lengthComparison.modelSummary}
              </p>
              <p className="text-xs text-[#745C67] leading-relaxed">
                {liveFitReport.lengthComparison.proportionNote}
              </p>
            </div>

            {/* [+]/[-] 0fr -> 1fr Editorial Product Details Accordion */}
            <div className="divide-y divide-[#ECD7E1] border-t border-b border-[#ECD7E1]">
              {[
                {
                  id: "Fit & Description",
                  body: (
                    <div className="space-y-2">
                      {activeProduct.fitMetadata?.descriptionSummary && (
                        <p className="text-xs text-[#634B56] leading-relaxed">
                          {activeProduct.fitMetadata.descriptionSummary}
                        </p>
                      )}
                      {(activeProduct.fitMetadata?.fitNotes?.length || 0) > 0 && (
                        <ul className="space-y-1">
                          {activeProduct.fitMetadata!.fitNotes.map((note) => (
                            <li
                              key={note}
                              className="text-[11px] text-[#22131A] flex items-start gap-1.5"
                            >
                              <span className="text-[#B83B6A] font-bold">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ),
                },
                {
                  id: "Fabric & Drape Physics",
                  body: (
                    <div className="space-y-1 text-xs text-[#634B56] leading-relaxed">
                      <p className="font-semibold text-[#22131A]">
                        {realismCert.fabricProfile.displayName} (
                        {realismCert.realismScorePct}% Certified)
                      </p>
                      <p>{liveFitReport.fabricSummary}</p>
                    </div>
                  ),
                },
                {
                  id: "Shipping & Free Exchanges",
                  body: (
                    <p className="text-xs text-[#634B56] leading-relaxed">
                      Tracked boutique air shipping ({activeProduct.estDeliveryDays || 6}{" "}
                      days) &amp; complimentary size exchanges.
                    </p>
                  ),
                },
              ].map((row) => {
                const open = openSection === row.id;
                return (
                  <div key={row.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenSection(open ? "" : row.id)}
                      className="w-full py-3 flex items-center justify-between text-xs font-bold text-[#22131A] hover:text-[#B83B6A] cursor-pointer transition-colors"
                    >
                      <span>{row.id}</span>
                      {open ? (
                        <Minus className="w-4 h-4 text-[#B83B6A]" />
                      ) : (
                        <Plus className="w-4 h-4 text-[#745C67]" />
                      )}
                    </button>
                    <div className={`gwo-acc-grid ${open ? "open" : ""}`}>
                      <div className="gwo-acc-inner">
                        <div className="pb-3">{row.body}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pinned Quick 3D Camera Angle Snaps */}
          <div className="shrink-0 flex items-center gap-1.5 pt-2 border-t border-[#ECD7E1]">
            {(
              [
                [0, "Front 0°"],
                [90, "Side 90°"],
                [180, "Back 180°"],
              ] as const
            ).map(([deg, lbl]) => (
              <button
                key={deg}
                type="button"
                onClick={() => {
                  if (
                    stageDisplayMode === "split" ||
                    stageDisplayMode === "photo"
                  ) {
                    setStageDisplayMode("avatar3d");
                  }
                  setExternalYawDeg(deg);
                  setExternalYawSeq((s) => s + 1);
                  handleLiveYawChange(deg);
                }}
                className="flex-1 py-2 px-2 rounded-2xl border border-[#ECD7E1] bg-white hover:bg-[#FCECF3] text-xs font-bold text-[#22131A] cursor-pointer transition"
              >
                {lbl}
              </button>
            ))}
          </div>
        </section>

        {/* ==================== CENTER COLUMN: PURE #FFFFFF WHITE LIFELIKE 360° TURNTABLE STAGE + HOTSPOTS ==================== */}
        <div
          ref={centerStageWrapRef}
          className="relative order-1 lg:order-2 min-w-0 h-[calc(82svh-64px)] min-h-[480px] lg:h-full lg:min-h-0 flex flex-col items-center justify-center bg-white lg:bg-transparent"
        >
          {stageDisplayMode === "avatar3d" && (
            <div className="relative w-full h-full flex-1 min-h-0 lg:rounded-3xl bg-white lg:border lg:border-[#ECD7E1] overflow-hidden">
              <Interactive3DAvatarStage
                mode="avatar"
                dimensions={bodyDims}
                wornPieces={worn3DSpecs}
                faceOvalDataUrl={customAvatar?.faceOvalDataUrl}
                customAvatarTurntableMp4Url={customAvatar?.turntableMp4Url}
                customAvatarTurntablePosterUrl={
                  customAvatar?.turntablePosterUrl
                }
                externalYawDeg={externalYawDeg}
                externalYawSeq={externalYawSeq}
                initialYawDeg={0}
                seamlessStage={false}
                inertiaSpin={true}
                onYawChange={handleLiveYawChange}
                onSelectProduct={(prod) => setSelectedQuickProduct(prod)}
                showHud={false}
              />

              {/* Pulsing Garment Hotspots at Front 0° */}
              <div
                ref={pdpHotspotsRef}
                className="absolute inset-0 pointer-events-auto transition-opacity duration-200"
              >
                {[
                  {
                    left: "56%",
                    top: "33%",
                    title: realismCert.fabricProfile.displayName,
                    note: realismCert.fabricProfile.drapeBehavior,
                  },
                  {
                    left: "44%",
                    top: "48%",
                    title: `Size ${selectedSize} Tailored Fit`,
                    note: liveFitReport.headlineVerdict,
                  },
                ].map((hs, idx) => {
                  const isOpenHs = activeHotspot === idx;
                  return (
                    <button
                      key={hs.title}
                      type="button"
                      aria-label={hs.title}
                      onClick={() => setActiveHotspot(isOpenHs ? null : idx)}
                      style={{ left: hs.left, top: hs.top }}
                      className="sp-hs show"
                    >
                      <span>{isOpenHs ? "−" : "+"}</span>
                      <span
                        style={
                          isOpenHs
                            ? { clipPath: "inset(0 0 0 0 round 14px)" }
                            : undefined
                        }
                        className={`sp-tip ${idx === 0 ? "left" : "right"}`}
                      >
                        <span className="sp-tip-title text-[#962953]">
                          {hs.title}
                        </span>
                        {hs.note}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Bottom-Center Degree Scrubber Pill */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div id="sp-deg">
                  <span>DRAG TO ROTATE</span>
                  <span className="sp-deg-bar">
                    <span
                      ref={pdpDegDotRef}
                      className="sp-deg-dot"
                      style={{ left: "0%" }}
                    />
                  </span>
                  <span ref={pdpDegNumRef} className="sp-deg-num">
                    000°
                  </span>
                </div>
              </div>
            </div>
          )}

          {stageDisplayMode === "product3d" && (
            <div className="relative w-full h-full flex-1 min-h-0 lg:rounded-3xl bg-white lg:border lg:border-[#ECD7E1] overflow-hidden">
              <Interactive3DAvatarStage
                mode="product"
                dimensions={bodyDims}
                singleProduct={activeProduct}
                selectedSize={selectedSize}
                externalYawDeg={externalYawDeg}
                externalYawSeq={externalYawSeq}
                autoSpinDefault={false}
                initialYawDeg={0}
                inertiaSpin={true}
                onYawChange={handleLiveYawChange}
                showHud={false}
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div id="sp-deg">
                  <span>ITEM 360°</span>
                  <span className="sp-deg-bar">
                    <span
                      ref={pdpDegDotRef}
                      className="sp-deg-dot"
                      style={{ left: "0%" }}
                    />
                  </span>
                  <span ref={pdpDegNumRef} className="sp-deg-num">
                    000°
                  </span>
                </div>
              </div>
            </div>
          )}

          {stageDisplayMode === "split" && (
            <div className="w-full h-full flex-1 min-h-0 lg:rounded-3xl bg-white lg:border lg:border-[#ECD7E1] p-3 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5">
                <div className="relative h-full rounded-2xl bg-white border border-[#F2E2EA] flex items-center justify-center overflow-hidden pt-2 pb-1 px-1">
                  <img
                    src={lifelikePhotos.frontUrl}
                    alt="Front 0° Look"
                    className="h-full w-full object-contain object-bottom"
                  />
                </div>
                <div className="relative h-full rounded-2xl bg-white border border-[#F2E2EA] flex items-center justify-center overflow-hidden pt-2 pb-1 px-1">
                  <img
                    src={lifelikePhotos.backUrl}
                    alt="Back 180° Look"
                    className="h-full w-full object-contain object-bottom"
                  />
                </div>
              </div>
            </div>
          )}

          {stageDisplayMode === "photo" && (
            <div className="w-full h-full flex-1 min-h-0 lg:rounded-3xl bg-white lg:border lg:border-[#ECD7E1] overflow-hidden flex items-center justify-center p-4">
              <GarmentArtwork
                product={activeProduct}
                className="w-full h-full"
              />
            </div>
          )}
        </div>

        {/* ==================== RIGHT CARD: SLIDING SIZE SELECTOR, FIT ZONES & FLY-TO-BAG CHECKOUT ==================== */}
        <section
          id="gwo-spin-fit-details"
          className="scroll-mt-16 order-2 lg:order-3 mx-3 sm:mx-5 lg:mx-0 mt-3 lg:mt-0 lg:h-full lg:min-h-0 rounded-3xl bg-white/95 backdrop-blur-md border border-[#ECD7E1] shadow-[0_14px_34px_rgba(150,41,83,0.07)] p-4 sm:p-5 flex flex-col justify-between gap-3 lg:overflow-hidden"
        >
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-3">
            {/* Stage View Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-[#ECD7E1]">
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[#F8EAF0] border border-[#EBD2DE] overflow-x-auto max-w-full">
                <button
                  type="button"
                  id="gwo-stage-tab-avatar3d"
                  onClick={() => setStageDisplayMode("avatar3d")}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                    stageDisplayMode === "avatar3d"
                      ? "bg-[#22131A] text-white"
                      : "text-[#6E5360] hover:text-[#22131A]"
                  }`}
                >
                  <Rotate3d className="w-3 h-3 text-[#F6B8D0]" /> Body
                </button>
                <button
                  type="button"
                  id="gwo-stage-tab-product3d"
                  onClick={() => setStageDisplayMode("product3d")}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                    stageDisplayMode === "product3d"
                      ? "bg-[#22131A] text-white"
                      : "text-[#6E5360] hover:text-[#22131A]"
                  }`}
                >
                  <Box className="w-3 h-3 text-[#F6B8D0]" /> Item
                </button>
                <button
                  type="button"
                  id="gwo-stage-tab-split"
                  onClick={() => setStageDisplayMode("split")}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                    stageDisplayMode === "split"
                      ? "bg-[#22131A] text-white"
                      : "text-[#6E5360] hover:text-[#22131A]"
                  }`}
                >
                  <Columns2 className="w-3 h-3" /> F+B
                </button>
                <button
                  type="button"
                  id="gwo-stage-tab-photo"
                  onClick={() => setStageDisplayMode("photo")}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                    stageDisplayMode === "photo"
                      ? "bg-[#22131A] text-white"
                      : "text-[#6E5360] hover:text-[#22131A]"
                  }`}
                >
                  <Images className="w-3 h-3" /> Photo
                </button>
              </div>
              <span
                ref={pdpDegBadgeRightRef}
                className="px-2.5 py-0.5 rounded-full bg-[#FCECF3] border border-[#F0C5D7] text-[#962953] text-[10px] font-bold"
              >
                000°
              </span>
            </div>

            {/* Scanned 3D Body Measurements Header */}
            <div className="p-3 rounded-2xl bg-[#FDF5F9] border border-[#ECD7E1] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#22131A] inline-flex items-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5 text-[#B83B6A]" /> Your
                  Scanned Body
                </span>
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="text-[11px] font-bold text-[#B83B6A] hover:underline cursor-pointer"
                >
                  Rescan / Edit →
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  ["Height", avatarHeightDisp],
                  ["Bust", `${bodyDims.bustInches}"`],
                  ["Waist", `${bodyDims.waistInches}"`],
                  ["Hips", `${bodyDims.hipsInches}"`],
                ].map(([lbl, val]) => (
                  <div
                    key={lbl}
                    className="py-1.5 px-1.5 rounded-xl bg-white border border-[#ECD7E1]"
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[#745C67]">
                      {lbl}
                    </p>
                    <p className="text-xs font-bold text-[#22131A]">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sliding Pill Highlight Size Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#22131A]">
                  Select Size
                </span>
                <span className="text-[11px] font-bold text-[#B83B6A]">
                  Recommended: {liveFitReport.recommendedSize}
                </span>
              </div>

              <div
                style={{
                  gridTemplateColumns: `repeat(${sizeOptions.length}, minmax(0, 1fr))`,
                }}
                className="relative grid p-1 rounded-2xl bg-[#F8EAF0] border border-[#EBD2DE]"
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: `calc((100% - 8px) / ${sizeOptions.length})`,
                    transform: `translateX(${activeSizeIdx * 100}%)`,
                  }}
                  className="absolute top-1 bottom-1 left-1 rounded-xl bg-[#22131A] shadow-sm transition-transform duration-300 ease-out pointer-events-none"
                />
                {sizeOptions.map((sz) => {
                  const active = selectedSize === sz;
                  const isBest = liveFitReport.recommendedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`relative z-10 py-2 text-xs font-bold transition-colors cursor-pointer ${
                        active ? "text-white" : "text-[#6E5360] hover:text-[#22131A]"
                      }`}
                    >
                      {sz}
                      {isBest && (
                        <span
                          className={`block text-[8.5px] font-bold leading-none mt-0.5 ${
                            active ? "text-[#F9CFE0]" : "text-[#B83B6A]"
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

            {/* Live Zone-by-Zone Ease & Tension Meters */}
            {liveFitReport.zones.length > 0 && (
              <div className="space-y-2">
                {liveFitReport.zones.map((z) => (
                  <div
                    key={z.zone}
                    className="p-2.5 rounded-2xl bg-[#FDF7FA] border border-[#ECD7E1] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#22131A]">
                        {z.zone}{" "}
                        <span className="text-[11px] font-normal text-[#745C67]">
                          ({z.avatarInches}&quot; vs {z.garmentRange})
                        </span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getZoneBadgeStyle(
                          z.feel
                        )}`}
                      >
                        {z.feelLabel}
                      </span>
                    </div>

                    <div className="relative h-2 rounded-full bg-[#F1E0E8] overflow-hidden">
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black/15" />
                      <div
                        style={{
                          width: `${z.meterPct}%`,
                          backgroundColor: getZoneBarColor(z.feel),
                        }}
                        className="h-full rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dynamic Tailor Safe-Shopping Verdict */}
            <div className="p-2.5 rounded-2xl bg-[#FCECF3] border border-[#F0C5D7] space-y-1">
              <p className="text-xs font-semibold text-[#852148] leading-snug">
                {liveFitReport.headlineVerdict}
              </p>
              {liveFitReport.alternateOption &&
                selectedSize === liveFitReport.recommendedSize && (
                  <p className="text-[11px] text-[#745C67]">
                    Tip: {liveFitReport.alternateOption.note}.
                  </p>
                )}
            </div>
          </div>

          {/* Pinned Retail Checkout & Fly-to-Bag Actions */}
          <div className="shrink-0 space-y-2 pt-2.5 border-t border-[#ECD7E1]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="sp-buy"
                onClick={() => handleAddToBag(false)}
                className="flex-1 py-3 rounded-full bg-gradient-to-r from-[#B83B6A] to-[#91244E] hover:brightness-105 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-[0_6px_18px_rgba(184,59,106,0.28)]"
              >
                <span className="gwo-roll-track">
                  <span
                    className={`gwo-roll-inner ${justAdded ? "rolled" : ""}`}
                  >
                    <span>
                      <ShoppingBag className="w-3.5 h-3.5" /> Add Size{" "}
                      {selectedSize} to Bag • ${activeProduct.price}
                    </span>
                    <span>
                      <Check className="w-3.5 h-3.5" /> Added Size{" "}
                      {selectedSize} to Bag ✓
                    </span>
                  </span>
                </span>
              </button>

              <button
                type="button"
                aria-label="Save to Closet Loves"
                aria-pressed={savedToCloset}
                onClick={() => {
                  setSavedToCloset((v) => !v);
                  showToast(
                    `Saved ${activeProduct.title} (${selectedSize}) to Loves ♡!`
                  );
                }}
                className="gwo-heart-btn w-11 h-11 rounded-full bg-white hover:bg-[#FCECF3] border border-[#EBD2DE] flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Heart
                  className={`w-4 h-4 ${
                    savedToCloset
                      ? "fill-[#B83B6A] text-[#B83B6A]"
                      : "text-[#6E5360]"
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              id="sp-buy-now"
              onClick={() => handleAddToBag(true)}
              className="w-full py-2.5 rounded-full bg-[#22131A] hover:bg-[#381F2B] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              Buy Size {selectedSize} Now • ${activeProduct.price}
            </button>
          </div>
        </section>
      </div>

      {/* ==================== SCROLL BELOW TO SHOP ALL CLOTHING LIKE A FULL BOUTIQUE STORE ==================== */}
      <MotionSitesBoutiqueStorefront
        catalog={fullCatalog}
        outfits={curatedOutfits}
        ownedIds={ownedIds}
        onTryPieceOnRunway={(prod) => {
          selectOutfitOrProduct(prod.id);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
