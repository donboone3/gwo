"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Box,
  Check,
  ChevronDown,
  Columns2,
  Images,
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
import { useGwo } from "@/context/GwoAppContext";
import {
  analyzeExactAvatarFit,
  ZoneFeel,
} from "@/lib/catalog/fit-intelligence";
import { build3DOutfitForClosetLook } from "@/lib/catalog/closet-look-3d-mapper";
import { resolveLifelikeAvatarPhotos } from "@/lib/catalog/avatar-photo-resolver";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import {
  deriveFullBodyDimensionsFromProfile,
  formatHeightFeetInches,
} from "@/lib/three/body-scan-analyzer";
import { certifyClothingItemRealism } from "@/lib/realism/master-avatar-clothing-realism";
import { Product } from "@/lib/types";

const SIZES = ["XS", "S", "M", "L"] as const;

function getZoneBadgeStyle(feel: ZoneFeel): string {
  if (feel === "too_tight") {
    return "bg-[#FDECEB] text-[#9E2A22] border-[#F5C6C2]";
  }
  if (feel === "sculpted_snug") {
    return "bg-[#FEF6E6] text-[#8A5808] border-[#F4DFB4]";
  }
  if (feel === "tailored_ideal") {
    return "bg-[#E7F3EE] text-[#1D4232] border-[#C1DFD0]";
  }
  if (feel === "relaxed_skim") {
    return "bg-[#EEF2F7] text-[#263445] border-[#D5DFEC]";
  }
  return "bg-[#F1EFFA] text-[#45357A] border-[#DCD6F2]";
}

function getZoneBarColor(feel: ZoneFeel): string {
  if (feel === "too_tight") return "#D94336";
  if (feel === "sculpted_snug") return "#D98A1C";
  if (feel === "tailored_ideal") return "#244B3B";
  if (feel === "relaxed_skim") return "#355C7D";
  return "#5E4B9E";
}

export function GwoSpinProduct() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");
  const lookParam = searchParams.get("look");

  const {
    user,
    products,
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

  const bodyDims = useMemo(
    () => deriveFullBodyDimensionsFromProfile(user, customAvatar),
    [customAvatar, user]
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

  const initialOutfit = useMemo(() => resolveOutfitProducts(0), [resolveOutfitProducts]);

  const [selectedPickerVal, setSelectedPickerVal] =
    useState<string>("closet-look:0");
  const [selectedQuickProduct, setSelectedQuickProduct] =
    useState<Product | null>(initialOutfit.primary);
  const [outfitPieces, setOutfitPieces] = useState<Product[]>(
    initialOutfit.allPieces
  );
  const [selectedLookIdx, setSelectedLookIdx] = useState<number | undefined>(0);

  // Sync URL query (?id=... or ?look=...) into outfit picker; default to AliExpress Outfit #01
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
  const [liveSpinDeg, setLiveSpinDeg] = useState<number>(0);

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
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1600);

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

  return (
    <div className="sp-root">
      <div className="max-w-[1540px] mx-auto min-h-[calc(100svh-64px)] lg:h-full px-3 sm:px-5 py-3 sm:py-4 grid grid-cols-1 lg:grid-cols-[364px_minmax(0,1fr)_364px] xl:grid-cols-[406px_minmax(0,1fr)_406px] gap-3.5 sm:gap-4 items-stretch">
        {/* ==================== LEFT CARD: OUTFIT PICKER, PRODUCT SPECS & 3D ANGLES ==================== */}
        <section className="order-3 lg:order-1 lg:h-full lg:min-h-0 rounded-3xl bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 sm:p-5 flex flex-col justify-between gap-3 lg:overflow-hidden">
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F4F5F7] hover:bg-[#E7E9EE] text-xs font-semibold text-[#141518]"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Closet
              </Link>

              <button
                type="button"
                onClick={() => setAddUrlModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E4E7EC] text-xs font-bold text-[#141518] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Match Online URL
              </button>
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E7F3EE] text-[#244B3B]">
                <Sparkles className="w-3 h-3" /> {activeProduct.brand} •{" "}
                {liveFitReport.confidencePct}% Safe-Fit Match
              </span>

              <h1 className="text-lg sm:text-xl font-bold text-[#141518] mt-2 leading-snug">
                {activeProduct.title}
              </h1>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-base sm:text-lg font-bold text-[#141518]">
                  ${activeProduct.price}
                </p>
                <Link
                  href={`/product/${encodeURIComponent(activeProduct.id)}`}
                  className="px-3 py-1 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold inline-flex items-center gap-1"
                >
                  Open Dedicated Product Page →
                </Link>
              </div>
            </div>

            {/* Visual Outfit & Store Piece Picker */}
            <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
              <label
                htmlFor="gwo-product-360-picker"
                className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B] flex items-center gap-1.5"
              >
                <Rotate3d className="w-3.5 h-3.5" /> Pick Any Outfit or Piece to Test in 3D
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
                          ? "border-[#141518] ring-2 ring-[#141518]/20"
                          : "border-black/10 opacity-85 hover:opacity-100"
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
                className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs font-semibold text-[#141518] focus:outline-none focus:border-[#141518]"
              >
                <optgroup label={`Full Boutique Outfits (${STUDIO_LOOKS.length} 3D Designs)`}>
                  {STUDIO_LOOKS.map((lk) => (
                    <option key={lk.index} value={`closet-look:${lk.index}`}>
                      Outfit #{String(lk.index + 1).padStart(3, "0")}: {lk.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={`Individual Store Pieces (${fullCatalog.length} SKUs)`}>
                  {fullCatalog.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.brand} — {prod.title} (${prod.price})
                    </option>
                  ))}
                </optgroup>
              </select>

              {outfitPieces.length > 1 && (
                <div className="pt-1 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#686D76]">
                    Inspect Piece Measurements in This Outfit ({outfitPieces.length}):
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
                              ? "bg-[#141518] text-white border-[#141518]"
                              : "bg-white text-[#141518] border-black/10 hover:bg-[#EAECEF]"
                          }`}
                        >
                          {piece.title} (${piece.price})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Store Model vs Customer Scanned 3D Body Comparison */}
            <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#244B3B]" /> Description vs Your{" "}
                  {avatarHeightDisp} Scan
                </span>
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-black/[0.08] text-[11px] font-bold text-[#244B3B] hover:bg-[#EBF3EE] cursor-pointer"
                >
                  <ScanLine className="w-3 h-3" /> Edit 3D Scan
                </button>
              </div>
              <p className="text-xs font-semibold text-[#141518]">
                {liveFitReport.lengthComparison.modelSummary}
              </p>
              <p className="text-xs text-[#686D76] leading-relaxed">
                {liveFitReport.lengthComparison.proportionNote}
              </p>
            </div>

            {/* Master Realism PBR Fabric & Drape Certification Card */}
            {(() => {
              const cert = certifyClothingItemRealism(
                activeProduct,
                bodyDims,
                selectedSize
              );
              return (
                <div className="p-3.5 rounded-2xl bg-[#F4F8F6] border border-[#C6DFD1] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#1D4232] inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />{" "}
                      {cert.fabricProfile.displayName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white text-[#1D4232] border border-[#C6DFD1] text-[10px] font-bold">
                      {cert.realismScorePct}% Realism Certified
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-[#141518]">
                    {cert.fabricProfile.drapeBehavior}
                  </p>
                  <p className="text-[10.5px] text-[#4E5D55]">
                    {cert.fabricProfile.handfeelNote} • {cert.layerClearanceMm}mm
                    3D shell clearance
                  </p>
                </div>
              );
            })()}

            {/* Product Description & Fabric Physics Accordion */}
            <div className="divide-y divide-black/[0.07] border-t border-b border-black/[0.07]">
              {[
                {
                  id: "Fit & Description",
                  body: (
                    <div className="space-y-2">
                      {activeProduct.fitMetadata?.descriptionSummary && (
                        <p className="text-xs text-[#5C6068] leading-relaxed">
                          {activeProduct.fitMetadata.descriptionSummary}
                        </p>
                      )}
                      {(activeProduct.fitMetadata?.fitNotes?.length || 0) > 0 && (
                        <ul className="space-y-1">
                          {activeProduct.fitMetadata!.fitNotes.map((note) => (
                            <li
                              key={note}
                              className="text-[11px] text-[#141518] flex items-start gap-1.5"
                            >
                              <span className="text-[#244B3B] font-bold">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ),
                },
                {
                  id: "Fabric & Stretch Physics",
                  body: (
                    <p className="text-xs text-[#5C6068] leading-relaxed">
                      {liveFitReport.fabricSummary}
                    </p>
                  ),
                },
              ].map((row) => {
                const open = openSection === row.id;
                return (
                  <div key={row.id}>
                    <button
                      type="button"
                      onClick={() => setOpenSection(open ? "" : row.id)}
                      className="w-full py-2.5 flex items-center justify-between text-xs font-bold text-[#141518] cursor-pointer"
                    >
                      <span>{row.id}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#686D76] transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open && <div className="pb-3">{row.body}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pinned Quick 3D Camera Angle Snaps */}
          <div className="shrink-0 flex items-center gap-1.5 pt-2 border-t border-black/[0.06]">
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
                  if (stageDisplayMode === "split" || stageDisplayMode === "photo") {
                    setStageDisplayMode("avatar3d");
                  }
                  setExternalYawDeg(deg);
                }}
                className="flex-1 py-2 px-2 rounded-2xl border border-black/10 bg-white hover:bg-[#F4F5F7] text-xs font-bold text-[#141518] cursor-pointer transition"
              >
                {lbl}
              </button>
            ))}
          </div>
        </section>

        {/* ==================== CENTER COLUMN: LIFELIKE 360° TURNTABLE STAGE ==================== */}
        <div className="order-1 lg:order-2 min-w-0 h-auto lg:h-full lg:min-h-0 flex flex-col items-center justify-between gap-2">
          {/* Top Mode Switcher: Lifelike 360° | Garment Spin | Front + Back | Garment Photo */}
          <div className="shrink-0 flex flex-wrap items-center justify-center gap-1 p-1 rounded-full bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-xs z-20">
            <button
              type="button"
              id="gwo-stage-tab-avatar3d"
              onClick={() => setStageDisplayMode("avatar3d")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                stageDisplayMode === "avatar3d"
                  ? "bg-[#141518] text-white"
                  : "text-[#686D76] hover:text-[#141518]"
              }`}
            >
              <Rotate3d className="w-3.5 h-3.5 text-[#A7D7C5]" /> 3D Character
            </button>
            <button
              type="button"
              id="gwo-stage-tab-product3d"
              onClick={() => setStageDisplayMode("product3d")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                stageDisplayMode === "product3d"
                  ? "bg-[#141518] text-white"
                  : "text-[#686D76] hover:text-[#141518]"
              }`}
            >
              <Box className="w-3.5 h-3.5 text-[#A7D7C5]" /> 3D Item Mesh
            </button>
            <button
              type="button"
              id="gwo-stage-tab-split"
              onClick={() => setStageDisplayMode("split")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                stageDisplayMode === "split"
                  ? "bg-[#141518] text-white"
                  : "text-[#686D76] hover:text-[#141518]"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" /> Front + Back
            </button>
            <button
              type="button"
              id="gwo-stage-tab-photo"
              onClick={() => setStageDisplayMode("photo")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                stageDisplayMode === "photo"
                  ? "bg-[#141518] text-white"
                  : "text-[#686D76] hover:text-[#141518]"
              }`}
            >
              <Images className="w-3.5 h-3.5" /> Garment Photo
            </button>
          </div>

          {/* MODE 1: LIFELIKE 360° INERTIA TURNTABLE ON SCANNED BODY */}
          {stageDisplayMode === "avatar3d" && (
            <div className="w-full h-[460px] lg:flex-1 lg:min-h-0 overflow-hidden">
              <Interactive3DAvatarStage
                mode="avatar"
                dimensions={bodyDims}
                wornPieces={worn3DSpecs}
                faceOvalDataUrl={customAvatar?.faceOvalDataUrl}
                externalYawDeg={externalYawDeg}
                initialYawDeg={0}
                seamlessStage={true}
                inertiaSpin={true}
                onYawChange={setLiveSpinDeg}
                selectedProductId={activeProduct.id}
                onSelectProduct={(prod) => setSelectedQuickProduct(prod)}
                showHud={true}
              />
            </div>
          )}

          {/* MODE 2: STANDALONE GARMENT 360° SPIN */}
          {stageDisplayMode === "product3d" && (
            <div className="w-full h-[460px] lg:flex-1 lg:min-h-0 rounded-3xl bg-gradient-to-b from-[#F4F6FA] to-[#E5EAF2] border border-black/[0.08] overflow-hidden">
              <Interactive3DAvatarStage
                mode="product"
                dimensions={bodyDims}
                singleProduct={activeProduct}
                selectedSize={selectedSize}
                externalYawDeg={externalYawDeg}
                autoSpinDefault={true}
                initialYawDeg={22}
                inertiaSpin={true}
                onYawChange={setLiveSpinDeg}
                showHud={true}
              />
            </div>
          )}

          {/* MODE 3: SIDE-BY-SIDE LOOKBOOK FRONT 0° + BACK 180° */}
          {stageDisplayMode === "split" && (
            <div className="w-full h-[460px] lg:flex-1 lg:min-h-0 rounded-3xl bg-white/90 backdrop-blur-md border border-black/[0.08] p-3 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5">
                <div className="relative h-full rounded-2xl bg-gradient-to-b from-[#F5F6F9] to-[#E6E9EF] flex items-center justify-center overflow-hidden pt-6 pb-1 px-1">
                  <img
                    src={lifelikePhotos.frontUrl}
                    alt="Front 0° Look"
                    className="h-full w-full object-contain object-bottom"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10.5px] font-bold">
                    Front 0°
                  </span>
                </div>
                <div className="relative h-full rounded-2xl bg-gradient-to-b from-[#F5F6F9] to-[#E6E9EF] flex items-center justify-center overflow-hidden pt-6 pb-1 px-1">
                  <img
                    src={lifelikePhotos.backUrl}
                    alt="Back 180° Look"
                    className="h-full w-full object-contain object-bottom"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10.5px] font-bold">
                    Back 180°
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* MODE 4: ISOLATED GARMENT PRODUCT PHOTO */}
          {stageDisplayMode === "photo" && (
            <div className="w-full h-[460px] lg:flex-1 lg:min-h-0 rounded-3xl bg-white border border-black/[0.08] overflow-hidden flex flex-col justify-between">
              <div className="flex-1 min-h-0 bg-[#F6F7F9] flex items-center justify-center overflow-hidden p-4">
                <GarmentArtwork
                  product={activeProduct}
                  className="w-full h-full"
                />
              </div>
              <div className="shrink-0 px-4 py-2.5 bg-white border-t border-black/[0.06] flex items-center justify-between text-xs font-bold text-[#141518]">
                <span>{activeProduct.title}</span>
                <span className="text-[#244B3B]">
                  Best Match: Size {liveFitReport.recommendedSize}
                </span>
              </div>
            </div>
          )}

          {/* Original Iconic 360° Turntable Degree Readout Bar (#sp-deg) */}
          {(stageDisplayMode === "avatar3d" ||
            stageDisplayMode === "product3d") && (
            <div id="sp-deg" className="shrink-0">
              <span>DRAG MODEL TO SPIN 360°</span>
              <span className="sp-deg-bar">
                <span
                  className="sp-deg-dot"
                  style={{ left: `${((liveSpinDeg % 360) / 360) * 100}%` }}
                />
              </span>
              <span className="sp-deg-num">
                {String(liveSpinDeg).padStart(3, "0")}°
              </span>
            </div>
          )}
        </div>

        {/* ==================== RIGHT CARD: EXACT-FIT ZONE SIMULATOR & RETAIL CHECKOUT ==================== */}
        <section className="order-2 lg:order-3 lg:h-full lg:min-h-0 rounded-3xl bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 sm:p-5 flex flex-col justify-between gap-3 lg:overflow-hidden">
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-3">
            {/* Scanned 3D Body Measurements Header */}
            <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#141518] inline-flex items-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5 text-[#244B3B]" /> Your Scanned Body
                </span>
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="text-[11px] font-bold text-[#244B3B] hover:underline cursor-pointer"
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
                    className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]"
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                      {lbl}
                    </p>
                    <p className="text-xs font-bold text-[#141518]">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Size Selector (Physically Morphs 3D Garment Ease!) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#141518]">
                  Simulate Size on Your Body
                </span>
                <span className="text-[11px] font-semibold text-[#244B3B]">
                  Live Fit Physics
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {SIZES.map((sz) => {
                  const active = selectedSize === sz;
                  const isBest = liveFitReport.recommendedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`relative py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        active
                          ? "bg-[#141518] text-white border-[#141518]"
                          : "bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#141518] border-black/[0.06]"
                      }`}
                    >
                      {sz}
                      {isBest && (
                        <span
                          className={`block text-[9px] font-bold leading-none mt-0.5 ${
                            active ? "text-[#A7D7C5]" : "text-[#244B3B]"
                          }`}
                        >
                          Best Fit
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
                    className="p-2.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.05] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#141518]">
                        {z.zone}{" "}
                        <span className="text-[11px] font-normal text-[#686D76]">
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

                    <div className="relative h-2 rounded-full bg-[#E5E8EE] overflow-hidden">
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black/20" />
                      <div
                        style={{
                          width: `${z.meterPct}%`,
                          backgroundColor: getZoneBarColor(z.feel),
                        }}
                        className="h-full rounded-full transition-all duration-300"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-[#8A9099]">
                      <span>Snug / Tight</span>
                      <span>Safe Tailored Match</span>
                      <span>Roomy Drape</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dynamic Tailor Safe-Shopping Verdict */}
            <div className="p-2.5 rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] space-y-1">
              <p className="text-xs font-semibold text-[#1D4232] leading-snug">
                {liveFitReport.headlineVerdict}
              </p>
              {liveFitReport.alternateOption &&
                selectedSize === liveFitReport.recommendedSize && (
                  <p className="text-[11px] text-[#4E5A54]">
                    Tip: {liveFitReport.alternateOption.note}.
                  </p>
                )}
            </div>
          </div>

          {/* Pinned Retail Checkout & Closet Actions */}
          <div className="shrink-0 space-y-2 pt-2.5 border-t border-black/[0.07]">
            <button
              type="button"
              id="sp-buy-now"
              onClick={() => handleAddToBag(true)}
              className="w-full py-3 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
            >
              Buy Size {selectedSize} Now • ${activeProduct.price}
            </button>

            <button
              type="button"
              id="sp-buy"
              onClick={() => handleAddToBag(false)}
              className="w-full py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 text-[#A7D7C5]" /> Added Size{" "}
                  {selectedSize} to Bag!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" /> Add Size {selectedSize} to Bag
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSavedToCloset(true);
                showToast(
                  `Saved ${activeProduct.title} (${selectedSize}) to My 3D Closet!`
                );
              }}
              className={`w-full py-2 rounded-full text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                savedToCloset
                  ? "bg-[#E7F3EE] border-[#244B3B]/20 text-[#244B3B]"
                  : "bg-white hover:bg-[#F7F8FA] border-black/10 text-[#141518]"
              }`}
            >
              {savedToCloset ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Saved in My Closet
                </>
              ) : (
                "Save to My 3D Closet"
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
